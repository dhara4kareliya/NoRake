const express = require('express')
const createTableManager = require('../../tablemanager')

function get_table_manager(app) {
    app.locals.tableManager = app.locals.tableManager || createTableManager()
    app.locals.tables = app.locals.tables || app.locals.tableManager.tables
    return app.locals.tableManager
}

function startTournamentNextLevel(req, res, next) {

    const tournament_id = req.body.tournament_id
    const next_level = req.body.next_level

    get_table_manager(req.app)
    .start_tournament_next_level(tournament_id, next_level)

    if (!tournament_id) {
        res.json({ status: false, message: "touranment id is not defined"});
        return;
    }
    
    if (!next_level) {
        res.json({ status: false, message: "next_level is not defined"});
        return;
    }

    res.json({ status: true })
}

function startTournament(req, res, next) {

    const tournament_id = req.body.tournament_id

    get_table_manager(req.app)
    .start_tournament(tournament_id)

    if (!tournament_id) {
        res.json({ status: false, message: "touranment id is not defined"});
        return;
    }

    res.json({ status: true })
}


const router = express.Router()
.post('/next_level', startTournamentNextLevel)
.post('/start', startTournament)

module.exports = {
    root: '/tournament',
    router
}