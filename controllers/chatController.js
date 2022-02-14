import { getSession, getChatList, formatPhone } from './../whatsapp.js'
import response from './../response.js'

const getList = (req, res) => {
    return response(res, 200, true, '', getChatList(res.locals.sessionId))
}

const send = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const receiver = formatPhone(req.body.receiver)
    const { message } = req.body

    try {
        const [isExists] = await session.onWhatsApp(receiver)

        if (!isExists.exists) {
            return response(res, 400, false, 'The receiver number is not exists.')
        }

        await session.sendMessage(receiver, { text: message })

        response(res, 200, true, 'The message has been successfully sent.')
    } catch {
        response(res, 500, false, 'Failed to send the message.')
    }
}

const sendBulk = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const errors = []

    for (const [key, data] of req.body.entries()) {
        if (!data.receiver || !data.message) {
            errors.push(key)

            continue
        }

        data.receiver = formatPhone(data.receiver)

        try {
            const [isExists] = await session.onWhatsApp(data.receiver)

            if (!isExists.exists) {
                errors.push(key)

                continue
            }

            await session.sendMessage(data.receiver, { text: data.message })
        } catch {
            errors.push(key)
        }
    }

    if (errors.length === 0) {
        return response(res, 200, true, 'All messages has been successfully sent.')
    }

    const isAllFailed = errors.length === req.body.length

    response(
        res,
        isAllFailed ? 500 : 200,
        !isAllFailed,
        isAllFailed ? 'Failed to send all messages.' : 'Some messages has been successfully sent.',
        { errors }
    )
}

export { getList, send, sendBulk }
