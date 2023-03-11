import { DisconnectReason } from '@adiwajshing/baileys';
import { Boom } from '@hapi/boom';
import type { RequestHandler } from 'express';
import { logger, prisma } from '../shared';
import { Session, SESSION_CONFIG_ID } from '../wa';

export const list: RequestHandler = (req, res) => {
  res.status(200).json(Session.list());
};

export const find: RequestHandler = (req, res) =>
  res.status(200).json({ message: 'Session found' });

export const status: RequestHandler = (req, res) => {
  const session = Session.get(req.params.sessionId)!;
  res.status(200).json({ status: session.status() });
};

export const qr: RequestHandler = (req, res) => {
  const session = Session.get(req.params.sessionId)!;
  res.status(200).json({ qr: session.QR() });
};

export const add: RequestHandler = async (req, res) => {
  const { sessionId, readIncomingMessages, proxy, webhook, ...socketConfig } = req.body;

  if (Session.exists(sessionId)) return res.status(400).json({ error: 'Session already exists' });
  Session.create({ sessionId, res, readIncomingMessages, proxy, webhook, socketConfig });
};

export const update: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { readIncomingMessages, proxy, webhook, ...socketConfig } = req.body;
    const session = Session.get(sessionId)!;

    await prisma.session.update({
      data: { data: JSON.stringify({ readIncomingMessages, proxy, webhook, ...socketConfig }) },
      where: { sessionId_id: { id: `${SESSION_CONFIG_ID}-${sessionId}`, sessionId } },
    });
    session.socket.end(
      new Boom('Restarting session', { statusCode: DisconnectReason.restartRequired })
    );
    res.status(200).json({ message: 'Session updated' });
  } catch (e) {
    const message = 'An error occured during session update';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const addSSE: RequestHandler = async (req, res) => {
  const { sessionId } = req.params;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  if (Session.exists(sessionId)) {
    res.write(`data: ${JSON.stringify({ error: 'Session already exists' })}\n\n`);
    res.end();
    return;
  }
  Session.create({ sessionId, res, SSE: true });
};

export const del: RequestHandler = async (req, res) => {
  await Session.delete(req.params.sessionId);
  res.status(200).json({ message: 'Session deleted' });
};
