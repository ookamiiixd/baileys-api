const { response } = require('../response'),
{ validationResult } = require('express-validator'),
whatsapp = require('../whatsapp')

const createSession = (req, res) => {
    const errors = validationResult(req)
    if(!errors.isEmpty()) return response(res, 400, {success: false, message: 'Please fill out all required inputs.'})

    const session = req.body.session;

    if(whatsapp.checkSession(session)) return response(res, 422, {
        error: 'Session already exists.'
    })

    whatsapp.createSession(null, session)
        .then(() => {
            response(res, 200, {
                success: true,
                message: "New session created."
            })
        })
        .catch(err => {
            response(res, 422, {
                error: 'Error creating session.',
                message: err
            })
        })
}

const getActiveSessions = (req, res) => {

    response(res, 200, {
        success: true, 
        data: whatsapp.getActiveSessions()
    })

}

module.exports = {
    createSession: createSession,
    getActiveSessions: getActiveSessions
}