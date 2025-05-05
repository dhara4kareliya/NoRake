const express = require('express')
const cors = require('cors')
const methodOverride = require('method-override')
const users = require('../users')
const threads = require('../threads')
const axios = require('axios');
const tableMoneys = [];

function get_users(app) {
    app.locals.users = app.locals.users || users()
    return app.locals.users
}

function get_threads(app) {
    app.locals.threads = app.locals.threads || threads()
    return app.locals.threads
}

const tournaments = {};
const autoFoldData = { "small_blind": { "AA": false, "AKs": false, "AQs": false, "AJs": false, "ATs": false, "A9s": false, "A8s": false, "A7s": false, "A6s": false, "A5s": false, "A4s": false, "A3s": false, "A2s": false, "AKo": false, "KK": false, "KQs": false, "KJs": false, "KTs": false, "K9s": false, "K8s": false, "K7s": false, "K6s": false, "K5s": false, "K4s": false, "K3s": false, "K2s": false, "AQo": false, "KQo": false, "QQ": false, "QJs": false, "QTs": false, "Q9s": false, "Q8s": false, "Q7s": false, "Q6s": false, "Q5s": false, "Q4s": false, "Q3s": false, "Q2s": false, "AJo": false, "KJo": false, "QJo": false, "JJ": false, "JTs": false, "J9s": false, "J8s": false, "J7s": false, "J6s": false, "J5s": false, "J4s": false, "J3s": false, "J2s": false, "ATo": false, "KTo": false, "QTo": false, "JTo": false, "TT": false, "T9s": false, "T8s": false, "T7s": false, "T6s": false, "T5s": false, "T4s": false, "T3s": false, "T2s": false, "A9o": false, "K9o": false, "Q9o": false, "J9o": false, "T9o": false, "99": false, "98s": false, "97s": false, "96s": false, "95s": false, "94s": false, "93s": false, "92s": false, "A8o": false, "K8o": false, "Q8o": false, "J8o": false, "T8o": false, "98o": false, "88": false, "87s": false, "86s": false, "85s": false, "84s": false, "83s": false, "82s": false, "A7o": false, "K7o": false, "Q7o": false, "J7o": false, "T7o": false, "97o": false, "87o": false, "77s": false, "76s": false, "75s": false, "74s": false, "73s": false, "72s": false, "A6o": false, "K6o": false, "Q6o": false, "J6o": false, "T6o": false, "96o": false, "86o": false, "76o": false, "66": false, "65s": false, "64s": false, "63s": false, "62s": false, "A5o": false, "K5o": false, "Q5o": false, "J5o": false, "T5o": false, "95o": false, "85o": false, "75o": false, "65o": false, "55": false, "54s": false, "53s": false, "52s": false, "A4o": false, "K4o": false, "Q4o": false, "J4o": false, "T4o": false, "94o": false, "84o": false, "74o": false, "64o": false, "54o": false, "44": false, "43s": false, "42s": false, "A3o": false, "K3o": false, "Q3o": false, "J3o": false, "T3o": false, "93o": false, "83o": false, "73o": false, "63o": false, "53o": false, "43o": false, "33": false, "32s": false, "A2o": false, "K2o": false, "Q2o": false, "J2o": false, "T2o": false, "92o": false, "82o": false, "72o": false, "62o": false, "52o": false, "42o": false, "32o": false, "22": false }, "big_blind": { "AA": false, "AKs": false, "AQs": false, "AJs": false, "ATs": false, "A9s": false, "A8s": false, "A7s": false, "A6s": false, "A5s": false, "A4s": false, "A3s": false, "A2s": false, "AKo": false, "KK": false, "KQs": false, "KJs": false, "KTs": false, "K9s": false, "K8s": false, "K7s": false, "K6s": false, "K5s": false, "K4s": false, "K3s": false, "K2s": false, "AQo": false, "KQo": false, "QQ": false, "QJs": false, "QTs": false, "Q9s": false, "Q8s": false, "Q7s": false, "Q6s": false, "Q5s": false, "Q4s": false, "Q3s": false, "Q2s": false, "AJo": false, "KJo": false, "QJo": false, "JJ": false, "JTs": false, "J9s": false, "J8s": false, "J7s": false, "J6s": false, "J5s": false, "J4s": false, "J3s": false, "J2s": false, "ATo": false, "KTo": false, "QTo": false, "JTo": false, "TT": false, "T9s": false, "T8s": false, "T7s": false, "T6s": false, "T5s": false, "T4s": false, "T3s": false, "T2s": false, "A9o": false, "K9o": false, "Q9o": false, "J9o": false, "T9o": false, "99": false, "98s": false, "97s": false, "96s": false, "95s": false, "94s": false, "93s": false, "92s": false, "A8o": false, "K8o": false, "Q8o": false, "J8o": false, "T8o": false, "98o": false, "88": false, "87s": false, "86s": false, "85s": false, "84s": false, "83s": false, "82s": false, "A7o": false, "K7o": false, "Q7o": false, "J7o": false, "T7o": false, "97o": false, "87o": false, "77s": false, "76s": false, "75s": false, "74s": false, "73s": false, "72s": false, "A6o": false, "K6o": false, "Q6o": false, "J6o": false, "T6o": false, "96o": false, "86o": false, "76o": false, "66": false, "65s": false, "64s": false, "63s": false, "62s": false, "A5o": false, "K5o": false, "Q5o": false, "J5o": false, "T5o": false, "95o": false, "85o": false, "75o": false, "65o": false, "55": false, "54s": false, "53s": false, "52s": false, "A4o": false, "K4o": false, "Q4o": false, "J4o": false, "T4o": false, "94o": false, "84o": false, "74o": false, "64o": false, "54o": false, "44": false, "43s": false, "42s": false, "A3o": false, "K3o": false, "Q3o": false, "J3o": false, "T3o": false, "93o": false, "83o": false, "73o": false, "63o": false, "53o": false, "43o": false, "33": false, "32s": false, "A2o": false, "K2o": false, "Q2o": false, "J2o": false, "T2o": false, "92o": false, "82o": false, "72o": false, "62o": false, "52o": false, "42o": false, "32o": false, "22": false }, "early_position": { "AA": false, "AKs": false, "AQs": false, "AJs": false, "ATs": false, "A9s": false, "A8s": false, "A7s": false, "A6s": false, "A5s": false, "A4s": false, "A3s": false, "A2s": false, "AKo": false, "KK": false, "KQs": false, "KJs": false, "KTs": false, "K9s": false, "K8s": false, "K7s": false, "K6s": false, "K5s": false, "K4s": false, "K3s": false, "K2s": false, "AQo": false, "KQo": false, "QQ": false, "QJs": false, "QTs": false, "Q9s": false, "Q8s": false, "Q7s": false, "Q6s": false, "Q5s": false, "Q4s": false, "Q3s": false, "Q2s": false, "AJo": false, "KJo": false, "QJo": false, "JJ": false, "JTs": false, "J9s": false, "J8s": false, "J7s": false, "J6s": false, "J5s": false, "J4s": false, "J3s": false, "J2s": false, "ATo": false, "KTo": false, "QTo": false, "JTo": false, "TT": false, "T9s": false, "T8s": false, "T7s": false, "T6s": false, "T5s": false, "T4s": false, "T3s": false, "T2s": false, "A9o": false, "K9o": false, "Q9o": false, "J9o": false, "T9o": false, "99": false, "98s": false, "97s": false, "96s": false, "95s": false, "94s": false, "93s": false, "92s": false, "A8o": false, "K8o": false, "Q8o": false, "J8o": false, "T8o": false, "98o": false, "88": false, "87s": false, "86s": false, "85s": false, "84s": false, "83s": false, "82s": false, "A7o": false, "K7o": false, "Q7o": false, "J7o": false, "T7o": false, "97o": false, "87o": false, "77s": false, "76s": false, "75s": false, "74s": false, "73s": false, "72s": false, "A6o": false, "K6o": false, "Q6o": false, "J6o": false, "T6o": false, "96o": false, "86o": false, "76o": false, "66": false, "65s": false, "64s": false, "63s": false, "62s": false, "A5o": false, "K5o": false, "Q5o": false, "J5o": false, "T5o": false, "95o": false, "85o": false, "75o": false, "65o": false, "55": false, "54s": false, "53s": false, "52s": false, "A4o": false, "K4o": false, "Q4o": false, "J4o": false, "T4o": false, "94o": false, "84o": false, "74o": false, "64o": false, "54o": false, "44": false, "43s": false, "42s": false, "A3o": false, "K3o": false, "Q3o": false, "J3o": false, "T3o": false, "93o": false, "83o": false, "73o": false, "63o": false, "53o": false, "43o": false, "33": false, "32s": false, "A2o": false, "K2o": false, "Q2o": false, "J2o": false, "T2o": false, "92o": false, "82o": false, "72o": false, "62o": false, "52o": false, "42o": false, "32o": false, "22": false }, "middle_position": { "AA": false, "AKs": false, "AQs": false, "AJs": false, "ATs": false, "A9s": false, "A8s": false, "A7s": false, "A6s": false, "A5s": false, "A4s": false, "A3s": false, "A2s": false, "AKo": false, "KK": false, "KQs": false, "KJs": false, "KTs": false, "K9s": false, "K8s": false, "K7s": false, "K6s": false, "K5s": false, "K4s": false, "K3s": false, "K2s": false, "AQo": false, "KQo": false, "QQ": false, "QJs": false, "QTs": false, "Q9s": false, "Q8s": false, "Q7s": false, "Q6s": false, "Q5s": false, "Q4s": false, "Q3s": false, "Q2s": false, "AJo": false, "KJo": false, "QJo": false, "JJ": false, "JTs": false, "J9s": false, "J8s": false, "J7s": false, "J6s": false, "J5s": false, "J4s": false, "J3s": false, "J2s": false, "ATo": false, "KTo": false, "QTo": false, "JTo": false, "TT": false, "T9s": false, "T8s": false, "T7s": false, "T6s": false, "T5s": false, "T4s": false, "T3s": false, "T2s": false, "A9o": false, "K9o": false, "Q9o": false, "J9o": false, "T9o": false, "99": false, "98s": false, "97s": false, "96s": false, "95s": false, "94s": false, "93s": false, "92s": false, "A8o": false, "K8o": false, "Q8o": false, "J8o": false, "T8o": false, "98o": false, "88": false, "87s": false, "86s": false, "85s": false, "84s": false, "83s": false, "82s": false, "A7o": false, "K7o": false, "Q7o": false, "J7o": false, "T7o": false, "97o": false, "87o": false, "77s": false, "76s": false, "75s": false, "74s": false, "73s": false, "72s": false, "A6o": false, "K6o": false, "Q6o": false, "J6o": false, "T6o": false, "96o": false, "86o": false, "76o": false, "66": false, "65s": false, "64s": false, "63s": false, "62s": false, "A5o": false, "K5o": false, "Q5o": false, "J5o": false, "T5o": false, "95o": false, "85o": false, "75o": false, "65o": false, "55": false, "54s": false, "53s": false, "52s": false, "A4o": false, "K4o": false, "Q4o": false, "J4o": false, "T4o": false, "94o": false, "84o": false, "74o": false, "64o": false, "54o": false, "44": false, "43s": false, "42s": false, "A3o": false, "K3o": false, "Q3o": false, "J3o": false, "T3o": false, "93o": false, "83o": false, "73o": false, "63o": false, "53o": false, "43o": false, "33": false, "32s": false, "A2o": false, "K2o": false, "Q2o": false, "J2o": false, "T2o": false, "92o": false, "82o": false, "72o": false, "62o": false, "52o": false, "42o": false, "32o": false, "22": false }, "late_position": { "AA": false, "AKs": false, "AQs": false, "AJs": false, "ATs": false, "A9s": false, "A8s": false, "A7s": false, "A6s": false, "A5s": false, "A4s": false, "A3s": false, "A2s": false, "AKo": false, "KK": false, "KQs": false, "KJs": false, "KTs": false, "K9s": false, "K8s": false, "K7s": false, "K6s": false, "K5s": false, "K4s": false, "K3s": false, "K2s": false, "AQo": false, "KQo": false, "QQ": false, "QJs": false, "QTs": false, "Q9s": false, "Q8s": false, "Q7s": false, "Q6s": false, "Q5s": false, "Q4s": false, "Q3s": false, "Q2s": false, "AJo": false, "KJo": false, "QJo": false, "JJ": false, "JTs": false, "J9s": false, "J8s": false, "J7s": false, "J6s": false, "J5s": false, "J4s": false, "J3s": false, "J2s": false, "ATo": false, "KTo": false, "QTo": false, "JTo": false, "TT": false, "T9s": false, "T8s": false, "T7s": false, "T6s": false, "T5s": false, "T4s": false, "T3s": false, "T2s": false, "A9o": false, "K9o": false, "Q9o": false, "J9o": false, "T9o": false, "99": false, "98s": false, "97s": false, "96s": false, "95s": false, "94s": false, "93s": false, "92s": false, "A8o": false, "K8o": false, "Q8o": false, "J8o": false, "T8o": false, "98o": false, "88": false, "87s": false, "86s": false, "85s": false, "84s": false, "83s": false, "82s": false, "A7o": false, "K7o": false, "Q7o": false, "J7o": false, "T7o": false, "97o": false, "87o": false, "77s": false, "76s": false, "75s": false, "74s": false, "73s": false, "72s": false, "A6o": false, "K6o": false, "Q6o": false, "J6o": false, "T6o": false, "96o": false, "86o": false, "76o": false, "66": false, "65s": false, "64s": false, "63s": false, "62s": false, "A5o": false, "K5o": false, "Q5o": false, "J5o": false, "T5o": false, "95o": false, "85o": false, "75o": false, "65o": false, "55": false, "54s": false, "53s": false, "52s": false, "A4o": false, "K4o": false, "Q4o": false, "J4o": false, "T4o": false, "94o": false, "84o": false, "74o": false, "64o": false, "54o": false, "44": false, "43s": false, "42s": false, "A3o": false, "K3o": false, "Q3o": false, "J3o": false, "T3o": false, "93o": false, "83o": false, "73o": false, "63o": false, "53o": false, "43o": false, "33": false, "32s": false, "A2o": false, "K2o": false, "Q2o": false, "J2o": false, "T2o": false, "92o": false, "82o": false, "72o": false, "62o": false, "52o": false, "42o": false, "32o": false, "22": false } };

