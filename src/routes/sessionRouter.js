const router = require('express').Router(),
{ query, body } = require('express-validator'),
controller = require('./../controllers/sessionController')

router.get(
    '/',
    controller.getActiveSessions
)

router.post(
    '/',
    body('session').notEmpty(),
    controller.createSession
)

module.exports = router