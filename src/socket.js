const listen = (io, whatsapp) => {
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
}

exports.listen = listen