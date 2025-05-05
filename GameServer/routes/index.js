const express = require('express')
const api = require('./api')
const user = require('./user')
const table = require('./table')
const avatar = require('./avatar')
const game = require('./game')
const legacy_api = require('./legacy_api')

module.exports = express.Router()
.use(legacy_api)
.use(api.root, api.router)
.use(user.root, user.router)
.use(table.root, table.router)
.use(avatar.root, avatar.router)
.use(game.root, game.router)
.use('/autofolds',(req, res) => {
	var autoFold = req.app.locals.autoFold;
    res.render('autofold.ejs',{autoFold:(autoFold) ? autoFold : '{}'})
})
.get('/', (req, res) => {
    res.redirect('/user/info')
})
.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!")
})
.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send('Something broke!')
})
