import { Router } from 'express';
import sessionValidator from '../middlewares/session-validator';
import sessionRoutes from './sessions';
import chatRoutes from './chats';
import groupRoutes from './groups';
import messageRoutes from './messages';
import miscRoutes from './misc';

const router = Router();
router.use('/sessions', sessionRoutes);
router.use('/:sessionId/chats', sessionValidator, chatRoutes);
router.use('/:sessionId/groups', sessionValidator, groupRoutes);
router.use('/:sessionId/messages', sessionValidator, messageRoutes);
router.use('/:sessionId/misc', sessionValidator, miscRoutes);

export default router;
