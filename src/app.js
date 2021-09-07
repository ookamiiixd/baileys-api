const express = require('express'),
app = express(),
bodyParser = require('body-parser'),
http = require('http').Server(app),
io = require('socket.io')(http),
whatsapp = require('./whatsapp'),
routes = require('./routes')

whatsapp.init()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use('/', routes)

io.on('connection', socket => {
    socket.emit('init', whatsapp.getActiveSessions())

    socket.on('add', session => {
        if(whatsapp.checkSession(session)) return socket.emit('message', 'Session already exists.')

        whatsapp.createSession(socket, session)
        .catch(err => {
            console.log('unexpected error: ' + err)
            socket.emit('message', 'An error occured during creating session.')
        })
    })
})

http.listen(8000, () => console.log('listening on http://localhost:8000/'))