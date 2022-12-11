import { Router } from 'express';
import sessionRoutes from './sessions';
import chatRoutes from './chats';
import groupRoutes from './groups';
import messageRoutes from './messages';
import miscRoutes from './misc';

const router = Router();
router.use('/sessions', sessionRoutes);
router.use('/:sessionId/chats', chatRoutes);
router.use('/:sessionId/groups', groupRoutes);
router.use('/:sessionId/messages', messageRoutes);
router.use('/:sessionId/misc', miscRoutes);

export default router;
