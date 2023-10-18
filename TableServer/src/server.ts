import https from 'https';
import http from 'http';
import path from 'path';
import fs from 'fs';
import * as io from 'socket.io';
import dotenv from 'dotenv';
import moment from 'moment';
import { Application } from 'express';
import app from './app';
import { GameService, GameServiceOptions } from './services/game';
import { SocketLobby } from './poker/sockets';
import { BotManager, BotManagerOptions } from './poker/bot';
import { Table, TableOptions, SideBetOptions } from "./poker/table";
import { Room, RoomOptions } from './poker/room';
import { CashGameController, CashTable, CashTableOptions } from './poker/cash';
import { TimeOptions, TournamentGameController, TournamentGameControllerOptions, TournamentTable, TournamentTableOptions } from './poker/tournament';
import winston from 'winston';
import { defaultSideBetOptions } from './sidebet';

export type ServerOptions = {
    host?: string,
    port?: number,

    gameServer?: string,
    avatarServer?: string,

    token: string,
    lostTimeout?: number,

    id: number,
    name: string,
    gameType: string,
    numberOfSeats: number,
    smallBlind: number,
    bigBlind?: number,
    ante?: number,
    timeToReact?: number,
    timebankMax?: number,
    timebankBonus?: number,
    rake?: number,
    rakeCap?: number,
    rakePreFlop?: boolean,
    rakeSplitPot?: boolean,
    rakeRound?: boolean,
    observerTimeout?: number,
    sitoutTimeout?: number,

    // bot options
    botCount?: number|[number,number],
    botAddInterval?: number|[number,number],
    botAddCount?: number|[number,number],

    mode?: 'cash' | 'tournament',
    tournament_id?: string,

    // cash game options
    minBuyIn?: number,
    maxBuyIn?: number,

    // tournament game options
    startTime?: string,
    levels?: TimeOptions[],
    playersInfo?: any[],
    sideBetOptions?: SideBetOptions[][],
};

export async function createServer(opts: ServerOptions) {
    const cwd = process.cwd();
    dotenv.config({
        path: path.resolve(cwd, '.env')
    });
    
    const logdir = path.resolve(cwd, process.env.LOGDIR ?? ('./logs' + (opts.tournament_id ? `/tournament-${opts.tournament_id}` : '')));

    opts.host ??= process.env.HOST ?? 'localhost';
    opts.port ??= Number(process.env.PORT ?? 8081);
    opts.gameServer ??= process.env.GAME_SERVER ?? 'http://localhost:3000/';
    opts.avatarServer ??= process.env.AVATAR_SERVER ?? 'http://localhost:3000/';
    opts.bigBlind ??= opts.smallBlind * 2;
    opts.minBuyIn ??= opts.bigBlind * 20;
    opts.mode ??= 'cash';

    try {
        const timestamp = moment().format("YYYYMMDDHHmmss");
        const logger = await createLogger(logdir, `table-${opts.id}-${timestamp}.log`, `table-${opts.id}-${timestamp}-debug.log`, `table-${opts.id}-${timestamp}-socket.log`, `table-${opts.id}-${timestamp}-error.log`);

        process.on('uncaughtException', function (err) {
            logger.error('Crashing Exception: \n' + err.stack);
        });

        const http = await createHttpServer({ port: opts.port, app }, logger);
        const io = createSocketServer(http, logger);
        const game = createGameService({ baseURL: opts.gameServer, tsURL: `${opts.host}:${opts.port}` }, logger);

        const lobby = createLobby(io, logger);

        let table: Table;

        const roomOptions = {
            id: opts.token,
            observerTimeout: opts.observerTimeout,
            lostTimeout: opts.lostTimeout,
            mode: opts.mode,
            minBuyIn: opts.minBuyIn,
            maxBuyIn: opts.maxBuyIn,
            tournament_id: opts.tournament_id ?? '',
        }
        const room = createRoom(lobby, game, roomOptions, logger);

        const tableOptions = {
            id: opts.id,
            name: opts.name,
            gameType: opts.gameType,
            numberOfSeats: opts.numberOfSeats,
            smallBlind: opts.smallBlind,
            bigBlind: opts.bigBlind,
            timeToReact: opts.timeToReact,
            timebankMax: opts.timebankMax,
            timebankBonus: opts.timebankBonus,
            rake: opts.rake,
            rakeCap: opts.rakeCap,
            rakePreFlop: opts.rakePreFlop,
            rakeSplitPot: opts.rakeSplitPot,
            rakeRound: opts.rakeRound,
            observerTimeout: opts.observerTimeout,
            sitoutTimeout: opts.sitoutTimeout,
            sideBetOptions: opts.sideBetOptions ?? defaultSideBetOptions,
        };

        if (opts.mode === 'cash') {
            const cashTableOptions = {
                ...tableOptions,                
                minBuyIn: opts.minBuyIn,
                maxBuyIn: opts.maxBuyIn,
            };
            table = createCashGame(room, cashTableOptions, logger);
            game.setTable(table);
        }
        else if (opts.mode === 'tournament') {
            const tournamentOptions = {
                startTime: opts.startTime !== undefined ? moment(opts.startTime, "YYYY-MM-DD HH:mm:ss").valueOf() : moment().valueOf(),
                timeline: opts.levels ?? [],
            };
            const tournamentTableOptions = {
                ...tableOptions,             
                ante: opts.ante!,
                startTime: opts.startTime!,
                levels: opts.levels!
            }
            table = createTournamentGame(room, tournamentTableOptions, tournamentOptions, logger);
            game.setTable(table);
        }
        
        const botOptions = {
            initialCount: opts.botCount ?? 0,
            addInterval: opts.botAddInterval ?? 0,
            addCount: opts.botAddCount ?? 0,
        };
        const bots = startBotManager(room, botOptions, logger);

        const socketRoomContext = lobby.getContext(room.id);
        
        const playersInfo = opts.playersInfo;
        if (!!playersInfo) {
            for (let i = 0; i < playersInfo.length; ++i) {
                if (Boolean(Number(playersInfo[i].is_bot))) {
                    await bots.addBotsByList(playersInfo[i]); 
                } else {
                    await socketRoomContext?.addPlayerByApi(playersInfo[i]);
                }
            }
        }

        return app.locals.context = {
            opts,
            logger,
            http,
            io,
            lobby,
            bots,
            room,
            table: table!,
        };
    }
    catch (err) {
        console.error(err);

        process.exit(1);
    }
}

