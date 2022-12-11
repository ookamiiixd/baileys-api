import { Router } from 'express';
import { list } from '../controllers/chat';
import { find } from '../controllers/message';
import requestValidator from '../middlewares/request-validator';
import { query } from 'express-validator';

const router = Router({ mergeParams: true });
router.get(
  '/',
  query('cursor').isString().optional(),
  query('limit').isNumeric().optional(),
  requestValidator,
  list
);
router.get(
  '/:jid',
  query('cursor').isString().optional(),
  query('limit').isNumeric().optional(),
  requestValidator,
  find
);

export default router;
