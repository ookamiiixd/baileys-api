import type { ConnectionState, proto, SocketConfig, WASocket } from '@adiwajshing/baileys';
import makeWASocket, { DisconnectReason, Browsers } from '@adiwajshing/baileys';
import type { Response } from 'express';
import { useSession, Store, initStore } from 'baileys-store';
import type { Boom } from '@hapi/boom';
import { toDataURL } from 'qrcode';
import { prisma, logger } from './shared';

const sessions = new Map<string, WASocket & { destroy: () => Promise<void>; store: Store }>();
const retries = new Map<string, number>();
const SSEQRGenerations = new Map<string, number>();

const RECONNECT_INTERVAL = Number(process.env.RECONNECT_INTERVAL || 0);
const MAX_RECONNECT_RETRIES = Number(process.env.MAX_RECONNECT_RETRIES || 0);
const SSE_MAX_QR_GENERATION = Number(process.env.SSE_MAX_QR_GENERATION || 1);
const SESSION_CONFIG_ID = 'session-config';

export async function init() {
  initStore({ prisma, logger });
  const sessions = await prisma.session.findMany({
    select: { sessionId: true, data: true },
    where: { id: { contains: SESSION_CONFIG_ID } },
  });

  for (const { sessionId, data } of sessions) {
    try {
      await createSession({ sessionId, socketConfig: JSON.parse(data) });
    } catch (e) {
      logger.error(e, 'An error occured during session create from init');
    }
  }
}

function shouldReconnect(sessionId: string) {
  let attempts = retries.get(sessionId) ?? 0;

  if (attempts < MAX_RECONNECT_RETRIES) {
    attempts += 1;
    retries.set(sessionId, attempts);
    return true;
  }
  return false;
}

type WASessionOptions = {
  sessionId: string;
  res?: Response;
  SSE?: boolean;
  socketConfig?: SocketConfig;
};

export async function createSession(options: WASessionOptions) {
  const { sessionId, res, SSE, socketConfig } = options;
  let connectionState: Partial<ConnectionState> = { connection: 'close' };

  const destroy = async () => {
    try {
      await socket.logout();
    } catch (e) {
      logger.error(e, 'An error occured during session destroy');
    } finally {
      sessions.delete(sessionId);
    }
  };

  const handleConnectionClose = () => {
    const code = (connectionState.lastDisconnect?.error as Boom)?.output?.statusCode;
    const restartRequired = code === DisconnectReason.restartRequired;
    const shouldLogout = !shouldReconnect(sessionId);

    if (code === DisconnectReason.loggedOut || shouldLogout) {
      res && res.end();
      shouldLogout && destroy();
      sessions.delete(sessionId);
      return;
    }
    !restartRequired &&
      logger.info({ attempts: retries.get(sessionId) ?? 1, sessionId }, 'Reconnecting...');
    setTimeout(() => createSession(options), restartRequired ? 0 : RECONNECT_INTERVAL);
  };

  const handleConnectionUpdate = async () => {
    if (!res) return;
    const qr = connectionState.qr ? await toDataURL(connectionState.qr) : undefined;
    const data = { ...connectionState, qr };
    const currentGenerations = SSEQRGenerations.get(sessionId) ?? 0;

    if (SSE && qr && currentGenerations >= SSE_MAX_QR_GENERATION) {
      res.end();
      destroy();
      return;
    }
    if (SSE) {
      if (qr) SSEQRGenerations.set(sessionId, currentGenerations + 1);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      return;
    }
    if (res.headersSent) return destroy();
    if (connectionState.qr) res.status(200).json(data);
  };

  const { state, saveCreds } = await useSession(sessionId);
  const socket = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true,
    browser: Browsers.ubuntu('Chrome'),
    ...socketConfig,
    getMessage: async (key) => {
      const data = await prisma.message.findFirst({
        where: { remoteJid: key.remoteJid!, id: key.id!, sessionId },
      });
      return (data || undefined) as proto.IMessage | undefined;
    },
  });

  const store = new Store(sessionId, socket.ev);
  sessions.set(sessionId, { ...socket, destroy, store });

  res?.on('close', () => res.end());
  socket.ev.on('creds.update', saveCreds);
  socket.ev.on('connection.update', (update) => {
    connectionState = update;
    const { connection } = update;

    if (connection === 'open') {
      retries.delete(sessionId);
      SSEQRGenerations.delete(sessionId);
    }
    if (connection === 'close') handleConnectionClose();
    handleConnectionUpdate();
  });

  const configID = `${SESSION_CONFIG_ID}-${sessionId}`;
  await prisma.session.upsert({
    create: { id: configID, sessionId, data: JSON.stringify(socketConfig || {}) },
    update: {},
    where: { sessionId_id: { id: configID, sessionId } },
  });
}

export function getSession(sessionId: string) {
  return sessions.get(sessionId);
}

export async function deleteSession(sessionId: string) {
  return sessions.get(sessionId)?.destroy();
}

export function sessionExists(sessionId: string) {
  return sessions.has(sessionId);
}
