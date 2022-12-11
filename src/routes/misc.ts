import { Router } from 'express';
import * as controller from '../controllers/misc';
import sessionValidator from '../middlewares/session-validator';
import requestValidator from '../middlewares/request-validator';
import { query } from 'express-validator';

const router = Router();
router.get(
  '/check-jid/:jid',
  sessionValidator,
  query('type').isString().isIn(['group', 'number']),
  requestValidator,
  controller.checkJid
);

export default router;
