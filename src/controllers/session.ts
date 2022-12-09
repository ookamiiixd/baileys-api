import type { RequestHandler } from 'express';
import type { WebSocket } from 'ws';
import { logger } from '../shared';
import { createSession, getSession, sessionExists } from '../wa';

export const find: RequestHandler = (req, res) =>
  res.status(200).json({ message: 'Session found' });

export const status: RequestHandler = (req, res) => {
  const state = ['CONNECTING', 'CONNECTED', 'DISCONNECTING', 'DISCONNECTED'];
  const session = getSession(req.params.sessionId)!;
  let status = state[(session.ws as WebSocket).readyState];
  status = session.user ? 'AUTHENTICATED' : status;
  res.status(200).json({ status });
};

export const add: RequestHandler = async (req, res) => {
  const { sessionId, ...options } = req.body;
  if (sessionExists(sessionId)) return res.status(400).json({ error: 'Session already exists' });

  try {
    await createSession({ sessionId, res, socketConfig: options });
  } catch (e) {
    const message = 'An error occured during session create';
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

  if (sessionExists(sessionId)) {
    res.write(`data: ${JSON.stringify({ error: 'Session already exists' })}\n\n`);
    res.end();
    return;
  }

  try {
    await createSession({ sessionId, res, SSE: true });
  } catch (e) {
    const message = 'An error occured during session create';
    logger.error(e, message);
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
};

export const del: RequestHandler = async (req, res) => {
  const session = getSession(req.params.sessionId);
  await session?.destroy();
  res.status(200).json({ message: 'Session deleted' });
};
