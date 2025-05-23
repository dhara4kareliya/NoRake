const express = require('express')
const cors = require('cors')
const methodOverride = require('method-override')
const createSocketLobby = require('../../socket')

function getTurn(req, res, next) {
    const socketLobby = req.app.locals.socketLobby;

    socketLobby.sendTurn(req.query.user_token, req.query.table_token);

    res.json({status: true})
}

function addTable(req, res, next) {
    const socketLobby = req.app.locals.socketLobby;

    console.log(`User (token: ${req.body.user_token}) joined a table\n`, req.body);
    
    const {server, client_url, table_token, user_token} = req.body; 

    const status = socketLobby.addTable({server, url: client_url, table_token}, user_token);
    
    res.json({status});
}

function leave(req, res, next) {
    const socketLobby = req.app.locals.socketLobby;

    console.log(`User (token: ${req.body.data.userToken}) leave MT client`, req.body.data);
    
    const {tableToken, userToken, threadToken} = req.body.data; 

    const status = socketLobby.leaveMT(tableToken, userToken, threadToken);
    
    res.json({status});
}

const router = express.Router()
.use([ // middlewares used in this api
    cors({
        origin: '*',
        methods: ['GET', 'POST', 'DELETE'],
        credentials: true,
        allowedHeaders: ['Accept', 'X-Access-Token', 'X-Application-Name', 'X-Request-Sent-Time']
    }),

    express.json(),
    express.urlencoded({ extended: true }),

    // method overrides for DELETE method
    methodOverride('X-HTTP-Method'),
    methodOverride('X-HTTP-Method-Override'),
    methodOverride('X-Method-Override'),
    methodOverride(function (req, res) { // method override for urlencoded POST body with _method variable
        if (req.body && typeof req.body === 'object' && '_method' in req.body) {
          // look in urlencoded POST bodies and delete it
          var method = req.body._method
          delete req.body._method
          return method
        }
    })
])
.get('/turn', getTurn)
.post('/add_mt_table', addTable)
.post('/leave', leave)
.use((req, res, next) => {
    res.status(404).json({ status: false, error: 'Url not found' })
})
.use((err, req, res, next) => {
    console.error(err.stack)
    res.json({ status: false, error: err.message })
})

module.exports = {
    root: '/api',
    router
}
