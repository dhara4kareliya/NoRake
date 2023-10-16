const { Router, application } = require('express')
const users = require('../users')
const threads = require('../threads')
const require_login = require('../middlewares/require_login')

function get_users(app) {
    app.locals.users = app.locals.users || users()
    return app.locals.users
}

function get_threads(app) {
    app.locals.threads = app.locals.threads || threads()
    return app.locals.threads
}

function login(req, res, next) {
    if (req.method === 'GET' || !req.body) {
        res.render('login.ejs')
    }
    else {
        get_users(req.app).authenticate(req.body.username, req.body.password)
        .then(token => {
            req.session.token = token
            res.redirect(req.app.locals.redirectUrl || `${req.baseUrl}/info`)
            delete req.app.locals.redirectUrl
        })
        .catch(next)
    }
}

function logout(req, res, next) {
    const token = req.session.token
    
    delete req.session.token
    
    get_users(req.app).logout(token)
    .then(() => res.redirect('/'))
    .catch(next)
}

function info(req, res, next) {
    const thread = get_threads(req.app).create()
    get_threads(req.app).set(thread.token, {
        token: 'test_server',
        server: 'http://localhost:11000',
        gameType: 'plo'
    })

    const user_token = req.session.token
    get_users(req.app).getInfo(user_token)
    .then(info => {
        get_users(req.app).setUserToThread(thread.token, info); 
        res.render('userinfo.ejs', { ...info, token: thread.token });
    })
    .catch(next)
}

const router = Router()
.get('/login', login)
.post('/login', login)
.get('/logout', logout)
.get('/info', [require_login(), info])

module.exports = {
    root: '/user',
    router
}
