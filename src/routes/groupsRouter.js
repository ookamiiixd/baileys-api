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
    '/group-add',
    body('sender').notEmpty(),
    body('groupId').notEmpty(),
    body('members').notEmpty(),
    controller.groupAdd
)

module.exports = router