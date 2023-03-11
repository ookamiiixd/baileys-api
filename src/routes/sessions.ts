import { Router } from 'express';
import { body, oneOf } from 'express-validator';
import * as controller from '../controllers/session';
import requestValidator from '../middlewares/request-validator';
import sessionValidator from '../middlewares/session-validator';

const sessionRules = [
  body('readIncomingMessages').isBoolean().optional(),
  body('proxy').isString().notEmpty().optional(),
  body('webhook').isObject().optional(),
  oneOf([
    body('webhook.url').if(body('webhook').exists()).isString().notEmpty(),
    [
      body('webhook.url').if(body('webhook').exists()).isArray({ min: 1 }),
      body('webhook.url.*').isString().notEmpty(),
    ],
  ]),
  oneOf([
    body('webhook.events').if(body('webhook').exists()).equals('all'),
    [
      body('webhook.events').if(body('webhook').exists()).isArray({ min: 1 }),
      body('webhook.events.*').isString().notEmpty(),
    ],
  ]),
];

const router = Router();
router.get('/', controller.list);
router.get('/:sessionId', sessionValidator, controller.find);
router.get('/:sessionId/status', sessionValidator, controller.status);
router.get('/:sessionId/qr', sessionValidator, controller.qr);
router.post(
  '/add',
  body('sessionId').isString().notEmpty(),
  ...sessionRules,
  requestValidator,
  controller.add
);
router.get('/:sessionId/add-sse', controller.addSSE);
router.patch('/:sessionId', ...sessionRules, requestValidator, sessionValidator, controller.update);
router.delete('/:sessionId', sessionValidator, controller.del);

export default router;
