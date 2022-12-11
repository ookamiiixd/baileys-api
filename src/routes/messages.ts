import { Router } from 'express';
import { body, query } from 'express-validator';
import * as controller from '../controllers/message';
import requestValidator from '../middlewares/request-validator';

const router = Router({ mergeParams: true });
router.get(
  '/',
  query('cursor').isString().optional(),
  query('limit').isNumeric().optional(),
  requestValidator,
  controller.list
);
router.post(
  '/send',
  body('jid').isString().notEmpty(),
  body('type').isString().isIn(['group', 'number']).optional(),
  body('message').isObject().notEmpty(),
  body('options').isObject().optional(),
  requestValidator,
  controller.send
);
router.post('/send-bulk', body().isArray().notEmpty(), requestValidator, controller.sendBulk);

export default router;
