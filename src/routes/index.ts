import { Router } from 'express';
import sessionRoutes from './sessions';

const router = Router();
router.use('/sessions', sessionRoutes);
router.all('*', (req, res) => res.status(404).json({ error: 'URL not found' }));

export default router;
