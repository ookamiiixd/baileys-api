import { Router } from 'express';
import { body, query } from 'express-validator';
import * as controller from '../controllers/message';
import requestValidator from '../middlewares/request-validator';
import sessionValidator from '../middlewares/session-validator';

const router = Router();
router.get(
  '/',
  sessionValidator,
  query('cursor').isString(),
  query('limit').isNumeric(),
  requestValidator,
  controller.list
);
router.post(
  '/send',
  sessionValidator,
  body('jid').isString().notEmpty(),
  body('type').isString().isIn(['group', 'number']),
  body('message').isObject().notEmpty(),
  body('options').isObject(),
  requestValidator,
  controller.send
);
router.post(
  '/send-bulk',
  sessionValidator,
  body().isArray().notEmpty(),
  requestValidator,
  controller.sendBulk
);

export default router;
