const express = require('express')
const users = require('../../users')

function get_users(app) {
    app.locals.users = app.locals.users || users()
    return app.locals.users
}

function authenticate(req, res, next) {
    get_users(req.app).authenticate(req.body.username, req.body.password)
    .then(token => res.json({ status: true, token }))
    .catch(next)
}

function get_user(req, res, next) {
    get_users(req.app).getInfo(req.params.token)
    .then(user => res.json({ status: true, user }))
    .catch(next)
}

function add_cash(req, res, next) {
    const cash = Number(req.body.cash || 0)

    get_users(req.app).getInfo(req.params.token)
    .then(user => {
        let userCash = user.cash + cash
        if (userCash < 0)
            throw new Error(`Invalid cash value`)
        user.cash = userCash
        res.json({ status: true, cash: userCash })
    })
    .catch(next)
}

const router = express.Router()
.post('/authenticate', authenticate)
.get('/:token', get_user)
.post('/:token/addcash', add_cash)

module.exports = {
    root: '/users',
    router
}
