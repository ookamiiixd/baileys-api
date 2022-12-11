import type { RequestHandler } from 'express';
import { delay as delayMs } from '@adiwajshing/baileys';
import { logger, prisma } from '../shared';
import { getSession, jidExists } from '../wa';
import { serializePrisma } from 'baileys-store';

export const send: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jid, type = 'number', message, options } = req.body;
    const session = getSession(sessionId)!;

    const exists = await jidExists(session, jid, type);
    if (!exists) return res.status(400).json({ error: 'JID does not exist' });

    const result = await session.sendMessage(jid, message, options);
    res.status(200).json(result);
  } catch (e) {
    const message = 'An error occured during message send';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const sendBulk: RequestHandler = async (req, res) => {
  const { sessionId } = req.params;
  const session = getSession(sessionId)!;
  const results: { index: number; result: any }[] = [];
  const errors: { index: number; error: string }[] = [];

  for (const [
    index,
    { jid, type = 'number', delay = 2500, message, options },
  ] of req.body.entries()) {
    try {
      const exists = await jidExists(session, jid, type);
      if (!exists) {
        errors.push({ index, error: 'JID does not exist' });
        continue;
      }

      if (index > 0) await delayMs(delay);
      const result = await session.sendMessage(jid, message, options);
      results.push({ index, result });
    } catch (e) {
      const message = 'An error occured during message send';
      logger.error(e, message);
      errors.push({ index, error: message });
    }
  }

  res
    .status(req.body.length !== 0 && errors.length === req.body.length ? 500 : 200)
    .json({ results, errors });
};

export const list: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { cursor = undefined, limit = 25 } = req.query;
    const messages = (
      await prisma.message.findMany({
        cursor: cursor ? { pkId: Number(cursor) } : undefined,
        take: Number(limit),
        skip: cursor ? 1 : 0,
        where: { sessionId },
      })
    ).map((m) => serializePrisma(m));

    res.status(200).json({
      data: messages,
      cursor: messages.length ? messages[messages.length - 1].pkId : null,
    });
  } catch (e) {
    const message = 'An error occured during message list';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const find: RequestHandler = async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const { cursor = undefined, limit = 25 } = req.query;
    const messages = (
      await prisma.message.findMany({
        cursor: cursor
          ? { sessionId_remoteJid_id: { id: cursor as string, remoteJid: jid, sessionId } }
          : undefined,
        take: Number(limit),
        skip: cursor ? 1 : 0,
        where: { sessionId },
        orderBy: { messageTimestamp: 'desc' },
      })
    ).map((m) => serializePrisma(m));

    res
      .status(200)
      .json({ data: messages, cursor: messages.length ? messages[messages.length - 1].id : null });
  } catch (e) {
    const message = 'An error occured during message find';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};
