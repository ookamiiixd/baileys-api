const {response} = require('./../response'),
    {validationResult} = require('express-validator'),
    whatsapp = require('./../whatsapp'),
    {MessageType} = require('@adiwajshing/baileys')

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

    async function create() {
        try {
            let group = await session.groupCreate(name, members)
            return group
        } catch (error) {
            return error
        }
    }

    create()
        .then((success) => response(res, 200, {
            success: true,
            message: 'Group created successfully.',
            groupId: success.gid
        }))
        .catch(err => response(res, 500, {success: false, message: res}))
}

const groupAdd = (req, res) => {

    const errors = validationResult(req)
    if (!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = whatsapp.getSession(req.body.sender)
    const groupId = req.body.groupId
    const members = whatsapp.formatNumberGroup(req.body.members)

    if (!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    async function groupAdd() {
        try {
            let group = await session.groupAdd(groupId, members)
            console.log(group)
            return group
        } catch (error) {
            return error
        }
    }

    groupAdd()
        .then((success) => response(res, 200, {
            success: true,
            message: 'New members successfully added.',
        }))
        .catch(err => response(res, 500, {success: false, message: res}))

}

module.exports = {
    getChats: getChats,
    sendMessage: sendMessage,
    groupCreate: groupCreate,
    groupAdd: groupAdd
}