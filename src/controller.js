const { validationResult } = require('express-validator'),
whatsapp = require('./whatsapp'),
{ MessageType } = require('@adiwajshing/baileys')

const response = (res, code, data) => {
    res.status(code)
    res.json(data)
    res.end()
}

const index = (req, res) => {
    res.sendFile('./index.html', {root: __dirname})
}

const sendMessage = (req, res) => {
    const errors = validationResult(req)
    if(!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const sender = req.body.sender
    const receiver = whatsapp.formatPhone(req.body.receiver)
    const message = req.body.message
    const session = whatsapp.getSession(sender)

    if(!session) return response(res, 404, {success: false, message: 'The requested session cannot be found.'})

    session.isOnWhatsApp(receiver)
    .then(exists => {
        if(!exists) return response(res, 404, {success: false, message: 'The receiver number cannot be found.'})
        
        session.sendMessage(receiver, message, MessageType.text)
        .then(() => response(res, 200, {success: true, message: 'The message has been sent successfully.'}))
        .catch(err => response(res, 500, {sucess: false, message: 'An error occured during sending the message.'}))
    })
}

module.exports = {
    index: index,
    sendMessage: sendMessage
}