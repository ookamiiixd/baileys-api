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

router.delete(
    '/',
    body('session').notEmpty(),
    controller.destroySession
)

module.exports = router