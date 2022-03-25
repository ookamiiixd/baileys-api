import { existsSync, unlinkSync, readdir } from 'fs'
import { join } from 'path'
import makeWASocket, {
    makeWALegacySocket,
    useSingleFileAuthState,
    useSingleFileLegacyAuthState,
    makeInMemoryStore,
    Browsers,
    DisconnectReason,
    delay,
} from '@adiwajshing/baileys'
import { toDataURL } from 'qrcode'
import __dirname from './dirname.js'
import response from './response.js'
import { webhook } from './services/webhook.js'
import { makeWSClient } from './services/websocket.js'
import { downloadImage } from './config/download.js'
import { userInfo } from 'os'

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
    let maxRetries = parseInt(process.env.MAX_RETRIES ?? 5)
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

// CREATE A WEBSOCKET IF PROTOCOL IS DEFINED AS websocket
// BY DEFAULT webhook IS SET
const protocol = process.env.PROTOCOL ?? 'webhook'
const socket = protocol === 'websocket' ? makeWSClient() : null

const createSession = async (sessionId, isLegacy = false, res = null) => {
    const sessionFile = (isLegacy ? 'legacy_' : 'md_') + sessionId

    const store = makeInMemoryStore({})
    const { state, saveState } = isLegacy
        ? useSingleFileLegacyAuthState(sessionsDir(sessionFile))
        : useSingleFileAuthState(sessionsDir(sessionFile))

    /**
     * @type {(import('@adiwajshing/baileys').LegacySocketConfig|import('@adiwajshing/baileys').SocketConfig)}
     */
    const waConfig = {
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.ubuntu('Chrome'),
    }

    /**
     * @type {import('@adiwajshing/baileys').AnyWASocket}
     */
    const wa = isLegacy ? makeWALegacySocket(waConfig) : makeWASocket.default(waConfig)

    if (!isLegacy) {
        store.readFromFile(sessionsDir(`${sessionId}_store`))
        store.bind(wa.ev)
    }

    sessions.set(sessionId, { ...wa, store, isLegacy })

    wa.ev.on('creds.update', saveState)

    wa.ev.on('chats.set', ({ chats }) => {
        if (isLegacy) {
            store.chats.insertIfAbsent(...chats)
        }
    })

    wa.ev.on('groups.update', async (chats) => {
        // WEBHOOK
        webhook(sessionId, 'groups', chats)
    })

    wa.ev.on('group-participants.update', async (chats) => {
        // WEBHOOK
        webhook(sessionId, 'participants', chats)
    })

    wa.ev.on('messages.upsert', async (m) => {
        // WEBHOOK
        webhook(sessionId, 'messages/upsert', m)

        const message = m.messages[0]

        if (!message.key.fromMe && m.type === 'notify') {
            await delay(1000)

            if (isLegacy) {
                await wa.chatRead(message.key, 1)
            } else {
                await wa.sendReadReceipt(message.key.remoteJid, message.key.participant, [message.key.id])
            }
        }
    })

    wa.ev.on('connection.update', async (update) => {
        // WEBHOOK
        // webhook(sessionId, 'connection/update', update)

        const { connection, lastDisconnect } = update
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const userInfo = wa?.user

        if (connection === 'open') {
            const data = Object.assign(update, userInfo)
            switch (protocol) {
                case 'webhook':
                    webhook(sessionId, 'connection/open', data)
                    break
                case 'websocket':
                    socket.send(
                        JSON.stringify({
                            event: 'wa:connection_open',
                            sessionId,
                            data
                        })
                    )
                    break
                default:
            }

            retries.delete(sessionId)
        }

        if (connection === 'connecting') {
            switch (protocol) {
                case 'webhook':
                    webhook(sessionId, 'connection/connecting', update)
                    break
                case 'websocket':
                    socket.send(
                        JSON.stringify({
                            event: 'wa:connection_connecting',
                            sessionId,
                            update,
                        })
                    )
                    break
                default:
            }
        }

        if (connection === 'close') {
            webhook(sessionId, 'connection/close', update)
            if (statusCode === DisconnectReason.loggedOut || !shouldReconnect(sessionId)) {
                if (res && !res.headersSent) {
                    response(res, 500, false, 'Unable to create session.')
                }

                return deleteSession(sessionId, isLegacy)
            }

            setTimeout(
                () => {
                    createSession(sessionId, isLegacy, res)
                },
                statusCode === DisconnectReason.restartRequired ? 0 : parseInt(process.env.RECONNECT_INTERVAL ?? 5000)
            )
        }

        if (update.qr) {
            switch (protocol) {
                case 'webhook':
                    webhook(sessionId, 'connection/qrcode', { image: await toDataURL(update.qr) })
                    break
                case 'websocket':
                    socket.send(
                        JSON.stringify({
                            event: 'wa:connection_qrcode',
                            sessionId,
                            image: await toDataURL(update.qr),
                        })
                    )
                    break
                default:
            }

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
                deleteSession(sessionId, isLegacy)
            }
        }
    })
}

