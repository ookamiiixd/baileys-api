import { Router } from 'express'
import { body, query } from 'express-validator'
import requestValidator from './../middlewares/requestValidator.js'
import sessionValidator from './../middlewares/sessionValidator.js'
import * as controller from './../controllers/groupController.js'
import getMessages from './../controllers/getMessages.js'

const router = Router()

router.get('/get', query('id').notEmpty(), requestValidator, sessionValidator, controller.getList)

router.get('/get/:jid', query('id').notEmpty(), requestValidator, sessionValidator, getMessages)

router.post(
    '/create',
    query('id').notEmpty(),
    body('name').notEmpty(),
    body('members').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.groupCreate
)

router.post(
    '/participants-update',
    query('id').notEmpty(),
    body('action').notEmpty(),
    body('groupId').notEmpty(),
    body('members').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.groupParticipantsUpdate
)

router.post(
    '/subject-update',
    query('id').notEmpty(),
    body('subject').notEmpty(),
    body('groupId').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.groupUpdateSubject
)

router.post(
    '/description-update',
    query('id').notEmpty(),
    body('description').notEmpty(),
    body('groupId').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.groupUpdateDescription
)

router.post(
    '/setting-update',
    query('id').notEmpty(),
    body('settings').notEmpty(),
    body('groupId').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.groupSettingUpdate
)

router.post(
    '/leave',
    query('id').notEmpty(),
    body('groupId').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.groupLeave
)

router.post(
    '/invite-code',
    query('id').notEmpty(),
    body('groupId').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.groupInviteCode
)

router.post(
    '/revoke-code',
    query('id').notEmpty(),
    body('groupId').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.groupRevokeInvite
)

router.get(
    '/meta-data',
    query('id').notEmpty(),
    body('groupId').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.groupMetadata
)

router.post(
    '/accept-invite',
    query('id').notEmpty(),
    body('invite').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.groupAcceptInvite
)

router.post(
    '/profile-picture',
    query('id').notEmpty(),
    body('url').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.updateProfilePicture
)


export default router
