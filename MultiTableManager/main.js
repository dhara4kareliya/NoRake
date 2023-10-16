const path = require('path')
const createSocketLobby = require('./socket')

require('dotenv').config({
    path: path.resolve(__dirname, '.env')
})

const port = Number(process.env.PORT || 3003)

const http = require('http')
const https = require('https')
const fs = require('fs')
var app = require('./app')

let server;
console.log(process.env.mode)
if (process.env.mode === 'production') {
    server = https.createServer(
        {
            key: fs.readFileSync("ssl/server149.xite.io-key.pem"),
            cert: fs.readFileSync("ssl/server149.xite.io-crt.pem"),
            rejectUnauthorized: false
        },
        app)
}
else if (process.env.mode === 'development') {
    server = http.createServer(app)
}

server.on('error', err => {
    console.log(err)
})
.listen(port, () => {
    console.log('Multi-Table Manager: Listening on port:', port)
})

const { Server } = require("socket.io");
const io = new Server(server,  { cors: { origin: '*' } });

const socket = createSocketLobby(io);
socket.socketLobby.start();

app.locals.socketLobby = socket.socketLobby;
