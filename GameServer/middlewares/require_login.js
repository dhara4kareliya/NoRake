
module.exports = function(opts = {}) {
    const loginCheckVar = opts.loginCheckVar || 'token'
    const loginUrl = opts.loginUrl || '/user/login'
    const redirectOriginalUrlOnSuccess = opts.redirectOriginalUrlOnSuccess || true
    
    return (req, res, next) => {
        if (loginCheckVar in req.session)
            next()
        else {
            if (redirectOriginalUrlOnSuccess)
                req.app.locals.redirectUrl = req.originalUrl

            res.redirect(loginUrl)
        }
    }
}