/**
 * @returns {(import('@adiwajshing/baileys').AnyWASocket|null)}
 */
const getSession = (sessionId) => {
    return sessions.get(sessionId) ?? null
}

const deleteSession = (sessionId, isLegacy = false) => {
    const sessionFile = (isLegacy ? 'legacy_' : 'md_') + sessionId
    const storeFile = `${sessionId}_store`

    if (isSessionFileExists(sessionFile)) {
        unlinkSync(sessionsDir(sessionFile))
    }

    if (isSessionFileExists(storeFile)) {
        unlinkSync(sessionsDir(storeFile))
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

const getGroupsWithParticipants = async (session) => {
    const groups = await session.groupFetchAllParticipating()
    return groups
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const isExists = async (session, jid, isGroup = false) => {
    try {
        if (jid.endsWith('@g.us')) {
            isGroup = true
        }

        let result

        if (isGroup) {
            result = await session.groupMetadata(jid)

            return Boolean(result.id)
        }

        if (session.isLegacy) {
            result = await session.onWhatsApp(jid)
        } else {
            ;[result] = await session.onWhatsApp(jid)
        }

        return result.exists
    } catch {
        return false
    }
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const sendMessage = async (session, receiver, message) => {
    try {
        await delay(1000)

        return session.sendMessage(receiver, message)
    } catch {
        return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
    }
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

const checkPhoneOrGroup = (receiver) => {
    if (receiver.endsWith('@g.us')) {
        return receiver
    } else {
        let formatted = receiver.replace(/\D/g, '')

        return (formatted += '@s.whatsapp.net')
    }
}

const cleanup = () => {
    console.log('Running cleanup before exit.')

    sessions.forEach((session, sessionId) => {
        if (!session.isLegacy) {
            session.store.writeToFile(sessionsDir(`${sessionId}_store`))
        }
    })
}

const init = () => {
    readdir(sessionsDir(), (err, files) => {
        if (err) {
            throw err
        }

        for (const file of files) {
            if (
                !file.endsWith('.json') ||
                (!file.startsWith('md_') && !file.startsWith('legacy_')) ||
                file.includes('_store')
            ) {
                continue
            }

            const filename = file.replace('.json', '')
            const isLegacy = filename.split('_', 1)[0] !== 'md'
            const sessionId = filename.substring(isLegacy ? 7 : 3)

            createSession(sessionId, isLegacy)
        }
    })
}

/**
 * Groups Functions
 */

const formatNumberGroup = (members) => {
    let text = members
    let split = text.split(',')
    let numbers = []

    function format(phone) {
        numbers.push(formatPhone(phone))
        return text
    }

    split.forEach(format)

    return numbers
}

const create = async (session, req) => {
    return await session.groupCreate(req.name, formatNumberGroup(req.members))
}

const participantsUpdate = async (session, req) => {
    return await session.groupParticipantsUpdate(req.groupId, formatNumberGroup(req.members), req.action)
}

const updateSubject = async (session, req) => {
    return await session.groupUpdateSubject(req.groupId, req.subject)
}

const updateDescription = async (session, req) => {
    return await session.groupUpdateDescription(req.groupId, req.description)
}

const settingUpdate = async (session, req) => {
    return await session.groupSettingUpdate(req.groupId, req.settings)
}

const leave = async (session, req) => {
    return await session.groupLeave(req.groupId)
}

const inviteCode = async (session, req) => {
    return await session.groupInviteCode(req.groupId)
}

const revokeInvite = async (session, req) => {
    return await session.groupRevokeInvite(req.groupId)
}

const metaData = async (session, req) => {
    return await session.groupMetadata(req.groupId)
}

const acceptInvite = async (session, req) => {
    return await session.groupAcceptInvite(req.invite)
}

const profilePicture = async (session, req) => {
    const image = await downloadImage(req.url)
    return await session.updateProfilePicture(req.groupId, { url: image })
}

export {
    isSessionExists,
    createSession,
    getSession,
    deleteSession,
    getChatList,
    isExists,
    sendMessage,
    formatPhone,
    formatGroup,
    cleanup,
    init,
    create,
    participantsUpdate,
    updateSubject,
    updateDescription,
    settingUpdate,
    leave,
    inviteCode,
    metaData,
    revokeInvite,
    acceptInvite,
    profilePicture,
    checkPhoneOrGroup,
    getGroupsWithParticipants,
}