const apis = {

    async get_user(req, res, next) {
        const is_bot = req.query.is_bot || req.body.is_bot
        const token = String(req.query.t || req.body.t)
        if (!token)
            return next(new Error('No user param'))

        const thread = get_threads(req.app).find(req.query.t);
        //const userinfoByte = await get_threads(req.app).getUserToken(req.query.t);
        //  console.log(userinfoByte);

        // get_users(req.app).getUserWithThread(token)
        /*  console.log(get_users(req.app).getInfo(token)
	  .then(user => console.log(user)));*/


        get_users(req.app).getInfo(token)
            .then(user => {
                res.json({
                    status: true,
                    nick_name: (user.name.includes('BOT')) ? user.name : 'User 101',
                    avatar: user.avatar,
                    country: user.country,
                    main_balance: user.cash, //(thread.table.mode === "Observer") ? 0 : user.cash
                    chips: user.chips, //(thread.table.mode === "Observer") ? 0 : user.chips
                    user_id: user.token,
                    token: 7894561231235,
                    free_balance: user.cash,
                })
            })
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

    async deposit(req, res, next) {
        const table = String(req.query.table_id || req.body.table_id)
        if (!table)
            return next(new Error('No table_id param'))

        const token = String(req.query.user || req.body.user)
        if (!token)
            return next(new Error('No user param'))

        const amount = String(req.query.deposit || req.body.deposit || 0)

        console.log(`API deposit: table:${table}, user:${token}, amount:$${amount}`)

        const user = await get_users(req.app).getInfo(token);
        var data = await axios.get(`http://localhost:3001/api/tables/${table}`).catch(function(error) {});
        if (!data.data.status)
            return;

        var tsData = await axios.get(`http://localhost:${data.data.opts.port}/api/update_free_balance/${token}/${user.cash - amount}`).catch(function(error) {});

        get_users(req.app).getInfo(token)
            .then(user => {
                if (amount > user.cash)
                    throw new Error(`Insufficient cash to deposit.`)
				console.log(user);
                user.cash -= amount

				console.log(user);
                res.json({ status: true, cash: Number(user.cash) })
            })
            .catch(next)
    },
	async side_bet(req, res, next) {
		/* if((Math.floor(Math.random() * 2) + 1) > 1) */
			/* await new Promise(res => setTimeout(res, 4000)); */
		 

        const table = String(req.query.table_token || req.body.table_token)
        if (!table)
            return next(new Error('No table_id param'))

        const token = String(req.query.user_token || req.body.user_token)
        if (!token)
            return next(new Error('No user param'))

        const totalSideBetAmount = String(req.query.totalSideBetAmount || req.body.totalSideBetAmount || 0)
        const sideBets = JSON.parse(String(req.query.sideBets || req.body.sideBets));
		
		for(var i =0;i<sideBets.length;i++)
		{
			sideBets[i]['betId'] = (Math.floor(Math.random() * 100)) + 1;
		}

        get_users(req.app).getInfo(token)
            .then(user => {
                if (totalSideBetAmount > user.cash)
                    throw new Error(`Insufficient cash to deposit.`)

                user.cash -= totalSideBetAmount
                res.json({ status: true, sideBets: sideBets, updated_free_balance: user.cash })
            })
            .catch(next)
		
	},
    async games(req, res, next) {
        

        console.log(req.body)

        const table = String(req.query.table_token || req.body.table_token)
        if (!table)
            return next(new Error('No table_id param'))

        const token = String(req.query.user_token || req.body.user_token)
        if (!token)
            return next(new Error('No user param'))

        const amount = String(req.query.amount || req.body.amount || 0)

        get_users(req.app).getInfo(token)
            .then(user => {
                if (amount > user.cash)
                    throw new Error(`Insufficient cash to deposit.`)

                user.cash -= amount
                res.json({ status: true, bet_id: (Math.floor(Math.random() * 100)) + 1, updated_free_balance: user.cash })
            })
            .catch(next)

    },
    async user_to_tips(req, res, next) {
        await new Promise(res => setTimeout(res, 1000));
        res.json({ status: true })
    },
	
	
	async win_bet(req, res, next) {
        //await new Promise(res => setTimeout(res, 3000));
        const table = String(req.query.table_token || req.body.table_token)
        if (!table)
            return next(new Error('No table_id param'))

        const token = String(req.query.user_token || req.body.user_token)
        if (!token)
            return next(new Error('No user param'))

        const amount = Number(req.query.amount || req.body.amount || 0)

        get_users(req.app).getInfo(token)
            .then(user => {
                
                user.cash += amount
                res.json({ status: true, bet_id: (Math.floor(Math.random() * 100)) + 1, updated_free_balance: user.cash })
            })
            .catch(next)

    },
    async win_games(req, res, next) {
        //await new Promise(res => setTimeout(res, 3000));
        const table = String(req.query.table_token || req.body.table_token)
        if (!table)
            return next(new Error('No table_id param'))

        const token = String(req.query.user_token || req.body.user_token)
        if (!token)
            return next(new Error('No user param'))

        const amount = Number(req.query.payout || req.body.payout || 0)

        get_users(req.app).getInfo(token)
            .then(user => {
                if (amount > user.cash)
                    throw new Error(`Insufficient cash to deposit.`)

                user.cash += amount
                res.json({ status: true, bet_id: (Math.floor(Math.random() * 100)) + 1, updated_free_balance: user.cash })
            })
            .catch(next)

    },

    async leave(req, res, next) {
        // await new Promise(res => setTimeout(res, 6000));
        const table = String(req.query.table_id || req.body.table_id);
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

    async end_round(req, res, next) {
        await new Promise(res => setTimeout(res, 1000));

        const table_id = String(req.query.table_id || req.body.table_id)
        if (!table_id)
            return next(new Error('No table_id param'))

        const round = Number(req.query.round_id || req.body.round_id || 0)
        const rake = Number(req.query.rake || req.body.rake || 0)
        const balances = JSON.parse(String(req.query.balances || req.body.balances))
        const roundLog = JSON.parse(String(req.query.log || req.body.log))
        const tournament_id = String(req.query.tournament_id || req.body.tournament_id);
        const server = String(req.query.server || req.body.server);

        if (!tournaments[tournament_id])
            tournaments[tournament_id] = [];


        //tournaments[tournament_id].push(roundLog.pots.reduce((partialSum, a) => partialSum + a.amount, 0));
        const players_that_stay = JSON.parse(String(req.query.players_that_stay || req.body.players_that_stay))
        const handId = req.app.locals.handId ?? 0;
        console.log(req.app.locals.handId);
        console.log(`API end_round: table:${table_id}, round:${round}, rake:$${rake}`)
        console.log(`API end_round: balances:${JSON.stringify(balances)}`)
        console.log(`handId:${handId}`);
        // console.log(`API end_round: roundLog:${JSON.stringify(roundLog)}`)
        /*console.log(req.app.locals?.round_id);
        if (req.app.locals?.round_id == undefined)
            await new Promise(res => setTimeout(res, 6000));*/
        req.app.locals.handId = handId + 1;
        req.app.locals.players = balances;
       const players = [];

    //     for (let index = 0; index < balances.length; index++) {
	// 		if(balances[index]['balance'] > 0)
	// 		{	
	// 			players.push({ "user_token": balances[index]['user'], "chips": balances[index]['balance'], "position": 1 });
	// 		}
	// 		else 
	// 			players.push({ "user_token": balances[index]['user'], "chips": 1, "position": 1 });
    //     }

	// 	var status = players_that_stay.length == 1 ? 2 :1;
	// 	var tsData = await axios.get(`http://localhost:3001/api/tables`).catch(function(error) {});
	// 	var tinfo = tsData.data.tables.filter(table => table.opts.token	!= table_id);
		
	// 	var tables = [];
	// 	tables.push({table_token:tinfo[0].opts.token,server:`http://localhost:${tinfo[0].opts.port}`,players:players});
	//    console.log(JSON.stringify(tables));
		//var status = balances.length <= 1 ? 3 : 1;
        // res.json({ status: true,tables:tables, hand_id: handId + 1 });
        res.json({ status: true, hand_id: handId + 1 });
    },
    get_tournaments_user_chip(req, res, next) {
        var players = req.app.locals.players;
        //console.log(players);
        const tournament_id = String(req.query.tournament_id || req.body.tournament_id);

        if (players === undefined && players.length == 0)
            return false;

        players.sort(compareNumbers);

        function compareNumbers(a, b) {
            return b.balance - a.balance;
        }


        var data = { biggestStack: 0, averageStack: 0, players: [] };

        var playersBalance = [];

        for (let index = 0; index < players.length; index++) {
            const player = players[index];
            playersBalance.push(Number(player.balance));
            data.players.push({
                player_id: player.user,
                position: index + 1,
                number: players.length
            });

        }
        const average = array => array.reduce((a, b) => a + b) / array.length;

        data.biggestStack = Math.max(...playersBalance);
        data.averageStack = average(playersBalance);

        console.log(data);
        res.json({
            status: true,
            data: data
        });
    },
	get_tournament_winining(req, res, next) {
		const tournament_id = String(req.query.tournament_id || req.body.tournament_id);
		const user_token = String(req.query.user_token || req.body.user_token);
		var players = req.app.locals.players;
		
		var finishing_place = players.filter(player => player.user == user_token).length == 1 ? 1 : players.length + 1;
		console.log({
			status: true,
			hasWin: true,
			winnigString:"50 XRP",
			finishing_place:finishing_place
		});
		res.json({
			status: true,
			haswin: true,
			winnigString:"50 XRP",
			isRegister:true,
			register_amount:25,
			finishing_place:finishing_place
		});
		
	},
    async get_ts(req, res, next) {
        const thread = get_threads(req.app).find(req.query.t)
        console.log(thread)
        if (!thread)
            return next(new Error('Thread not found'))

        // var data = await axios.get(`http://localhost:3001/api/tables/check`).catch(function(error) {});
        // if (data == undefined || data.status == undefined)
        //return next(new Error('MS server went down'));
        thread.table.server = thread.table.server.replace("localhost",'192.168.29.248');
        res.json({ status: true, ...thread.table,currency:"USDC" })
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

        const tables = get_threads(req.app).getTablesByUserToken(token)

        res.json({ status: true, tables: tables })
    },


    get_global_balance(req, res, next) {
        res.json({ status: true, balance: 50000000000 })
    },
	get_tournament_winining(req, res, next){
		res.json({"status":true,"haswin":true,"winnigString":"5 USDC","finishing_place":5,"isRegister":true,"register_amount":3} )
	},

    async user_wallet_to_table_wallet(req, res, next) {
        const tableMoney = tableMoneys.filter(table => table.token == req.query.table_token);

        if (tableMoney.length == 0) {
            var data = await axios.get(`http://localhost:3001/api/tables/${req.query.table_token}`).catch(function(error) {});
            if (!data.data.status)
                return;
            tableMoneys.push({
                table_money: parseFloat(req.query.amount),
                token: req.query.table_token,
                port: data.data.opts.port,
            });
            tableMoney[0] = {
                table_money: parseFloat(req.query.amount),
                token: req.query.table_token,
                port: data.data.opts.port,
            };

        } else {
            tableMoney[0].table_money = parseFloat(req.query.amount) + tableMoney[0].table_money;
            var tsData = await axios.get(`http://localhost:${tableMoney[0].port}/api/update_table_wallet/${tableMoney[0].table_money}/user_deposit`).catch(function(error) {});
            console.log(`http://localhost:${tableMoney[0].port}/api/update_table_wallet/${tableMoney[0].table_money}/user_deposit`);
            console.log(tsData.data);
        }
        console.log(tableMoneys);
        res.json({ status: true, transfer_amount: Number(req.query.amount), update_user_amount: Number(0) });
    },
    async report_error(req, res, next) {
        console.log(req.body);
        await new Promise(res => setTimeout(res, 1000));
        res.json({ status: true });
    },
    insurance(req, res, next) {
        res.json({ "status": true, "insurance_id": Math.floor(100000 + Math.random() * 900000), "message": "Insurance Money sent successfully" });
    },
    win_insurance(req, res, next) {
        console.log(req.body);
        res.json({ status: true });
    },
    tournament_cancel(req, res, next) {
        console.log(req.body);
        res.json({ status: true });
    },
    submitTSErrorLog(req, res, next) {
        console.log(req.body);
        res.json({ status: true });
    },
    auto_fold(req, res, next) {
        var autoFold = req.app.locals.autoFold;
        res.json({ status: true, data: (autoFold) ? autoFold : JSON.stringify(autoFoldData) });
    },
	get_currency_rate(req, res, next){
		 res.json({ status: true, amount: 2.51});
	},
    auto_fold_save(req, res, next) {

        var autoFold = req.app.locals.autoFold;

        const autoSettings = JSON.parse(req.body.bet_name);

        if (!autoFold)
            autoFold = autoFoldData;
        else
            autoFold = JSON.parse(autoFold);

        for (var i = 0; i < autoSettings.length; i++) {
            const autoSetting = autoSettings[i];
            const key = autoSetting.key.split(",")
            autoFold[key[0]][key[1]] = autoSetting.value;
        }

        req.app.locals.autoFold = JSON.stringify(autoFold);
        res.json({ status: true, autoFold: autoFold });
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
        methodOverride(function(req, res) { // method override for urlencoded POST body with _method variable
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
        //console.error(err.stack)
        res.json({ status: false, message: err.message })
    })