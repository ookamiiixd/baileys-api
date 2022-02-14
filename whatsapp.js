import { existsSync, unlinkSync, readdir } from 'fs'
import { join } from 'path'
import makeWASocket, {
    Browsers,
    useSingleFileAuthState,
    makeInMemoryStore,
    DisconnectReason,
} from '@adiwajshing/baileys'
import { toDataURL } from 'qrcode'
import __dirname from './dirname.js'
import response from './response.js'

const sessions = new Map()
const retries = new Map()

const sessionsDir = (sessionId = '') => {
    return join(__dirname, 'sessions', sessionId ? `${sessionId}.json` : '')
}

const isSessionExists = (sessionId) => {
    return sessions.has(sessionId)
}

const isSessionFileExists = (name) => {
    return existsSync(sessionsDir(name))
}

const shouldReconnect = (sessionId) => {
    let maxRetries = parseInt(process.env.MAX_RETRIES ?? 0)
    let attempts = retries.get(sessionId) ?? 0

    maxRetries = maxRetries < 1 ? 1 : maxRetries

    if (attempts < maxRetries) {
        ++attempts

        console.log('Reconnecting...', { attempts, sessionId })
        retries.set(sessionId, attempts)

        return true
    }

    return false
}

const createSession = async (sessionId, res = null) => {
    const { state, saveState } = useSingleFileAuthState(sessionsDir(sessionId))
    const store = makeInMemoryStore({})

    /**
     * @type {ReturnType<makeWASocket>}
     */
    const wa = makeWASocket.default({
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.ubuntu('Chrome'),
    })

    store.readFromFile(sessionsDir(`${sessionId}_store`))
    store.bind(wa.ev)
    sessions.set(sessionId, { ...wa, store })

    wa.ev.on('creds.update', saveState)
    wa.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        const statusCode = lastDisconnect?.error?.output?.statusCode

        if (connection === 'open') {
            retries.delete(sessionId)
        }

        if (connection === 'close') {
            if (statusCode === DisconnectReason.loggedOut || !shouldReconnect(sessionId)) {
                if (res && !res.headersSent) {
                    response(res, 500, false, 'Unable to create session.')
                }

                return deleteSession(sessionId)
            }

            setTimeout(
                () => {
                    createSession(sessionId, res)
                },
                statusCode === DisconnectReason.restartRequired ? 0 : parseInt(process.env.RECONNECT_INTERVAL ?? 0)
            )
        }

        if (update.qr) {
            if (res && !res.headersSent) {
                try {
                    const qr = await toDataURL(update.qr)

                    response(res, 200, true, 'QR code received, please scan the QR code.', { qr })
                } catch {
                    response(res, 500, false, 'Unable to create QR code.')
                }

                return
            }

            try {
                await wa.logout()
            } catch {
            } finally {
                deleteSession(sessionId)
            }
        }
    })
}

/**
 * @returns {(ReturnType<makeWASocket>|null)}
 */
const getSession = (sessionId) => {
    return sessions.get(sessionId) ?? null
}

const deleteSession = (sessionId) => {
    if (isSessionFileExists(sessionId)) {
        unlinkSync(sessionsDir(sessionId))
    }

    if (isSessionFileExists(`${sessionId}_store`)) {
        unlinkSync(sessionsDir(`${sessionId}_store`))
    }

    sessions.delete(sessionId)
    retries.delete(sessionId)
}

const getChatList = (sessionId, isGroup = false) => {
    const filter = isGroup ? '@g.us' : '@s.whatsapp.net'

    return getSession(sessionId).store.chats.filter((chat) => {
        return chat.id.endsWith(filter)
    })
}

const formatPhone = (phone) => {
    if (phone.endsWith('@s.whatsapp.net')) {
        return phone
    }

    let formatted = phone.replace(/\D/g, '')

    return (formatted += '@s.whatsapp.net')
}

const formatGroup = (group) => {
    if (group.endsWith('@g.us')) {
        return group
    }

    let formatted = group.replace(/[^\d-]/g, '')

    return (formatted += '@g.us')
}

const cleanup = () => {
    console.log('Running cleanup before exit.')

    sessions.forEach((session, sessionId) => {
        session.store.writeToFile(sessionsDir(`${sessionId}_store`))
    })
}

const init = () => {
    readdir(sessionsDir(), (err, files) => {
        if (err) {
            throw err
        }

        for (const file of files) {
            if (file.endsWith('.json') && !file.includes('_store')) {
                createSession(file.replace('.json', ''))
            }
        }
    })
}

export {
    isSessionExists,
    createSession,
    getSession,
    deleteSession,
    getChatList,
    formatPhone,
    formatGroup,
    cleanup,
    init,
}
