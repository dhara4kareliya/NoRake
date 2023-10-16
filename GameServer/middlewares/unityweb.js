const express = require('express')

module.exports = function() {
    express.static.mime.define({ 'application/octet-stream': ['unityweb']})

    // gzip encoding for unityweb
    return (req, res, next) => {
        if (req.url.endsWith('.unityweb'))
            res.setHeader('Conetnt-Encoding', 'gzip')
        next()
    }
}
