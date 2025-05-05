const path = require('path')
const axios = require('axios');

require('dotenv').config({
    path: path.resolve(__dirname, '.env')
})

const port = Number(process.env.PORT || 3001)

const https = require('https')
const http = require('http')
const fs = require('fs')
const { readMatrixCsvFile } = require("./preFlopMatrix");
const app = require('./app')

let server;
console.log(process.env.mode)
if (process.env.mode === 'production') {
    server = https.createServer(
        {
            key: fs.readFileSync("ssl/server149.xite.io-key.pem"),
            cert: fs.readFileSync("ssl/server149.xite.io-crt.pem"),
            rejectUnauthorized: false
        },
        app)
}
else if (process.env.mode === 'development') {
    server = http.createServer(app)
}

server.on('error', err => {
    console.log(err)
})
.listen(port, () => {
    console.log('TableManager: Listening on port:', port)
})

setInterval(() => {
    if (app.locals.tables !== undefined && app.locals.tables.length > 0) {
        app.locals.tables.forEach(table => {
            if (table.opts.tsLastCheckTime !== undefined && table.opts.isErrorSubmit === undefined) {
                //console.log(`tsLastCheckTime : ${table.opts.tsLastCheckTime} ,now : ${new Date()}`);
                const tsLastCheckTime = table.opts.tsLastCheckTime.getTime() + (6 * 60000);
                if (new Date().getTime() >= tsLastCheckTime) {
                    submitErrorReport(table.opts.gameServer, table.opts.token, true, table.opts.mode, table.opts.tournament_id).then(status => {
                        if (status !== true)
                            return;
                        table.opts.isErrorSubmit = true;
                        console.log(`Submit Error Report`);
                    });
                }
            }
        });
    }
}, 1000 * 120);

reset_ms();
readMatrixCsvFile();
async function submitErrorReport(gsUrl, token, error, mode, tournament_id = undefined) {
    try {
        const params = new URLSearchParams();
        params.append('api', "report_error");
        params.append('table_token', token);
        params.append('tournament_id', tournament_id);
        params.append('error', error.toString());
        params.append('type', mode);
        params.append('reason', "TS not responding to MS");
        const res = await axios.post(`${gsUrl}/api.php`, params, { timeout: 5000 });
        console.log(res.data.status);
        return (!Boolean(res.data.status ?? false)) ? false : true;
    } catch (err) {
        console.log(`Table Manager service: Notify Reset Error : ${err}`);
        return false;
    }
}
async function reset_ms() {
    try {
        const url = `${process.env.GAME_SERVER}/api.php?api=clear_ms&ms=https://${process.env.HOST}:${process.env.PORT}`
        console.log(`Table Manager service: Notify Reset :${url}`);
        res = await axios.get(url);

        if (!Boolean(res.data.status ?? false)) {
            console.log(`Table Manager service: Notify Reset: Failed.`);
            return { status: false };
        }

        console.log(`Table Manager service: Notify Reset: Success`);

        return { status: true };
    } catch (err) {
        console.log(`Table Manager service: Notify Reset Error : ${err}`);
    }
}
