const express = require('express')
const threads = require('../../threads')

function get_threads(app) {
    app.locals.threads = app.locals.threads || threads()
    return app.locals.threads
}

function get_thread(req, res, next) {
    const thread = get_threads(req.app).find(req.params.id)
    if (!thread)
        return next(new Error('Thread not found'))

    res.json({ status: true, ...thread.table })
}

const router = express.Router()
.get('/:id', get_thread)

module.exports = {
    root: '/threads',
    router
}