async function createLogger(logdir: string, infofilename: string, debugfilename: string, socketfilename: string, errorfilename: string) {
    await fs.promises.mkdir(logdir, { recursive: true });

    return winston.createLogger({
        levels: {
            info: 6,
            debug: 7,
            notice: 5,
            error: 4
        },
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({ message, timestamp }) => `${timestamp}: ${message}`),
        ),
        transports: [
            new winston.transports.Console({
                level: 'debug',
                debugStdout: true,
            }),
            new winston.transports.File({
                level: 'debug',
                options: { flags: 'w' },
                dirname: logdir,
                filename: debugfilename,
            }),
            new winston.transports.File({
                level: 'info',
                options: { flags: 'w' },
                dirname: logdir,
                filename: infofilename,
            }),
            new winston.transports.File({
                level: 'notice',
                options: { flags: 'w' },
                dirname: logdir,
                filename: socketfilename,
            }),
            new winston.transports.File({
                level: 'error',
                options: { flags: 'w' },
                dirname: logdir,
                filename: errorfilename,
            })
        ]
    });
}

function createHttpServer(opts: { port: number, app?: Application, }, logger: winston.Logger) {
    // return new Promise<https.Server>((resolve, reject) => {
    return new Promise<http.Server | https.Server>((resolve, reject) => {
        logger.debug(`Starting table server with port: `, opts.port);
        
        let server: https.Server | http.Server = http.createServer(app);
        
        console.log(process.env.mode);
        if (process.env.mode === 'production'){
            server = https
                .createServer({
                    key: fs.readFileSync("ssl/server149.xite.io-key.pem"),
                    cert: fs.readFileSync("ssl/server149.xite.io-crt.pem"),
                    rejectUnauthorized: false
                }, opts?.app);
        }

        server.listen(opts!.port)
        .on('error', (err: Error) => {
            logger.debug(`Server error: `, err);
            reject(err);
        })
        .on('listening', () => {
            logger.debug(`Listening on port: ${opts.port}`);
            resolve(server);
        });
    })
}

function createSocketServer(httpServer: https.Server | http.Server, logger: winston.Logger) {
    logger.debug(`Starting socket.io server`);

    // socketio setup
    const opts = {
        pingInterval: 10000,
        pingTimeout: 5000,
        cors: {
            // for cors settings of unity WebGL target,
            // refer https://docs.unity3d.com/Manual/webgl-networking.html
            origin: '*',
            methods: ['GET', 'POST', 'OPTIONS'],
            credentials: true,
            allowedHeaders: ['Accept', 'X-Access-Token', 'X-Application-Name', 'X-Request-Sent-Time']
        }
    };

    return new io.Server(httpServer, opts);
}

function createGameService(opts: GameServiceOptions, logger: winston.Logger) {
    logger.debug(`Creating game service.`, opts);

    return new GameService(opts, logger);
}

function createLobby(io: io.Server, logger: winston.Logger) {
    logger.debug(`Creating lobby.`);

    const lobby = new SocketLobby(io, logger);
    lobby.start();
    return lobby;
}

function createRoom(lobby: SocketLobby, game: GameService, options: RoomOptions, logger: winston.Logger) {
    logger.debug(`Creating room.`, options);
    const room = new Room(game, options, logger);
    lobby.register(room);
    return room;
}

function createCashGame(room: Room, tableOptions: CashTableOptions, logger: winston.Logger) {
    logger.debug(`Creating cash table.`, tableOptions);
    const table = new CashTable(tableOptions, logger);

    logger.debug(`Creating cash game controller.`);
    const controller = new CashGameController(room, table, logger);
    controller.start();

    return table;
}

function createTournamentGame(room: Room, tableOptions: TournamentTableOptions, controllerOptions: TournamentGameControllerOptions, logger: winston.Logger) {
    logger.debug(`Creating tournament table.`, tableOptions);

    const table = new TournamentTable(tableOptions, logger);

    logger.debug(`Creating tournament game controller.`, controllerOptions);
    const controller = new TournamentGameController(room, table, controllerOptions, logger);
    controller.start();

    return table;
}

function startBotManager(room: Room, options: BotManagerOptions, logger: winston.Logger) {
    logger.debug(`Creating bot manager.`);
    const bots = new BotManager(room, options, logger);
    bots.start();
    return bots;
}
