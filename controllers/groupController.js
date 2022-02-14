import { getSession, getChatList, formatGroup } from './../whatsapp.js'
import response from './../response.js'

const getList = (req, res) => {
    return response(res, 200, true, '', getChatList(res.locals.sessionId, true))
}

const send = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const receiver = formatGroup(req.body.receiver)
    const { message } = req.body

    try {
        const groupMeta = await session.groupMetadata(receiver)

        if (!groupMeta.id) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await session.sendMessage(receiver, { text: message })

        response(res, 200, true, 'The message has been successfully sent.')
    } catch {
        response(res, 500, false, 'Failed to send the message.')
    }
}

export { getList, send }
