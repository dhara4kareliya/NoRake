const path = require('path')
const { fork } = require('child_process')
const { nanoid } = require('nanoid')
const { checkPlayersCard } = require("./preFlopMatrix");

class PortManager {
    constructor(portBase) {
        this.portBase = portBase
        this.usedPorts = new Set()
    }

    findFree() {
        const maxPort = 1<<16

        for (let port = this.portBase; port < maxPort; ++port) {
            if (!this.usedPorts.has(port))
                return port
        }
        return 0
    }

    register(port) {
        this.usedPorts.add(port)
    }

    unregister(port) {
        this.usedPorts.delete(port)
    }
}

class TableManager {
    constructor(ports) {
        this.ports = ports
        this.tables = []
    }

    register(table) {
        this.tables.push(table)

        this.ports.register(table.server.port)

        return table
    }

    unregisterByProcess(process) {
        const index = this.tables.findIndex(i => i.process === process)
        if (index >= 0) {
            const table = this.tables[index]

            this.ports.unregister(table.server.port)

            this.tables.splice(index, 1)
        }
    }

    find(id) {
        const index = this.tables.findIndex(i => i.opts.token === id)
        if (index < 0)
            return
        
        return this.tables[index]
    }

    getTables() {
        return this.tables
    }

    getTournamentIDs() {
        let IDs = [];
        
        this.tables.map(table => {
            if (table.opts.mode == 'tournament') {
                if (IDs.indexOf(table.opts.tournament_id) == -1) {
                    IDs.push(table.opts.tournament_id);
                }
            }
        });

        return IDs;
    }

    getTournamentTables(id) {
        return this.tables.filter(table => 
            table.opts.mode == 'tournament' && table.opts.tournament_id == id
        );
    }
}

