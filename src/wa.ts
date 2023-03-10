import type { BaileysEventMap, ConnectionState, proto, SocketConfig } from '@adiwajshing/baileys';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  isJidBroadcast,
  makeCacheableSignalKeyStore,
} from '@adiwajshing/baileys';
import type { Boom } from '@hapi/boom';
import { initStore, Store, useSession } from '@ookamiiixd/baileys-store';
import axios from 'axios';
import type { Response } from 'express';
import ProxyAgent from 'proxy-agent';
import { toDataURL } from 'qrcode';
import type { WebSocket } from 'ws';
import { logger, prisma } from './shared';
import { delay, pick } from './utils';

const sessions = new Map<string, Session & { store: Store }>();
const retries = new Map<string, number>();
const QRGenerations = new Map<string, number>();

const RECONNECT_INTERVAL = Number(process.env.RECONNECT_INTERVAL || 0);
const MAX_RECONNECT_RETRIES = Number(process.env.MAX_RECONNECT_RETRIES || 5);
const MAX_QR_GENERATION = Number(process.env.MAX_QR_GENERATION || 5);
const SESSION_CONFIG_ID = 'session-config';

function shouldReconnect(sessionId: string) {
  let attempts = retries.get(sessionId) ?? 1;

  if (attempts < MAX_RECONNECT_RETRIES) {
    attempts += 1;
    retries.set(sessionId, attempts);
    return true;
  }
  return false;
}

export async function init() {
  initStore({ prisma, logger });
  const sessions = await prisma.session.findMany({
    select: { sessionId: true, data: true },
    where: { id: { startsWith: SESSION_CONFIG_ID } },
  });

  for (const { sessionId, data } of sessions) {
    const { readIncomingMessages, proxy, ...socketConfig } = JSON.parse(data);
    Session.create({ sessionId, readIncomingMessages, proxy, socketConfig });
  }
}

type SessionOptions = {
  sessionId: string;
  res?: Response;
  SSE?: boolean;
  readIncomingMessages?: boolean;
  proxy?: string;
  webhook?: {
    url: string[];
    events: 'all' | (keyof BaileysEventMap)[];
  };
  socketConfig?: SocketConfig;
};

export class Session {
  private connectionState: Partial<ConnectionState> = { connection: 'close' };
  private lastGeneratedQR: string | null = null;
  public readonly socket: ReturnType<typeof makeWASocket>;

  constructor(
    private readonly sessionState: Awaited<ReturnType<typeof useSession>>,
    private readonly options: SessionOptions
  ) {
    const { sessionId, socketConfig, proxy } = options;
    this.socket = makeWASocket({
      printQRInTerminal: true,
      browser: Browsers.ubuntu('Chrome'),
      generateHighQualityLinkPreview: true,
      ...socketConfig,
      logger,
      agent: proxy ? new ProxyAgent(proxy) : undefined,
      auth: {
        creds: sessionState.state.creds,
        keys: makeCacheableSignalKeyStore(sessionState.state.keys, logger),
      },
      shouldIgnoreJid: (jid) => isJidBroadcast(jid),
      getMessage: async (key) => {
        const data = await prisma.message.findFirst({
          where: { remoteJid: key.remoteJid!, id: key.id!, sessionId },
        });
        return (data?.message || undefined) as proto.IMessage | undefined;
      },
    });

    this.bindEvents();
    sessions.set(sessionId, { ...this, store: new Store(sessionId, this.socket.ev) });
  }

  public static async create(options: SessionOptions) {
    options = { readIncomingMessages: false, SSE: false, ...options };
    const { sessionId, readIncomingMessages, socketConfig } = options;
    const configID = `${SESSION_CONFIG_ID}-${sessionId}`;
    const data = JSON.stringify({
      readIncomingMessages: readIncomingMessages,
      ...socketConfig,
    });

    const [sessionState] = await Promise.all([
      useSession(sessionId),
      prisma.session.upsert({
        create: {
          id: configID,
          sessionId,
          data,
        },
        update: { data },
        where: { sessionId_id: { id: configID, sessionId } },
      }),
    ]);
    return new Session(sessionState, options);
  }

  public static list() {
    return Array.from(sessions.entries()).map(([id, session]) => ({
      id,
      status: session.status(),
    }));
  }

  public static get(sessionId: string) {
    return sessions.get(sessionId) ?? null;
  }

  public static async delete(sessionId: string) {
    await Session.get(sessionId)?.destroy();
  }

  public static exists(sessionId: string) {
    return sessions.has(sessionId);
  }

