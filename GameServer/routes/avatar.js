const { Router } = require('express')
const path = require('path')
const fs = require('fs')

function get_player_avatar(req, res, next) {
    const id = Number(req.params.id || 0)
    const filename = path.resolve(path.dirname(process.argv[1]), `resources/avatar/${id}.png`)
    fs.access(filename, fs.constants.R_OK, (err) => {
        if (err)
            return next()
            
        res.sendFile(filename)        
    })
}

const router = Router()
.get('/:id', get_player_avatar)
.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!")
})

module.exports = {
    root: '/avatar',
    router
}
