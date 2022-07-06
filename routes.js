import { Router } from 'express'
import sessionsRoute from './routes/sessionsRoute.js'
import chatsRoute from './routes/chatsRoute.js'
import groupsRoute from './routes/groupsRoute.js'
import checkRoute from './routes/checkRoute.js'

import response from './response.js'

const router = Router()

router.use('/sessions', sessionsRoute)
router.use('/chats', chatsRoute)
router.use('/groups', groupsRoute)

//Added By KingRao
router.use('/check', checkRoute)

router.all('*', (req, res) => {
    response(res, 404, false, 'The requested url cannot be found.')
})

export default router
