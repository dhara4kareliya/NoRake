const express = require('express')
const cors = require('cors')
const methodOverride = require('method-override')
const users = require('../users')
const threads = require('../threads')

function get_users(app) {
    app.locals.users = app.locals.users || users()
    return app.locals.users
}

function get_threads(app) {
    app.locals.threads = app.locals.threads || threads()
    return app.locals.threads
}

const apis = {
    get_user(req, res, next) {

        const is_bot = req.query.is_bot || req.body.is_bot
        const token = String(req.query.t || req.body.t)
        if (!token)
            return next(new Error('No user param'))
        
        const userToken = is_bot == 'true' ? token : get_threads(req.app).getUserToken(req.query.t)

        // get_users(req.app).getUserWithThread(token)
        get_users(req.app).getInfo(userToken)
        .then(user => res.json({
            status: true,
            nick_name: user.name,
            avatar: user.avatar,
            main_balance: user.cash,
            chips: user.chips,
            user_id: user.token,
            created_at:"Sep 2023"
        }))
        .catch(next)
    },

    seat(req, res, next) {

        const table = String(req.query.table_id || req.body.table_id)
        if (!table)
            return next(new Error('No table_id param'))

        const seat = Number(req.query.seat || req.body.seat || -1)
        if (seat < 0)
            return next(new Error('No seat param'))

        const token = String(req.query.user || req.body.user)
        if (!token)
            return next(new Error('No user param'))
    
        console.log(`API sit: table:${table}, seat:${seat}, user:${token}`)

        get_users(req.app).getInfo(token)
        .then(user => res.json({
            status: true,
        }))
        .catch(next)
    },

    deposit(req, res, next) {

        const table = String(req.query.table_id || req.body.table_id)
        if (!table)
            return next(new Error('No table_id param'))

        const token = String(req.query.user || req.body.user)
        if (!token)
            return next(new Error('No user param'))
    
        const amount = String(req.query.deposit || req.body.deposit || 0)

        console.log(`API deposit: table:${table}, user:${token}, amount:$${amount}`)
        
        get_users(req.app).getInfo(token)
        .then(user => {
            if (amount > user.cash)
                throw new Error(`Insufficient cash to deposit.`)

            user.cash -= amount
            res.json({ status: true, cash: user.cash })
        })
        .catch(next)
    },

    leave(req, res, next) {

        const table = String(req.query.table_id || req.body.table_id)
        if (!table)
            return next(new Error('No table_id param'))

        const token = String(req.query.user || req.body.user)
        if (!token)
            return next(new Error('No user param'))
    
        const leftBalance = Number(req.query.left_balance || req.body.left_balance || 0)

        console.log(`API leave: table:${table}, user:${token}, left_balance:$${leftBalance}`)
        
        get_users(req.app).getInfo(token)
        .then(user => {
            user.cash += leftBalance
            res.json({ status: true, cash: user.cash })
        })
        .catch(next)
    },

    end_round(req, res, next) {

        const table = String(req.query.table_id || req.body.table_id)
        if (!table)
            return next(new Error('No table_id param'))

        const round = Number(req.query.round_id || req.body.round_id || 0)
        const rake = Number(req.query.rake || req.body.rake || 0)
        const balances = JSON.parse(String(req.query.balances || req.body.balances))
        const roundLog = JSON.parse(String(req.query.log || req.body.log))

        console.log(`API end_round: table:${table}, round:${round}, rake:$${rake}`)
        console.log(`API end_round: balances:${JSON.stringify(balances)}`)
        // console.log(`API end_round: roundLog:${JSON.stringify(roundLog)}`)
        
        res.json({ status: true })
    },

    get_ts(req, res, next) {
        const thread = get_threads(req.app).find(req.query.t)
        if (!thread)
            return next(new Error('Thread not found'))
    
        res.json({ status: true, ...thread.table })
    }, 
    user_to_tips(req,res,next){
        res.json({ status: true })
    },
    table_report(req,res,next){
        res.json({ status: true })
    },
    get_balance(req, res, next) {
        const token = String(req.query.user || req.body.user)
        if (!token)
            return next(new Error('No user param'))

        console.log(`API get_balance: user:${token}`)
        
        get_users(req.app).getInfo(token)
        .then(user => {
            res.json({ status: true, balance: user.cash })
        })
        .catch(next)
    },

    get_mt_user(req, res, next) {
        const token = String(req.query.user_token || req.body.user_token)
        if (!token)
            return next(new Error('No user param'))

        const tables =  get_threads(req.app).getTablesByUserToken(token)

        res.json({status : true, tables: tables})
    },

    
    get_global_balance(req, res, next) {
        res.json({status: true, balance: 10000})
    }, 

    user_wallet_to_table_wallet(req, res, next) {
        res.json({status: true, transfer_amount: 5000, update_user_amount: 10000});
    }
}

function apiphp(req, res, next) {
    const api = req.query.api || req.body.api
    req.api = api
    
    if (!api || !(api in apis))
        return next(new Error(`Invalid api: ${api}`))

    apis[api](req, res, next)
}

module.exports = express.Router()
.use([ // middlewares used in this api
    cors({
        origin: '*',
        methods: ['GET', 'POST', 'DELETE'],
        credentials: true,
        allowedHeaders: ['Accept', 'X-Access-Token', 'X-Application-Name', 'X-Request-Sent-Time']
    }),

    express.json(),
    express.urlencoded({ extended: true }),

    // method overrides for DELETE method
    methodOverride('X-HTTP-Method'),
    methodOverride('X-HTTP-Method-Override'),
    methodOverride('X-Method-Override'),
    methodOverride(function (req, res) { // method override for urlencoded POST body with _method variable
        if (req.body && typeof req.body === 'object' && '_method' in req.body) {
          // look in urlencoded POST bodies and delete it
          var method = req.body._method
          delete req.body._method
          return method
        }
    })
])
.post('/api.php', apiphp)
.get('/api.php', apiphp)
.use((err, req, res, next) => {
    console.error(err.stack)
    res.json({ status: false, error: err.message })
})
