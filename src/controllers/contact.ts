import { serializePrisma } from '@ookamiiixd/baileys-store';
import type { RequestHandler } from 'express';
import { logger, prisma } from '../shared';
import { Session } from '../wa';
import { makePhotoURLHandler } from './misc';

export const list: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { cursor = undefined, limit = 25 } = req.query;
    const contacts = (
      await prisma.contact.findMany({
        cursor: cursor ? { pkId: Number(cursor) } : undefined,
        take: Number(limit),
        skip: cursor ? 1 : 0,
        where: { id: { endsWith: 's.whatsapp.net' }, sessionId },
      })
    ).map((m) => serializePrisma(m));

    res.status(200).json({
      data: contacts,
      cursor:
        contacts.length !== 0 && contacts.length === Number(limit)
          ? contacts[contacts.length - 1].pkId
          : null,
    });
  } catch (e) {
    const message = 'An error occured during contact list';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const listBlocked: RequestHandler = async (req, res) => {
  try {
    const session = Session.get(req.params.sessionId)!;
    const data = await session.socket.fetchBlocklist();
    res.status(200).json(data);
  } catch (e) {
    const message = 'An error occured during blocklist fetch';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const updateBlock: RequestHandler = async (req, res) => {
  try {
    const session = Session.get(req.params.sessionId)!;
    const { jid, action } = req.body;

    const exists = await session.jidExists(jid);
    if (!exists) return res.status(400).json({ error: 'Jid does not exists' });

    await session.socket.updateBlockStatus(jid, action);
    res.status(200).json({ message: `Contact ${action}ed` });
  } catch (e) {
    const message = 'An error occured during blocklist update';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const check: RequestHandler = async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const session = Session.get(sessionId)!;

    const exists = await session.jidExists(jid);
    res.status(200).json({ exists });
  } catch (e) {
    const message = 'An error occured during jid check';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const photo = makePhotoURLHandler();
