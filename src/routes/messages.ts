import { Router } from 'express';
import { body, query } from 'express-validator';
import * as controller from '../controllers/message';
import requestValidator from '../middlewares/request-validator';
import sessionValidator from '../middlewares/session-validator';

const router = Router({ mergeParams: true });
router.get(
  '/',
  query('cursor').isInt().optional(),
  query('limit').isInt().optional(),
  requestValidator,
  controller.list
);
router.post(
  '/send',
  body('jid').isString().notEmpty(),
  body('type').isIn(['group', 'number']).optional(),
  body('message').isObject().notEmpty(),
  body('options').isObject().optional(),
  requestValidator,
  sessionValidator,
  controller.send
);
router.post(
  '/send/bulk',
  body().isArray({ min: 1 }),
  body('*.jid').isString().notEmpty(),
  body('*.type').isIn(['group', 'number']).optional(),
  body('*.message').isObject().notEmpty(),
  body('*.options').isObject().optional(),
  body('*.delay').isInt().optional(),
  requestValidator,
  sessionValidator,
  controller.sendBulk
);
router.post(
  '/download',
  body().isObject().notEmpty(),
  requestValidator,
  sessionValidator,
  controller.download
);

export default router;
