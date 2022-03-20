import { getSession, getChatList, isExists, sendMessage, formatGroup, create, participantsUpdate, updateSubject, updateDescription, settingUpdate, leave, inviteCode, revokeInvite, metaData, acceptInvite } from './../whatsapp.js'
import response from './../response.js'

const getList = (req, res) => {
    return response(res, 200, true, '', getChatList(res.locals.sessionId, true))
}

const groupCreate = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    try {

        const group = await create(session, req.body)

        response(res, 200, true, 'The group was created successfully.', group)
    } catch {
        response(res, 500, false, 'Failed to create group.')
    }
}

const groupParticipantsUpdate = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    try {
        const exists = await isExists(session, req.body.groupId)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await participantsUpdate(session, req.body)

        response(res, 200, true, 'Update participants successfully.')

    } catch {
        response(res, 500, false, 'Failed update participants.')
    }
}

const groupUpdateSubject = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    try {
        const exists = await isExists(session, req.body.groupId)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await updateSubject(session, req.body)

        response(res, 200, true, 'Update subject successfully.')

    } catch {
        response(res, 500, false, 'Failed update subject.')
    }
}

const groupUpdateDescription = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    try {
        const exists = await isExists(session, req.body.groupId)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await updateDescription(session, req.body)

        response(res, 200, true, 'Update description successfully.')

    } catch {
        response(res, 500, false, 'Failed description subject.')
    }
}

const groupSettingUpdate = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    try {
        const exists = await isExists(session, req.body.groupId)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await settingUpdate(session, req.body)

        response(res, 200, true, 'Update setting successfully.')

    } catch {
        response(res, 500, false, 'Failed setting subject.')
    }
}

const groupLeave = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    try {
        const exists = await isExists(session, req.body.groupId)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await leave(session, req.body)

        response(res, 200, true, 'Leave group successfully.')

    } catch {
        response(res, 500, false, 'Failed leave group.')
    }
}

const groupInviteCode = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    try {
        const exists = await isExists(session, req.body.groupId)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        const group = await inviteCode(session, req.body)

        response(res, 200, true, 'Invite code successfully.', group)

    } catch {
        response(res, 500, false, 'Failed invite code.')
    }
}

const groupRevokeInvite = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    try {
        const exists = await isExists(session, req.body.groupId)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        const group = await revokeInvite(session, req.body)

        response(res, 200, true, 'Revoke code successfully.', group)

    } catch {
        response(res, 500, false, 'Failed rovoke code.')
    }
}

const groupMetadata = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    try {
        const exists = await isExists(session, req.body.groupId)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        const group = await metaData(session, req.body)

        response(res, 200, true, 'Meta data successfully.', group)

    } catch {
        response(res, 500, false, 'Failed meta data.')
    }
}

const groupAcceptInvite = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    try {

        const group = await acceptInvite(session, req.body)

        response(res, 200, true, 'Accept invite successfully.', group)

    } catch {
        response(res, 500, false, 'Failed accept invite.')
    }
}

export {
    getList,
    groupCreate,
    groupParticipantsUpdate,
    groupUpdateSubject,
    groupUpdateDescription,
    groupSettingUpdate,
    groupLeave,
    groupInviteCode,
    groupRevokeInvite,
    groupMetadata,
    groupAcceptInvite
}
