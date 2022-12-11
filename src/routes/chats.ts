import { Router } from 'express';
import { list } from '../controllers/chat';
import { find } from '../controllers/message';
import sessionValidator from '../middlewares/session-validator';
import requestValidator from '../middlewares/request-validator';
import { query } from 'express-validator';

const router = Router();
router.get(
  '/',
  sessionValidator,
  query('cursor').isString(),
  query('limit').isNumeric(),
  requestValidator,
  list
);
router.get(
  '/:jid',
  sessionValidator,
  query('cursor').isString(),
  query('limit').isNumeric(),
  requestValidator,
  find
);

export default router;
