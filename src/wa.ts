import type { ConnectionState, proto, SocketConfig, WASocket } from '@adiwajshing/baileys';
import type { Response } from 'express';
import { DisconnectReason } from '@adiwajshing/baileys';
import { Browsers } from '@adiwajshing/baileys';
import makeWASocket from '@adiwajshing/baileys';
import { PrismaClient } from '@prisma/client';
import { useSession, Store, initStore } from 'baileys-store';
import type { Boom } from '@hapi/boom';
import pino from 'pino';

const sessions = new Map<string, WASocket & { store: Store }>();
const retries = new Map<string, number>();
const prisma = new PrismaClient();
const logger = pino({ level: 'debug' });

const RECONNECT_INTERVAL = Number(process.env.RECONNECT_INTERVAL || 0);
const MAX_RECONNECT_RETRIES = Number(process.env.MAX_RECONNECT_RETRIES || 0);

type WASessionOptions = {
  sessionId: string;
  res?: Response;
  sse?: boolean;
  socketConfig?: SocketConfig;
};

export class WASession {
  private readonly sessionId: string;
  private readonly socketConfig?: SocketConfig;
  private res?: Response;
  private sse?: boolean;
  private connectionState: Partial<ConnectionState> = { connection: 'close' };

  constructor({ sessionId, res, sse = false, socketConfig }: WASessionOptions) {
    this.sessionId = sessionId;
    this.socketConfig = socketConfig;
    this.res = res;
    this.sse = sse;
    this.connect();
  }

  private async connect() {
    const { state, saveCreds } = await useSession(this.sessionId);
    const socket = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: true,
      browser: Browsers.ubuntu('Chrome'),
      ...this.socketConfig,
      getMessage: async (key) => {
        const data = await prisma.message.findFirst({
          where: { remoteJid: key.remoteJid!, id: key.id!, sessionId: this.sessionId },
        });
        return (data || undefined) as proto.IMessage | undefined;
      },
    });

    const store = new Store(this.sessionId, socket.ev);
    sessions.set(this.sessionId, { ...socket, store });

    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', (update) => {
      this.connectionState = update;
      const { connection } = update;

      if (connection === 'open') retries.delete(this.sessionId);
      if (connection === 'close') this.handleConnectionClose();
    });
  }

  private handleConnectionClose() {
    const code = (this.connectionState.lastDisconnect?.error as Boom)?.output?.statusCode;
    if (code === DisconnectReason.loggedOut || !shouldReconnect(this.sessionId)) {
      return deleteSession(this.sessionId);
    }
    setTimeout(this.connect, code === DisconnectReason.restartRequired ? 0 : RECONNECT_INTERVAL);
  }
}

export function init() {
  initStore({ prisma, logger });
}

function shouldReconnect(sessionId: string) {
  let attempts = retries.get(sessionId) ?? 0;

  if (attempts < MAX_RECONNECT_RETRIES) {
    attempts += 1;
    logger.info({ attempts, sessionId }, 'Reconnecting...');
    retries.set(sessionId, attempts);

    return true;
  }
  return false;
}

export function deleteSession(sessionId: string) {
  sessions.delete(sessionId);
}
