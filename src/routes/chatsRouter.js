const router = require('express').Router(),
{ query, body } = require('express-validator'),
controller = require('./../controllers/chatsController')

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

module.exports = router