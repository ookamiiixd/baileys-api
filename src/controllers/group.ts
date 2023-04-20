import { serializePrisma } from '@ookamiiixd/baileys-store';
import type { RequestHandler } from 'express';
import { logger, prisma } from '../shared';
import { Session } from '../wa';
import { makePhotoURLHandler } from './misc';

export const list: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { cursor = undefined, limit = 25 } = req.query;
    const groups = (
      await prisma.contact.findMany({
        cursor: cursor ? { pkId: Number(cursor) } : undefined,
        take: Number(limit),
        skip: cursor ? 1 : 0,
        where: { id: { endsWith: 'g.us' }, sessionId },
      })
    ).map((m) => serializePrisma(m));

    res.status(200).json({
      data: groups,
      cursor:
        groups.length !== 0 && groups.length === Number(limit)
          ? groups[groups.length - 1].pkId
          : null,
    });
  } catch (e) {
    const message = 'An error occured during group list';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const find: RequestHandler = async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const session = Session.get(sessionId)!;
    const data = await session.socket.groupMetadata(jid);
    res.status(200).json(data);
  } catch (e) {
    const message = 'An error occured during group metadata fetch';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const create: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, participants } = req.body;
    const session = Session.get(sessionId)!;

    await session.socket.groupCreate(name, participants);
    res.status(200).json({ message: 'Group created' });
  } catch (e) {
    const message = 'An error occured during group create';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const leave: RequestHandler = async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const session = Session.get(sessionId)!;

    await session.socket.groupLeave(jid);
    res.status(200).json({ message: 'Group left' });
  } catch (e) {
    const message = 'An error occured during group leave';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const update: RequestHandler = async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const { name, description, mode, profilePicture } = req.body;
    const session = Session.get(sessionId)!;

    if (name) await session.socket.groupUpdateSubject(jid, name);
    if (description) await session.socket.groupUpdateDescription(jid, description);
    if (mode) await session.socket.groupSettingUpdate(jid, mode);
    if (profilePicture) await session.socket.updateProfilePicture(jid, { url: profilePicture });
    res.status(200).json({ message: 'Group updated' });
  } catch (e) {
    const message = 'An error occured during group update';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const updateParticipants: RequestHandler = async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const { participants, action } = req.body;
    const session = Session.get(sessionId)!;

    await session.socket.groupParticipantsUpdate(jid, participants, action);
    res.status(200).json({ message: 'Group participants updated' });
  } catch (e) {
    const message = 'An error occured during group participants update';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const inviteCode: RequestHandler = async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const { revoke } = req.query;
    const session = Session.get(sessionId)!;

    const code = await session.socket[revoke ? 'groupRevokeInvite' : 'groupInviteCode'](jid);
    res.status(200).json({ code });
  } catch (e) {
    const message = 'An error occured during group invite code fetch';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const photo = makePhotoURLHandler('group');
