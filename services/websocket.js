import { WebSocket } from 'ws'
const host = process.env.WS_HOST ?? 'ws://localhost'
const port = process.env.WS_PORT ?? 6001
const appId = process.env.WS_APP_ID ?? 'wa-socket'
const appKey = process.env.WA_APP_KEY ?? 'ce769548-3833-4457-b405-e07b20ab811a'
const endPoint = process.env.WS_ENDPOINT ?? 'wasocket'

const makeWSClient = () => {
    console.log(`Opening a socket connection with: ${host}:${port}/${endPoint} using appKey: ${appKey}`)
    const socket = new WebSocket(`${host}:${port}/${endPoint}?appKey=${appKey}&appId=${appId}`)
    socket.onmessage = function ({ data }) {
        const message = JSON.parse(data)
        switch (message.event) {
            case 'wa:connection_established':
                console.log('WS: Connection established. Timeout: ' + message.data.activity_timeout + 's')
                setInterval(() => {
                    socket.send(JSON.stringify({ event: 'wa:ping', data: {} }))
                }, message.data.activity_timeout * 1000)
                break
            default:
        }
    }

    socket.onclose = (err) => {
        console.error(`Connection with Websocket server closed. Reason\n${err}`)
    }

    return socket
}

export { makeWSClient }
