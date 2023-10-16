const express = require('express')
const cors = require('cors')
const methodOverride = require('method-override')
const users = require('./users')
const threads = require('./threads')

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
.use(users.root, users.router)
.use(threads.root, threads.router)
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
