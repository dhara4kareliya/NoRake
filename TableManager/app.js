const path = require('path')
const express = require('express')
const routes = require('./routes')

module.exports = express()
.set('views', path.resolve(__dirname, 'views'))
.set('view engine', 'ejs')
.use([
    express.urlencoded({extended: true}),
    express.static(path.resolve(__dirname, 'public'))
])
.use('/', routes)
