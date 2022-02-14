import { getSession } from '../whatsapp.js'
import response from './../response.js'

const getMessages = async (req, res) => {
    const session = getSession(res.locals.sessionId)

    /* eslint-disable camelcase */
    const { jid } = req.params
    const { limit = 25, cursor_id = null } = req.query

    const cursor = {}

    if (cursor_id) {
        cursor.before = { id: cursor_id }
    }
    /* eslint-enable camelcase */

    try {
        const messages = await session.store.loadMessages(jid, limit, 'before' in cursor ? cursor : null)

        response(res, 200, true, '', messages)
    } catch {
        response(res, 500, false, 'Failed to load messages.')
    }
}

export default getMessages
