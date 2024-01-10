const path = require('path')

require('dotenv').config({
    path: path.resolve(__dirname, '.env')
})

const port = Number(process.env.PORT || 3000)

const http = require('http')
const app = require('./app')

app.locals.gs = process.env.GAME_SERVER

http.createServer(app)
.on('error', err => {
    console.log(err)
})
.listen(port, () => {
    const host = process.env.HOST || 'localhost'
    app.locals.config = { host, port }
    app.locals.gs = app.locals.gs || `http://${host}:${port}`

    console.log('GameServer: Listening on port:', port)
})
