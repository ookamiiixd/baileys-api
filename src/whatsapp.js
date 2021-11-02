const fs = require('fs'),
path = require('path'),
qrcode = require('qrcode'),
clone = require('lodash.clonedeep'),
{ WAConnection } = require('@adiwajshing/baileys')

let sessions = [],
connections = {}

const getChats = (session, type) => {
    let chats = clone(
        session.chats.filter((item => type == 'group' ? item.jid.includes('@g.us') : item.jid.includes('@s.whatsapp.net'))).all()
    )

    return chats.map(chat => {
        if('messages' in chat) delete chat['messages']

        return chat
    })
}

const createExistedSession = async session => {
    let wa = new WAConnection()

    wa.browserDescription = ['Windows', 'Chrome', '10']
    wa.version = [2,2134,10]
    wa.loadAuthInfo(path.join(__dirname, 'sessions', `${session}.json`))

    wa.on('open', () => {
        const authInfo = wa.base64EncodedAuthInfo()
        fs.writeFileSync(path.join(__dirname, 'sessions', `${session}.json`), JSON.stringify(authInfo, null, '\t'))

        sessions.push(session)
        connections[session] = wa
    })

    wa.on('qr', () => deleteSession(session))
    wa.on('close', () => deleteSession(session))

    await wa.connect()
    .catch(err => console.log('Unexpected error: ' + err))
}

const createSession = async (session) => {
    let wa = new WAConnection()

    console.log("Creating session: " + session)

    wa.browserDescription = ['Windows', 'Chrome', '10']
    wa.version = [2,2134,10]

    let timeout = setTimeout(() => {
        if(fs.existsSync(path.join(__dirname, 'data', `session_qrcode.json`))) fs.unlinkSync(path.join(__dirname, 'data', `session_qrcode.json`))
        wa.close()
    }, 60000)

    wa.on('qr', qr => {

        qrcode.toDataURL(qr).then(url => {
            fs.writeFileSync(path.join(__dirname, 'data', `session_qrcode.json`), JSON.stringify(url, null, '\t'))
        })
    })

    wa.on('open', () => {

        if(fs.existsSync(path.join(__dirname, 'data', `session_qrcode.json`))) fs.unlinkSync(path.join(__dirname, 'data', `session_qrcode.json`))

        const authInfo = wa.base64EncodedAuthInfo()
        fs.writeFileSync(path.join(__dirname, 'sessions', `${session}.json`), JSON.stringify(authInfo, null, '\t'))

        sessions.push(session)
        connections[session] = wa

        clearTimeout(timeout)
    })

    wa.on('close', () => {
        deleteSession(session)
    })
    
    return await wa.connect()
}

const deleteSession = session => {
    if(fs.existsSync(path.join(__dirname, 'sessions', `${session}.json`))) fs.unlinkSync(path.join(__dirname, 'sessions', `${session}.json`))

    delete connections[session]

    if(checkSession(session)){
        let index = sessions.indexOf(session)
        sessions.splice(index, 1)
    }
}

const checkSession = session => {
    let index = sessions.indexOf(session)

    return index !== -1
}

const getActiveSessions = () => {
    return sessions
}

const  getSession = session => {
    if(session in connections) return connections[session]

    return false
}

const formatPhone = phone => {
    let formatted = phone.replace(/\D/g, '')

    return formatted += '@s.whatsapp.net'
}

const formatGroup = group => {
    let formatted = group.replace(/[^\d\-]/g, '')

    return formatted += '@g.us'
}

const formatNumberGroup = phone => {
    let text = phone
    let split = text.split(',')
    let numbers = []

    function format(elemento){
        numbers.push(elemento.concat("@s.whatsapp.net"))
        return text;
    }

    split.forEach(format)

    return numbers
}

const init = () => {
    if(fs.existsSync(path.join(__dirname, 'data', `session_qrcode.json`))) fs.unlinkSync(path.join(__dirname, 'data', `session_qrcode.json`))

    fs.readdir(path.join(__dirname, 'sessions'), (err, files) => {
        if(err) throw err

        files.forEach(file => {
            if(file.indexOf('.json') !== -1) createExistedSession(file.replace('.json', ''))
        })
    })
}

module.exports = {
    init: init,
    formatPhone: formatPhone,
    formatGroup: formatGroup,
    getSession: getSession,
    getActiveSessions: getActiveSessions,
    checkSession: checkSession,
    createSession: createSession,
    deleteSession: deleteSession,
    getChats: getChats,
    formatNumberGroup: formatNumberGroup
}