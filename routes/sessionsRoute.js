import { Router } from 'express'
import { body } from 'express-validator'
import requestValidator from './../middlewares/requestValidator.js'
import sessionValidator from './../middlewares/sessionValidator.js'
import tokenValidator from './../middlewares/tokenValidator.js'
import * as controller from './../controllers/sessionsController.js'

const router = Router()

router.get('/find/:id', tokenValidator, sessionValidator, controller.find)

router.get('/status/:id', tokenValidator, sessionValidator, controller.status)

router.post('/add', body('id').notEmpty(), body('isLegacy').notEmpty(), tokenValidator, requestValidator, controller.add)

router.delete('/delete/:id', tokenValidator, sessionValidator, controller.del)

export default router
