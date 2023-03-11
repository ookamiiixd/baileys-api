import { Router } from 'express';
import { query } from 'express-validator';
import * as controller from '../controllers/chat';
import requestValidator from '../middlewares/request-validator';

const router = Router({ mergeParams: true });
router.get(
  '/',
  query('cursor').isInt().optional(),
  query('limit').isInt().optional(),
  requestValidator,
  controller.list
);
router.get(
  '/:jid',
  query('cursor').isInt().optional(),
  query('limit').isInt().optional(),
  requestValidator,
  controller.find
);

export default router;
