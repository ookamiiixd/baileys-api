import { getSession, getChatList, isExists, sendMessage, formatGroup, groupCreate } from './../whatsapp.js'
import response from './../response.js'

const getList = (req, res) => {
    return response(res, 200, true, '', getChatList(res.locals.sessionId, true))
}

const send = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const receiver = formatGroup(req.body.receiver)
    const { message } = req.body

    try {
        const exists = await isExists(session, receiver, true)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await sendMessage(session, receiver, message)

        response(res, 200, true, 'The message has been successfully sent.')
    } catch {
        response(res, 500, false, 'Failed to send the message.')
    }
}

const postGroupCreate = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    try {

        const group = await groupCreate(session, req.body)
        
        response(res, 200, true, 'The group was created successfully.', group)
    } catch {
        response(res, 500, false, 'Failed to create group.')
    }
}

export { getList, send, postGroupCreate }
