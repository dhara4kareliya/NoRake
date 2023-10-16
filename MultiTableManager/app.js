const path = require('path')
var express = require('express')
const routes = require('./routes')
const cors = require('cors')

module.exports = express()
.use([
    cors({
        origin: '*'
    }),
    express.json(),
    express.urlencoded({ extended: true }),
])
.use('/', routes)
