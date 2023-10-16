const { Router } = require('express')

function game(req, res) {
    res.render('game.ejs')
}

const router = Router()
.get('/play', game)

module.exports = {
    root: '/game',
    router
}
