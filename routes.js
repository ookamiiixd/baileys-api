import { Router } from 'express'
import sessionRoutes from './routes/sessionRoutes.js'
import chatRoutes from './routes/chatRoutes.js'
import groupRoutes from './routes/groupRoutes.js'
import response from './response.js'
import messageRoutes from './routes/messageRoutes.js'

const router = Router()

router.use('/session', sessionRoutes)
router.use('/chat', chatRoutes)
router.use('/group', groupRoutes)
router.use('/message', messageRoutes)

router.all('*', (req, res) => {
    response(res, 404, false, 'The requested url cannot be found.')
})

export default router
