import { Router } from 'express';
import { body, query } from 'express-validator';
import * as controller from '../controllers/group';
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
router.get('/:jid', sessionValidator, controller.find);
router.get('/:jid/photo', sessionValidator, controller.photo);
router.post(
  '/',
  body('name').isString().notEmpty(),
  body('participants').isArray({ min: 1 }),
  body('participants.*').isString().notEmpty(),
  requestValidator,
  sessionValidator,
  controller.create
);
router.post(
  '/:jid',
  body('name').isString().notEmpty().optional(),
  body('description').isString().notEmpty().optional(),
  body('mode').isIn(['announcement', 'not_announcement', 'unlocked', 'locked']).optional(),
  body('profilePicture').isString().notEmpty().optional(),
  requestValidator,
  sessionValidator,
  controller.update
);
router.delete('/:jid', sessionValidator, controller.leave);
router.post(
  '/:jid/participants',
  body('participants').isArray({ min: 1 }),
  body('participants.*').isString().notEmpty(),
  body('action').isIn(['add', 'demote', 'promote', 'remove']),
  requestValidator,
  sessionValidator,
  controller.updateParticipants
);
router.get('/:jid/invite-code', sessionValidator, controller.inviteCode);

export default router;