module.exports = (opts = {}) => {
    const portBase = Number(opts.portBase || process.env.TABLE_SERVER_PORT_BASE || 8082)
    const defaultHost = opts.host || process.env.HOST || 'localhost'
    const gameServer = opts.gameServer || process.env.GAME_SERVER || 'http://localhost:3000/'
    const avatarServer = opts.avatarServer || process.env.AVATAR_SERVER || gameServer
    const tableServerScript = opts.tableServerScript || process.env.TABLE_SERVER_SCRIPT || '../TableServer/dist/src/main.js'
    const tableServerModule = path.resolve(opts.baseDir || path.dirname(process.argv[1]), tableServerScript)
    const axios = require('axios');
    const https = require('https');

    const httpsAgent = new https.Agent({ rejectUnauthorized: false, });

    const ports = new PortManager(portBase)
    const tables = new TableManager(ports)
    let nextTableServerId = 1

    setInterval(() => {
        get_tourney_info();
        check_tournament_cancel_time();
    }, 10 * 1000);

    async function get_tourney_info() {
        const tourn_ids= tables.getTournamentIDs();

        if (tourn_ids.length > 0) {
            // console.log("current tournaments id")
            // console.log(tourn_ids.join(","));
        }

        for (let i = 0; i < tourn_ids.length; ++i) {
            const id = tourn_ids[i];
            const tourn_tables = tables.getTournamentTables(id);

            if (tourn_tables.length === 0) continue;

            let res;

            try {
                const url = `${tourn_tables[0].opts.gameServer}/api.php?api=get_tournaments_user_chip&tournament_id=${id}`
                // console.log(`Table Manager service: Get tournament position :${url}`);
                res = await axios.get(url);
            }
            catch(err) {
                console.log(`Get Tournamnet Position Error : ${err}`);
                continue;
            }

            if (!Boolean(res.data.status ?? false)) {
                console.log(`Table Manager service: Get tournament(id: ${id}) position: Failed.`);
                continue;
            }
            
            for (let j = 0; j < tourn_tables.length; ++j) {
                const table = tourn_tables[j];
                try {
                    const tsUrl = `https://${defaultHost}:${table.opts.port}/api/tourney/info`
                    // console.log(`Send tournament position data : ${tsUrl}`);
                    await axios.post(tsUrl, res.data , { httpsAgent });
                }
                catch(err) {
                    console.log(`Send tournament position Error : ${err}`);
                    continue;
                }
            }
            
        }
    }

    function get_options_for_new_instance(opts) {
        const port = ports.findFree()
        if (!port)
            return

        opts = {
            token: nanoid(),
            port,
            gameServer,
            avatarServer,
            ...opts,
            id: nextTableServerId++,
        }

        return opts
    }

    function create_table_server(opts) {
        return new Promise((resolve, reject) => {
            console.log(`creating norake-poker-table server with option:`, opts)

            opts = get_options_for_new_instance(opts)

            console.log("get_options_for_new_instance")
            console.log(opts);
            
            if (!opts) {
                console.log(`Failed to configure new table server instance`)
                return reject(new Error(`Table server config error`))
            }

            const child = fork(tableServerModule)

            child.send({ type: 'init', data: opts })

            child.on('message', m => {
                if (m.type == 'register') {
                    console.log(`Registering table server:`, m.data.id)
                    const server = m.data.server;
				          	
                    const table = {
                        opts:{...opts,tsLastCheckTime:new Date()},
                        process: child,
                        server: { ...server, host: server.host || defaultHost },
                    }
                    tables.register(table)

                    resolve(table)
                } else if (m.type == 'preFlopAllinPlayersCards') {
                    child.send({ type: "preFlopAllinPlayersCards", data: checkPlayersCard(m.data) });
                } else if (m.type == 'checkTS') {
                    const table = tables.find(m.id);
					          if(table !== undefined)
						            table.opts.tsLastCheckTime = new Date();
                }
            });
            child.on('close', code => {
                tables.unregisterByProcess(child)
                console.log(`norake-poker-table server exited with code ${code}`);
            })

            child.on('error', err => reject(err))
        })
    }

    async function delete_tournament_tables(id) {
        const tourn_tables = tables.getTournamentTables(id)

        for (let j = 0; j < tourn_tables.length; ++j) {
            const table = tourn_tables[j]
            await delete_table(table)
        }
    }

    function delete_table(table) {
        return new Promise((resolve, reject) => {
            if (!table) {
                return resolve()
            }

            const child = table.process

            child.send({ type: 'destroy' })

            child.on('close', code => {
                resolve({ status: true })
            })

            child.on('error', err => reject(err))
        })
    }

    function delete_table_server(id) {

        return new Promise((resolve, reject) => {
            const table = tables.find(id)
            
            if (!table) {
                return resolve()
            }

            const child = table.process

            child.send({ type: 'destroy' })

            child.on('close', code => {
                resolve({ id })
            })

            child.on('error', err => reject(err))
        })
    }

    function find_table_server(id) {
        return tables.find(id)
    }

    async function start_tournament_next_level(tournament_id, next_level) {
        const tourn_tables = tables.getTournamentTables(tournament_id)
        
        // console.log(tourn_tables)
        
        if (tourn_tables != undefined) {
            for (let i = 0; i < tourn_tables.length; ++i) {
                const table = tourn_tables[i];
                // try {
                //     const tsUrl = `https://${defaultHost}:${table.opts.port}/api/tournament_next_level`
                //     // console.log(`MS -- tournament table id (${table.opts.token}) -- next level info: ${next_level}`);
                //     await axios.post(tsUrl, {next_level: next_level}, { httpsAgent });
                // }
                // catch(err) {
                //     console.log(`MS -- tournament table id (${table.opts.token}) -- next level info: ${next_level} -- Failed`, err)
                // }
            }
        }
        
        return tourn_tables.map(table => table.opts.token)
    }

    async function start_tournament(tournament_id) {
        const tourn_tables = tables.getTournamentTables(tournament_id)
        
        // console.log(tourn_tables)
        
        if (tourn_tables != undefined) {
            for (let i = 0; i < tourn_tables.length; ++i) {
                const table = tourn_tables[i];
                if (table.opts.isTournamentStarted == true) continue;

                try {
                    const tsUrl = `https://${defaultHost}:${table.opts.port}/api/start_tournament`
                    console.log(`MS -- tournament table id (${table.opts.token}) --start tournament: ${tsUrl}`);
                    let res = await axios.get(tsUrl, { httpsAgent });
                    console.log(`start tournament: ${JSON.stringify(res.data)}`);
                    table.opts.isTournamentStarted = true;
                } catch (err) {
                    console.log(`MS -- tournament table id (${table.opts.token}) -- start tournament -- Failed`, err)
                    continue;
                }
            }
        }
        
        return tourn_tables.map(table => table.opts.token)
    }

    async function submit_tournament_error(tournament_id) {
        return new Promise((resolve, reject) => {
            const tourn_tables = tables.getTournamentTables(tournament_id);
            if (tourn_tables != undefined && tourn_tables.length > 0) {
                for (let i = 0; i < tourn_tables.length; ++i) {
                    const child = tourn_tables[i].process;
                    child.send({ type: "tournamentGetError" });
                }
            }
            return resolve(true);
        });
    }

    async function close_tournament(tournament_id) {
        const tourn_tables = tables.getTournamentTables(tournament_id);
        if (tourn_tables != undefined && tourn_tables.length > 0) {
            for (let i = 0; i < tourn_tables.length; ++i) {
                const table = tourn_tables[i];
                try {
                    const tsUrl = `https://${defaultHost}:${table.opts.port}/api/close_table`
                   // console.log(`close tournament  : ${tsUrl}`);
                    await axios.get(tsUrl,{ httpsAgent });

                } catch (err) {
                    console.log(`Close tournament Error : ${err}`);
                    continue;
                }
            }
        }
        return true;
    }

    async function check_tournament_cancel_time() {
        const tourn_ids = tables.getTournamentIDs();
        if (tourn_ids.length < 1) return;
        for (let i = 0; i < tourn_ids.length; ++i) {
            const id = tourn_ids[i];
            const tourn_tables = tables.getTournamentTables(id);
            if (tourn_tables.length === 0) continue;

            const now = new Date();
            const table = tourn_tables[0];

            const isTournamentStarted = tourn_tables.filter(tbl => tbl.opts.isTournamentStarted == true).length;

            if (isTournamentStarted > 0 && isTournamentStarted != tourn_tables.length) {
				        start_tournament(id);
                continue;
            }
			
            if (table.opts.isTournamentStarted === true) continue;

            var tournamentStartTime = table.opts.levels[0]['time_to_start'];
            const cancelWaitingTime = table.opts.cancelWaitingTime ?? 20;
            if (tournamentStartTime === undefined) continue;
            tournamentStartTime = new Date(tournamentStartTime);

            const tournamentCancelTime = new Date(tournamentStartTime.getTime() + (cancelWaitingTime * 60 * 1000));
           // console.log(`now : ${now},tournamentStartTime:${tournamentStartTime},tournamentCancelTime : ${tournamentCancelTime},cancelWaitingTime : ${cancelWaitingTime}`);

            if (Date.parse(now) < Date.parse(tournamentStartTime)) continue;

            if (Date.parse(now) < Date.parse(tournamentCancelTime)) continue;

            try {
                const url = `${tourn_tables[0].opts.gameServer}/api.php?api=tournament_cancel&tournament_id=${id}&reason=Tournament was cancelled by waiting for players`;
                console.log(`Table Manager service: tournament cancel :${url}`);
                const res = await axios.get(url, { httpsAgent });
                if (Boolean(res.data.status ?? false)) {
                    for (let j = 0; j < tourn_tables.length; ++j) {
                        const table = tourn_tables[j]
                        delete_table(table);
                    }
                }
            } catch (err) {
                console.log(`tournament cancel : ${err}`);
                continue;
            }
        }
    }

    return ({
        create_table_server,
        delete_table_server,
        delete_tournament_tables,
        find_table_server,
        tables: tables.tables,
        start_tournament_next_level,
        start_tournament,
        submit_tournament_error,
        close_tournament
    })
}
