import type { RequestHandler } from 'express';
import { logger } from '../shared';
import { getSession, jidExists } from '../wa';

export const checkJid: RequestHandler = async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const { type = 'number' } = req.query;
    const session = getSession(sessionId)!;
    const exists = await jidExists(session, jid, type as any);
    res.status(200).json({ exists });
  } catch (e) {
    const message = 'An error occured during jid check';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};
