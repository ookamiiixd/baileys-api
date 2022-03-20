import { Router } from 'express'
import { query } from 'express-validator'
import requestValidator from './../middlewares/requestValidator.js'
import sessionValidator from './../middlewares/sessionValidator.js'
import * as controller from './../controllers/chatController.js'
import getMessages from './../controllers/getMessages.js'

const router = Router()

router.get('/get', query('id').notEmpty(), requestValidator, sessionValidator, controller.getList)

router.get('/get/:jid', query('id').notEmpty(), requestValidator, sessionValidator, getMessages)

export default router
