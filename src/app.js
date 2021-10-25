const app = require('express')(),
http = require('http').Server(app),
io = require('socket.io')(http),
bodyParser = require('body-parser'),
{ response } = require('./response'),
whatsapp = require('./whatsapp'),
{ listen } = require('./socket'),
chats = require('./routes/chatsRouter'),
groups = require('./routes/groupsRouter')
sessions = require('./routes/sessionRouter')

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use('/chats', chats)
app.use('/groups', groups)
app.use('/sessions', sessions)

app.all('*', (req, res) => {
    response(res, 404, {success: false, message: 'The requested url cannot be found.'})
})

whatsapp.init()

http.listen(8000, () => {
    listen(io, whatsapp)

    console.log('Server listening on http://localhost:8000/')
})