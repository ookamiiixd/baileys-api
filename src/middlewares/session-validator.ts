import type { RequestHandler } from 'express';
import { Session } from '../wa';

const validate: RequestHandler = (req, res, next) => {
  if (!Session.exists(req.params.sessionId))
    return res.status(404).json({ error: 'Session not found' });
  next();
};

export default validate;
