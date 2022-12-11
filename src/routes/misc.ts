import { Router } from 'express';
import * as controller from '../controllers/misc';
import requestValidator from '../middlewares/request-validator';
import { query } from 'express-validator';

const router = Router({ mergeParams: true });
router.get(
  '/check-jid/:jid',
  query('type').isString().isIn(['group', 'number']).optional(),
  requestValidator,
  controller.checkJid
);

export default router;
