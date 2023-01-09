import { Router } from 'express';
import { body, query } from 'express-validator';
import * as controller from '../controllers/group';
import requestValidator from '../middlewares/request-validator';
import sessionValidator from '../middlewares/session-validator';

const router = Router({ mergeParams: true });
router.get(
  '/',
  query('cursor').isNumeric().optional(),
  query('limit').isNumeric().optional(),
  requestValidator,
  controller.list
);
router.get('/:jid', sessionValidator, controller.find);
router.get('/:jid/photo', sessionValidator, controller.photo);
router.get('/group/invitecode', sessionValidator, controller.inviteCode);
router.get('/group/fetchallparticipating', sessionValidator, controller.groupFetchAllParticipating);
router.post(
  '/:jid/updatesubject',
  body('subject').isString().notEmpty(),
  requestValidator,
  sessionValidator,
  controller.updateSubject
);
router.post(
  '/:jid/updatedescription',
  body('description').isString().notEmpty(),
  requestValidator,
  sessionValidator,
  controller.updateDescription
);
router.post(
  '/:jid/updatesetting',
  body('action')
    .isString()
    .notEmpty()
    .isIn(['announcement', 'not_announcement', 'locked', 'unlocked']),
  requestValidator,
  sessionValidator,
  controller.updateSetting
);
router.post(
  '/:jid/updatepicture',
  body('url').isString().notEmpty(),
  requestValidator,
  sessionValidator,
  controller.updatePicture
);
router.post(
  '/group/create',
  body('name').isString().notEmpty(),
  body('users').isArray(),
  requestValidator,
  sessionValidator,
  controller.groupCreate
);
router.post(
  '/:jid/participantsupdate',
  body('users'),
  body('action').isString().notEmpty().isIn(['add', 'remove', 'demote', 'promote']),
  requestValidator,
  sessionValidator,
  controller.groupParticipantsUpdate
);

export default router;
