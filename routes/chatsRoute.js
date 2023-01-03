import { Router } from 'express'
import { body, query } from 'express-validator'
import requestValidator from './../middlewares/requestValidator.js'
import sessionValidator from './../middlewares/sessionValidator.js'
import tokenValidator from './../middlewares/tokenValidator.js'
import * as controller from './../controllers/chatsController.js'
import getMessages from './../controllers/getMessages.js'

const router = Router()

router.get('/', query('id').notEmpty(), tokenValidator, requestValidator, sessionValidator, requestValidator, controller.getList)

router.get('/:jid', query('id').notEmpty(), tokenValidator, requestValidator, sessionValidator, requestValidator, getMessages)

router.post(
    '/send',
    query('id').notEmpty(),
    body('receiver').notEmpty(),
    body('message').notEmpty(),
    tokenValidator,
    requestValidator,
    sessionValidator,
    controller.send
)

router.post('/send-bulk', query('id').notEmpty(), tokenValidator, requestValidator, sessionValidator, controller.sendBulk)

export default router
