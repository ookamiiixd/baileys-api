import axios from 'axios';
import type { RequestHandler } from 'express';
import { logger, prisma } from '../shared';
import { getSession } from '../wa';
import { makePhotoURLHandler } from './misc';

export const list: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { cursor = undefined, limit = 25 } = req.query;
    const groups = await prisma.contact.findMany({
      cursor: cursor ? { pkId: Number(cursor) } : undefined,
      take: Number(limit),
      skip: cursor ? 1 : 0,
      where: { id: { endsWith: 'g.us' }, sessionId },
    });

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
    const session = getSession(sessionId)!;
    const data = await session.groupMetadata(jid);
    res.status(200).json(data);
  } catch (e) {
    const message = 'An error occured during group metadata fetch';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const photo = makePhotoURLHandler('group');

export const inviteCode: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jid } = req.body;
    const session = getSession(sessionId)!;
    const data = await session.groupInviteCode(jid);
    res.status(200).json({ success: true, link: 'https://chat.whatsapp.com/' + data });
  } catch (e) {
    const message = 'An error occured during get invite code';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const groupFetchAllParticipating: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = getSession(sessionId)!;
    const data = await session.groupFetchAllParticipating();
    res.status(200).json({ success: true, data: data });
  } catch (e) {
    const message = 'An error occured during fetch all participants';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const updateSubject: RequestHandler = async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const { subject } = req.body;
    const session = getSession(sessionId)!;
    const data = await session.groupUpdateSubject(jid, subject);
    res.status(200).json({ success: true, data: data });
  } catch (e) {
    const message = 'An error occured during update group subject';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const updateDescription: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jid, description } = req.body;
    const session = getSession(sessionId)!;
    const data = await session.groupUpdateDescription(jid, description);
    res.status(200).json({ success: true, data: data });
  } catch (e) {
    const message = 'An error occured during update group description';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const updateSetting: RequestHandler = async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const { action } = req.body;
    const session = getSession(sessionId)!;
    const data = await session.groupSettingUpdate(jid, action);
    res.status(200).json({ success: true, data: data });
  } catch (e) {
    const message = 'An error occured during update group setting';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const updatePicture: RequestHandler = async (req, res) => {
  try {
    const { sessionId, jid } = req.params;
    const { url } = req.body;
    const session = getSession(sessionId)!;
    const img = await axios.get(url, { responseType: 'arraybuffer' });
    const data = await session.updateProfilePicture(jid, img.data);
    res.status(200).json({ success: true, data: data });
  } catch (e) {
    const message = 'An error occured during update group picture';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const groupCreate: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, users } = req.body;
    const session = getSession(sessionId)!;
    const data = await session.groupCreate(name, users.map(getWhatsAppId));
    res.status(200).json({ success: true, data: data });
  } catch (e) {
    const message = 'An error occured during create a new group';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

export const groupParticipantsUpdate: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jid, action, users } = req.body;
    const session = getSession(sessionId)!;
    const data = await session.groupParticipantsUpdate(jid, parseParticipants(users), action);
    res.status(200).json({ success: true, data: data });
  } catch (e) {
    const message = 'An error occured during create a new group';
    logger.error(e, message);
    res.status(500).json({ error: message });
  }
};

const getWhatsAppId = (id: any) => {
  if (id.includes('@g.us') || id.includes('@s.whatsapp.net')) return id;
  return id.includes('-') ? `${id}@g.us` : `${id}@s.whatsapp.net`;
};

const parseParticipants = (users: any) => {
  return users.map((users: any) => getWhatsAppId(users));
};
