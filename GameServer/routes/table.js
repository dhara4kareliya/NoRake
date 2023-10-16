const { Router } = require('express')
const { nanoid } = require('nanoid')
const require_login = require('../middlewares/require_login')
const threads = require('../threads')

function get_threads(app) {
    app.locals.threads = app.locals.threads || threads()
    return app.locals.threads
}

const axios = require('axios').create({
    baseURL: process.env.TABLE_MANAGER,
    timeout: 10000,
})

function create_table(req, res, next) {
    if (req.method === 'GET' || !req.body) {
        res.render('create_table.ejs')
    }
    else {
        req.body.botCount = Number(req.body.botCount)
        req.body.timeToReact = Number(req.body.timeToReact)
        req.body.timebankMax = Number(req.body.timebankMax)
        req.body.timebankBonus = Number(req.body.timebankBonus)
        req.body.rake = Number(req.body.rake)
        req.body.rakeCap = Number(req.body.rakeCap)
        axios.post('/api/tables', [{ token: nanoid(), ...req.body }])
        .then((table) => {
            res.redirect(`${req.baseUrl}/list`)
        })
        .catch(next)
    }
}

function list_tables(req, res, next) {
    axios.get('/api/tables')
    .then(({ data: { tables } }) => {
        req.app.locals.user = req.session.token
        req.app.locals.tables = tables
        res.render('list_tables.ejs')
    })
    .catch(next)
}

function delete_table(req, res, next) {
    const id = String(req.params.id)
    
    axios.delete(`/api/tables/${id}`)
    .then(() => {
        res.redirect(`${req.baseUrl}/list`)
    })
    .catch(next)
}

function play_table(req, res, next) {
    const id = String(req.params.id)

    axios.get(`/api/tables/${id}`)
    .then(({ data: table }) => {

        const { gs } = req.app.locals
        const { token: user } = req.session
        const threads = get_threads(req.app)
        let thread = threads.findByTable(table.opts.token)
        if (!thread) {
            thread = threads.create()
            threads.set(thread.token, {
                token: table.opts.token,
                server: `http://${table.server.host}:${table.server.port}`,
            })
            threads.setThreadToUser(thread.token, user)
        }
        // const url = `/game/play?user=${user}&t=${thread.token}&gs=${encodeURIComponent(gs)}`
        const url = `/game/play?t=${thread.token}`
        
        res.redirect(url)
    })
    .catch(next)
}

const router = Router()
.use(require_login())
.get('/list', list_tables)
.get('/create', create_table)
.post('/create', create_table)
.get('/delete/:id', delete_table)
.get('/play/:id', play_table)

module.exports = {
    root: '/table',
    router
}
