import 'dotenv/config'
import express from 'express'
import nodeCleanup from 'node-cleanup'
import routes from './routes.js'
import { init, cleanup } from './whatsapp.js'
var cors = require("cors")

const app = express()
app.use(cors())

const host = process.env.HOST ?? '127.0.0.1'
const onHeroku = process.env.HEROKU ?? false
const port = parseInt(process.env.PORT ?? 8000)

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use('/', routes)

if(onHeroku){
    app.listen(port, () => {
    init()
    console.log(`Server is listening on http://${host}:${port}`)
})
}else{
app.listen(port, host, () => {
    init()
    console.log(`Server is listening on http://${host}:${port}`)
})
}


nodeCleanup(cleanup)

export default app
