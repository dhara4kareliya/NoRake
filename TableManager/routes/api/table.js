const express = require('express')
const createTableManager = require('../../tablemanager')

function get_table_manager(app) {
    app.locals.tableManager = app.locals.tableManager || createTableManager()
    app.locals.tables = app.locals.tables || app.locals.tableManager.tables
    return app.locals.tableManager
}

function select_table_info(table) {
    return ({
        opts: table.opts,
        server: {
            host: table.server.host,
            ip: table.server.ip,
            port: table.server.port,
        },
    })
}

function select_table_list_info(table) {
    return ({
        id: table.opts.id,
        name: table.opts.name,
        token: table.opts.token,
        host: table.opts.host,
        port: table.opts.port,
        gameType: table.opts.gameType,
        mode: table.opts.mode,
        tournamentId: table.opts.mode == 'tournament' ? table.opts.tournament_id : ""
    })
}

async function create_table(req, res, next) {
    const opts = req.body;
    let tables = [];

    for (let i = 0; i < opts.length; ++i) {
        const opt = {
            ...opts[i],
            // default values
            numberOfSeats: Number(opts[i].numberOfSeats || 9),
            smallBlind: Number(opts[i].smallBlind || 10),
            bigBlind: Number(opts[i].bigBlind || (Number(opts[i].smallBlind || 20) * 2)),
            minBuyIn: Number(opts[i].minBuyIn || 100),
            maxBuyIn: Number(opts[i].maxBuyIn || 1000),
            // timeToReact: Number(opts[i].timeToReact || 40),
            // timebankMax: Number(opts[i].timebankMax || 20),
            // timebankBonus: Number(opts[i].timebankBonus || 2),
            // rake: Number(opts[i].rake || 5),
            // rakeCap: Number(opts[i].rakeCap || 50),
            rakePreFlop: Boolean(opts[i].rakePreFlop || false),
            rakeSplitPot: Boolean(opts[i].rakeSplitPot || false),
            rakeRound: Boolean(opts[i].rakeRound || false),
            numberOfBots: Number(opts[i].numberOfBots || 0),
        }
        
        const table = await get_table_manager(req.app).create_table_server(opt);
        tables.push(select_table_info(table));

        // .then((table) => tables.push(select_table_info(table)))
        // .catch(next)
    }

    res.json({ status: true, tables })
}

function list_tables(req, res) {
    res.json({
        tables: get_table_manager(req.app).tables.map(select_table_info)
    })
}

function find_table_by_id(app, id) {
    const table = get_table_manager(app).find_table_server(id)
    if (!table) {
        throw new Error(`Table server not found: ${id}`)
    }

    return table
}

function get_table(req, res) {
    const table = find_table_by_id(req.app, req.params.id)
    res.json({ status: true, ...select_table_info(table) })
}

function delete_table(req, res, next) {
    find_table_by_id(req.app, req.params.token)

    get_table_manager(req.app)
    .delete_table_server(req.params.token)
    .then(({ token }) => res.json({ status: true, token }))
    .catch(next)
}

function delete_tournament_tables(req, res, next) {
    get_table_manager(req.app)
    .delete_tournament_tables(req.params.id)
    .then(() => res.json({ status: true }))
    .catch(next)
}

const router = express.Router()
.get('/', list_tables)
.post('/', create_table)
.delete('/:token', delete_table)
.delete('/tournament/:id', delete_tournament_tables)
.get('/:id', get_table)

module.exports = {
    root: '/tables',
    router
}
