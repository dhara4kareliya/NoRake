const path = require('path')
const express = require('express')
const morgan = require('morgan')
const session = require('express-session')
// const unityweb = require('./middlewares/unityweb')
const routes = require('./routes')

module.exports = express()
.set('views', path.resolve(__dirname, 'views'))
.set('view engine', 'ejs')
.use([
    morgan('dev'),
    session({
        resave: false,
        saveUninitialized: false,
        secret: process.env.SESSION_SECRET,
    }),
    express.urlencoded({extended: true}),

    // unityweb(),
    // express.static(path.resolve(__dirname, 'public')),
    express.static(path.resolve(__dirname, 'public')),
    express.static(path.resolve(__dirname, 'public/game')),
    // express.static(path.resolve(__dirname, 'public')),
    // express.static(path.resolve(__dirname, 'public')),
])
.use('/', routes)
