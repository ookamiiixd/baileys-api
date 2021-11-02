const {response} = require('./../response'),
    {validationResult} = require('express-validator'),
    whatsapp = require('./../whatsapp'),
    {MessageType, GroupSettingChange} = require('@adiwajshing/baileys')

const getChats = (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.query.session)
    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    response(res, 200, {success: true, data: whatsapp.getChats(session, 'group')})
}

const sendMessage = (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const receiver = whatsapp.formatGroup(req.body.receiver)
    const message = req.body.message
    const session = whatsapp.getSession(req.body.sender)

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.sendMessage(receiver, message, MessageType.text)
        .then(() => response(res, 200, {success: true, message: 'The message has been sent successfully.'}))
        .catch(err => response(res, 500, {sucess: false, message: 'An error occured during sending the message.'}))
}

const groupCreate = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const name = req.body.name
    const members = whatsapp.formatNumberGroup(req.body.members)

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.groupCreate(name, members)
        .then((success) => response(res, 200, {
            success: true,
            message: 'Group created successfully.',
            groupId: success.gid
        }))
        .catch(err => response(res, 500, {success: false, message: res}))
}

const groupAddMember = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const groupId = req.body.groupId
    const members = whatsapp.formatNumberGroup(req.body.members)

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.groupAdd(groupId, members)
        .then((success) => response(res, 200, {
            success: true,
            message: 'New members successfully added.',
        }))
        .catch(err => response(res, 500, {success: false, message: res}))

}

const groupMakeAdmin = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const groupId = req.body.groupId
    const members = whatsapp.formatNumberGroup(req.body.members)

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.groupMakeAdmin(groupId, members)
        .then((success) => response(res, 200, {
            success: true,
            message: 'Admin successfully added.',
        }))
        .catch(err => response(res, 500, {success: false, message: res}))

}

const groupRemoveAdmin = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const groupId = req.body.groupId
    const members = whatsapp.formatNumberGroup(req.body.members)

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.groupDemoteAdmin(groupId, members)
        .then((success) => response(res, 200, {
            success: true,
            message: 'Admin remove successfully.',
        }))
        .catch(err => response(res, 500, {success: false, message: res}))

}

const groupUpdateName = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const name = req.body.name
    const groupId = req.body.groupId

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.groupUpdateSubject(groupId, name)
        .then((success) => response(res, 200, {
            success: true,
            message: 'Update name group successfully.',
        }))
        .catch(err => response(res, 500, {success: false, message: res}))

}

const groupUpdateDescription = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const description = req.body.description
    const groupId = req.body.groupId

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.groupUpdateDescription(groupId, description)
        .then((success) => response(res, 200, {
            success: true,
            message: 'Update description group successfully.',
        }))
        .catch(err => response(res, 500, {success: false, message: res}))

}

const groupSettingMessage = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const value = req.body.value
    const groupId = req.body.groupId

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.groupSettingChange(groupId, GroupSettingChange.messageSend, value)
        .then((success) => response(res, 200, {
            success: true,
            message: 'Update setting message successfully.',
        }))
        .catch(err => response(res, 500, {success: false, message: res}))

}

const groupSettingChange = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const value = req.body.value
    const groupId = req.body.groupId

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.groupSettingChange(groupId, GroupSettingChange.settingsChange, value)
        .then((success) => response(res, 200, {
            success: true,
            message: 'Update setting successfully.',
        }))
        .catch(err => response(res, 500, {success: false, message: res}))

}

const groupLeave = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const groupId = req.body.groupId

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.groupLeave(groupId)
        .then((success) => response(res, 200, {
            success: true,
            message: 'Leave a group successfully.',
        }))
        .catch(err => response(res, 500, {success: false, message: res}))

}

const groupInviteCode = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const groupId = req.body.groupId

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.groupInviteCode(groupId)
        .then((success) => response(res, 200, {
            success: true,
            message: 'Invite Code Successfully.',
            code: success,
            link: "https://chat.whatsapp.com/"+success
        }))
        .catch(err => response(res, 500, {success: false, message: res}))

}

const groupMetadata = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const groupId = req.body.groupId

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.groupMetadata(groupId)
        .then((success) => response(res, 200, {
            success: true,
            message: 'Metadata successfully.',
            group: success,
        }))
        .catch(err => response(res, 500, {success: false, message: res}))

}

module.exports = {
    getChats: getChats,
    sendMessage: sendMessage,
    groupCreate: groupCreate,
    groupAddMember: groupAddMember,
    groupMakeAdmin: groupMakeAdmin,
    groupRemoveAdmin: groupRemoveAdmin,
    groupUpdateName: groupUpdateName,
    groupUpdateDescription: groupUpdateDescription,
    groupSettingMessage: groupSettingMessage,
    groupSettingChange: groupSettingChange,
    groupLeave: groupLeave,
    groupInviteCode: groupInviteCode,
    groupMetadata: groupMetadata

}