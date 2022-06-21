import 'dotenv/config'
import express from 'express'
import nodeCleanup from 'node-cleanup'
import routes from './routes.js'
import { init, cleanup } from './whatsapp.js'
import cors from 'cors'

const app = express()

const host = process.env.HOST || undefined
const port = parseInt(process.env.PORT ?? 8000)

app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use('/', routes)

if(host){
    app.listen(port, host, () => {
    init()
    console.log(`Server is listening on http://${host}:${port}`)
})
}else{
app.listen(port, () => {
    init()
    console.log(`Server is listening on http://localhost:${port}`)
})
}


nodeCleanup(cleanup)

export default app
