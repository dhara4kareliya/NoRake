const express = require('express')
const api = require('./api')

module.exports = express.Router()
.use(api.root, api.router)
.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!")
})
.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send('Something broke!')
})
