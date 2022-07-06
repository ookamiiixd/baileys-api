import { Router } from 'express'
import sessionValidator from '../middlewares/sessionValidator.js'
import * as controller from '../controllers/settingController.js'

const router = Router()

router.get('/pic_url/:id/:phone', sessionValidator, controller.pp_Url)

router.get('/check/:id/:phone', sessionValidator, controller.checkPhone)


export default router