  public QR() {
    return this.lastGeneratedQR;
  }

  public status() {
    const state = ['CONNECTING', 'CONNECTED', 'DISCONNECTING', 'DISCONNECTED'];
    let status = state[(this.socket.ws as WebSocket).readyState];
    status = this.socket.user ? 'AUTHENTICATED' : status;
    return status;
  }

  public async jidExists(jid: string, type: 'group' | 'number' = 'number') {
    try {
      if (type === 'number') {
        const [result] = await this.socket.onWhatsApp(jid);
        return !!result?.exists;
      }

      const groupMetadata = await this.socket.groupMetadata(jid);
      return !!groupMetadata.id;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public async destroy(logout = true) {
    const { sessionId } = this.options;
    try {
      await Promise.all([
        logout && this.socket.logout(),
        prisma.chat.deleteMany({ where: { sessionId } }),
        prisma.contact.deleteMany({ where: { sessionId } }),
        prisma.message.deleteMany({ where: { sessionId } }),
        prisma.session.deleteMany({ where: { sessionId } }),
      ]);
    } catch (e) {
      logger.error(e, 'An error occured during session destroy');
    } finally {
      sessions.delete(sessionId);
    }
  }

  private bindEvents() {
    const { sessionId, readIncomingMessages, webhook } = this.options;
    this.socket.ev.on('creds.update', this.sessionState.saveCreds);
    this.socket.ev.on('connection.update', (update) => {
      this.connectionState = update;
      const { connection } = update;

      if (connection === 'open') {
        retries.delete(sessionId);
        QRGenerations.delete(sessionId);
      } else if (connection === 'close') this.handleConnectionClose();
      this.handleConnectionUpdate();
    });

    if (readIncomingMessages) {
      this.socket.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (message.key.fromMe || m.type !== 'notify') return;

        await delay(1000);
        await this.socket.readMessages([message.key]);
      });
    }

    if (webhook) {
      this.socket.ev.process(async (events) => {
        const data = webhook.events === 'all' ? events : pick(events, webhook.events);
        try {
          await Promise.any(
            webhook.url.map((url) =>
              axios.post(url, JSON.stringify(data), {
                headers: {
                  'Content-Type': 'application/json',
                },
                timeout: 5000,
              })
            )
          );
        } catch (e) {
          logger.error(e, 'An error occured during webhook request');
        }
      });
    }
  }

  private async handleConnectionUpdate() {
    const { sessionId, res, SSE } = this.options;
    const { qr } = this.connectionState;
    let generatedQR: string | null = null;
    const currentQRGenerations = QRGenerations.get(sessionId) ?? 1;

    if (qr) {
      try {
        generatedQR = await toDataURL(qr);
        this.lastGeneratedQR = generatedQR;
        QRGenerations.set(sessionId, currentQRGenerations + 1);
      } catch (e) {
        logger.error(e, 'An error occured during QR generation');
      }
    }

    const limitReached = currentQRGenerations >= MAX_QR_GENERATION;
    if (limitReached) this.destroy();

    if (!res || res.writableEnded) return;
    if (SSE) {
      res.write(
        `data: ${JSON.stringify(
          limitReached
            ? { error: 'QR max generation attempts reached' }
            : { ...this.connectionState, qr: generatedQR }
        )}\n\n`
      );
      if (limitReached) res.end();
    } else {
      if (limitReached) res.status(500).json({ error: 'QR max generation attempts reached' }).end();
      else if (!limitReached && qr && generatedQR) res.status(200).json({ qr: generatedQR });
      else if (!limitReached && qr && !generatedQR)
        res.status(500).json({ error: 'Unable to generate QR' });
    }
  }

  private handleConnectionClose() {
    const { sessionId, res, SSE } = this.options;
    const code = (this.connectionState.lastDisconnect?.error as Boom)?.output?.statusCode;
    const restartRequired = code === DisconnectReason.restartRequired;
    const doNotReconnect = !shouldReconnect(sessionId);

    if (code === DisconnectReason.loggedOut || doNotReconnect) {
      if (res && res.writableEnded) {
        !SSE && res.status(500).json({ error: 'Unable to create session' });
        res.end();
      }
      return this.destroy(doNotReconnect);
    }

    if (!restartRequired) {
      logger.info(
        { attempts: retries.get(sessionId) ?? 1, sessionId: sessionId },
        'Reconnecting...'
      );
    }
    setTimeout(() => Session.create(this.options), restartRequired ? 0 : RECONNECT_INTERVAL);
  }
}
