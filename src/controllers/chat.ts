import type { RequestHandler } from 'express';
import { logger, prisma } from '../shared';

export const list: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { cursor = undefined, limit = 25 } = req.query;
    const chats = await prisma.chat.findMany({
      cursor: cursor ? { sessionId_id: { id: cursor as string, sessionId } } : undefined,
      take: Number(limit),
      skip: cursor ? 1 : 0,
    });

    res.status(200).json({ data: chats, cursor: chats.length ? chats[chats.length - 1].id : null });
  } catch (e) {
    const message = 'An error occured during chat list';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};
