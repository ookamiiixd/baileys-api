const router = require('express').Router(),
{ query, body } = require('express-validator'),
controller = require('./../controllers/groupsController')

router.get(
    '/get',
    query('session').notEmpty(),
    controller.getChats
)

router.post(
    '/send',
    body('sender').notEmpty(),
    body('receiver').notEmpty(),
    body('message').notEmpty(),
    controller.sendMessage
)

router.post(
    '/group-create',
    body('sender').notEmpty(),
    body('name').notEmpty(),
    body('members').notEmpty(),
    controller.groupCreate
)

router.post(
    '/group-add-members',
    body('sender').notEmpty(),
    body('groupId').notEmpty(),
    body('members').notEmpty(),
    controller.groupAddMember
)

router.post(
    '/group-make-admin',
    body('sender').notEmpty(),
    body('groupId').notEmpty(),
    body('members').notEmpty(),
    controller.groupMakeAdmin
)

router.post(
    '/group-remove-admin',
    body('sender').notEmpty(),
    body('groupId').notEmpty(),
    body('members').notEmpty(),
    controller.groupRemoveAdmin
)

router.patch('/group-update-name',
    body('sender').notEmpty(),
    body('groupId').notEmpty(),
    body('name').notEmpty(),
    controller.groupUpdateName
)

router.patch('/group-setting-message',
    body('sender').notEmpty(),
    body('groupId').notEmpty(),
    body('value').notEmpty(),
    controller.groupSettingMessage
)

router.patch('/group-setting-change',
    body('sender').notEmpty(),
    body('groupId').notEmpty(),
    body('value').notEmpty(),
    controller.groupSettingChange
)

router.post('/group-leave',
    body('sender').notEmpty(),
    body('groupId').notEmpty(),
    controller.groupLeave
)

router.get('/group-invite-code',
    body('sender').notEmpty(),
    body('groupId').notEmpty(),
    controller.groupInviteCode
)

router.get('/group-meta-data',
    body('sender').notEmpty(),
    body('groupId').notEmpty(),
    controller.groupMetadata
)

module.exports = router