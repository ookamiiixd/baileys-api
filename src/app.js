const app = require('express')(),
http = require('http').Server(app),
io = require('socket.io')(http),
bodyParser = require('body-parser'),
{ response } = require('./response'),
whatsapp = require('./whatsapp'),
{ listen } = require('./socket'),
chats = require('./routes/chatsRouter'),
groups = require('./routes/groupsRouter')

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use('/chats', chats)
app.use('/groups', groups)

app.get('/', (req, res) => {
    res.sendFile('./index.html', {root: __dirname})
})

app.all('*', (req, res) => {
    response(res, 404, {success: false, message: 'The requested url cannot be found.'})
})

whatsapp.init()

http.listen(8000, () => {
    listen(io, whatsapp)

    console.log('Server listening on http://localhost:8000/')
})