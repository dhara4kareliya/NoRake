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
    } else {
        req.body.botCount = Number(req.body.botCount)
        req.body.timeToReact = Number(req.body.timeToReact)
        req.body.timebankMax = Number(req.body.timebankMax)
        req.body.timebankBonus = Number(req.body.timebankBonus)
        req.body.rake = Number(req.body.rake)
        req.body.rakeCap = Number(req.body.rakeCap)
        req.body.sideGame = Boolean(req.body.sideGame)
        req.body.sideBet = Boolean(req.body.sideBet)
        req.body.randomTable = Boolean(req.body.randomTable)
        req.body.isEncryptedShuffling = Boolean(req.body.isEncryptedShuffling)
        req.body.lowAction = Boolean(req.body.lowAction)
        console.log(req.body);

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
    const id = Number(req.params.id)

    axios.delete(`/api/tables/${id}`)
        .then(() => {
            res.redirect(`${req.baseUrl}/list`)
        })
        .catch(next)
}

function play_table(req, res, next) {
    const id = String(req.params.id)
    const mode = String(req.params.mode)

    axios.get(`/api/tables/${id}`)
        .then(async({ data: table }) => {
            console.log(req.session);

            const { gs } = req.app.locals
            const { token: user } = req.session
            const threads = get_threads(req.app)
            let thread = threads.findByTable(table.opts.token, mode)
            if (!thread || thread.table.mode != mode) {
                thread = threads.create()
                threads.set(thread.token, {
                    mode: mode,
                    token: table.opts.token,
                    server: `http://${table.server.host}:${table.server.port}`,
                })
                threads.setThreadToUser(thread.token, user)
            }
            console.log(user);
            console.log(req.session);


            // const url = `/game/play?user=${user}&t=${thread.token}&gs=${encodeURIComponent(gs)}`
            //const url = `http://localhost:3000/?t=${}`
            /* if (mode !== "Observer") {
                const params = {
                    data: [{
                        "t": thread.token,
                        "name": "root",
                        "is_online": "1",
                        "is_suspend": "0",
                        "last_ip": "2405:201:200c:7856:6880:3fde:835a:4512",
                        "nick_name": "root",
                        "user_id": user,
                        "port": "11002",
                        "token": user,
                        "avatar": "https://nrpoker.net/assets/images/avatar/22.jpg",
                        "main_balance": "0",
                        "chips": 500,
                        "is_bot": "0",
                        "joiningDate": "Jun 2024",
                        "rating": "2",
                        "status": true
                    }]
                };
                console.log(params);

                await axios.post(`http://${table.server.host}:${table.server.port}/api/players/add/81`, params).then(res => console.log(res.data));
		   }*/

            res.json({ status: true, token: thread.token, user });
        })
        .catch(next)
}

const router = Router()
    .use(require_login())
    .get('/list', list_tables)
    .get('/create', create_table)
    .post('/create', create_table)
    .get('/delete/:id', delete_table)
    .get('/play/:id/:mode', play_table)

module.exports = {
    root: '/table',
    router
}