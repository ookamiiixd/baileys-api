import { Router } from 'express'
import sessionValidator from '../middlewares/sessionValidator.js'
import * as controller from '../controllers/checkController.js'

const router = Router()

router.get('/photo/:id/:phone', sessionValidator, controller.pp_Url)

router.get('/number/:id/:phone', sessionValidator, controller.checkPhone)


export default router
