const router = require('express').Router(),
{ body } = require('express-validator'),
controller = require('./controller')

router.get('/', controller.index)

router.post(
    '/send-message',
    body('sender').notEmpty(),
    body('receiver').notEmpty(),
    body('message').notEmpty(),
    controller.sendMessage
)

module.exports = router