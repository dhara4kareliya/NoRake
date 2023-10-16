import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import methodOverride from 'method-override';
import { Room } from '../poker/room';
import { BotManager } from '../poker/bot';
import { TourneyInfo } from '../poker/player';
import { TimeOptions, TournamentTable } from '../poker/tournament';
import { TableSeatState } from '../poker/table';
import { SocketLobby } from '../poker/sockets';
import { delay } from '../services/utils';
import moment, { duration } from 'moment';

function destroy(req: Request, res: Response, next: NextFunction) {
    process.exit();
}

function options(req: Request, res: Response, next: NextFunction) {
    res.json(req.app.locals.context.opts);
}

function pause(req: Request, res: Response, next: NextFunction) {
    const room = req.app.locals.context.room as Room;
    room.table.pause();
    res.json({ status: true });
}

function resume(req: Request, res: Response, next: NextFunction) {
    const room = req.app.locals.context.room as Room;
    room.table.resume();
    res.json({ status: true });
}

async function players(req: Request, res: Response, next: NextFunction) {
    const room = req.app.locals.context.room as Room;

    if (room.isWaitingEndroundRes) {
        await new Promise((resolve, reject) => {
            room.on('end_round_finished', resolve);

            setTimeout(() => {
                reject(new Error(`Timeout waiting for EndRound API Response`));
            }, 3000);
        });
    }

    res.json(room.getPlayers().map(player => ({
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        cash: player.cash,
        chips: player.chips,
        created_at: player.created_at,
        seat: player.seat === undefined ? undefined : player.seat.state === TableSeatState.Empty ? undefined : {
            index: player.seat.index,
            money: player.seat.money,
        }
    })));
}

function kickPlayer(req: Request, res: Response, next: NextFunction) {
    const room = req.app.locals.context.room as Room;
    const token = String(req.params.token);
    const player = room.getPlayer(token);
    if (!player)
        return next();
    
    player.leave({
        type: 'kick',
    });

    res.json({ status: true });
}

function close_cash_table(req: Request, res: Response, next: NextFunction) {
    const room = req.app.locals.context.room as Room;
    if(room.options.mode != "cash")
        res.json({ status: false,message:"This Is Not A Cash Game"});
        
    room.table.setClosed(true);
    res.json({ status: true });
}


function migratePlayer(req: Request, res: Response, next: NextFunction) {
    const room = req.app.locals.context.room as Room;
    const userToken = String(req.params.token);
    const player = room.getPlayer(userToken);
    if (!player) 
        return res.status(404).json({ status: false, error: 'Player not found' });
    
    const { server, token } = req.body;
    if (!server || !token)
        return next();

    player!.leave({
        type: 'migrate',
        server,
        token,
    });

    res.json({ status: true });
}

function addBot(req: Request, res: Response, next: NextFunction) {
    const bots = req.app.locals.context.bots as BotManager;

    const seat =  (req.body.seat === undefined) ? undefined : Number(req.body.seat);

    bots.add(seat).then(bot => {
        if (!bot)
            return next();

        res.json({ status: true, id: bot.id });
    });
}

function addUser(req: Request, res: Response, next: NextFunction) {
    const bots = req.app.locals.context.bots as BotManager;

    const userToken = String(req.params.token);

    bots.addBot(userToken).then(bot => {
        if (!bot)
            res.status(404).json({status: false, error: "getUser failed or player already existed"});
        else 
            res.json({ status: true, id: bot!.id });
    });
}

async function addUsers(req: Request, res: Response, next: NextFunction) {
    const bots = req.app.locals.context.bots as BotManager;
    const room = req.app.locals.context.room as Room;
    const socketLobby = req.app.locals.context.lobby as SocketLobby;
    const socketRoomContext = socketLobby.getContext(room.id);

    if (room.isWaitingEndroundRes) {
        await new Promise((resolve, reject) => {
            room.on('end_round_finished', resolve);

            setTimeout(() => {
                reject(new Error(`Timeout waiting for EndRound API Response`));
            }, 3000);
        });
    }
    
    const playersInfo = req.body.data
    let successPlayers = [], failedPlayers = [];

    for (let i = 0; i < playersInfo.length; ++i) {
        if (Boolean(Number(playersInfo[i].is_bot))) {
            const bot = await bots.addBotsByList(playersInfo[i]); 
            !bot ? failedPlayers.push(playersInfo[i].token) : successPlayers.push(playersInfo[i].token);
        } else {
            const user = await socketRoomContext?.addPlayerByApi(playersInfo[i]);
            !user ? failedPlayers.push(playersInfo[i].token) : successPlayers.push(playersInfo[i].token);
        }
    }
    res.json({status: true, successPlayers, failedPlayers})
}

function tourneyInfo(req: Request, res: Response, next: NextFunction) {
    const room = req.app.locals.context.room as Room;
    const infos = req.body.data as TourneyInfo[];
    const players = room.getPlayers();

    if (!players)
        return next();

    players.map(player => {
        infos.map(info => {
            if (info.player_id == player.id) {
                player.onTourneyInfo(info);
            }
        })
    });
    
    res.json({status: true});
}

function updateFreeBalance(req: Request, res: Response, next: NextFunction) {
    const room = req.app.locals.context.room as Room;
    const userToken = String(req.params.token);
    const freeBalance = Number(req.params.balance);
    const player = room.getPlayer(userToken);
    if (!player) 
    return res.status(404).json({ status: false, error: 'Player not found' });

    player.updateFreeBalance(freeBalance);

    res.json({status: true});
}

function startTournament(req: Request, res: Response, next: NextFunction) {
    const room = req.app.locals.context.room as Room;

    room.table.startTournament();
    
    res.json({status: true});
}

function tournamentNextLevel(req: Request, res: Response, next: NextFunction) {
    const room = req.app.locals.context.room as Room;
    const next_level = req.body.next_level;

    room.table.startNextLevel(next_level)

    res.json({status: true});
}

function getTime(req: Request, res: Response, next: NextFunction) {
    let now = moment().valueOf();

    res.json({status: new Date(now).toString()});
}

function getTournamentTableStatus(req: Request, res: Response, next: NextFunction) {
    const room = req.app.locals.context.room as Room;
    const currentLevelOption = (<TournamentTable>(room.table)).currentLevelOption;
    const nextLevelOption = (<TournamentTable>(room.table)).nextLevelOption;
    const players = room.getPlayers();

    res.json({
        sb: currentLevelOption.smallBlind,
        bb: currentLevelOption.bigBlind,
        ante: currentLevelOption.ante,
        level: currentLevelOption.level,
        time_to_start: nextLevelOption.time_to_start,
        num_of_players: players.length,
        balances: players.map(player => {
            return {
                user: player.id, 
                balance: player.chips, 
                seat: player.seat?.index
            }
        })
    });
}


export default express.Router()
.use(
    [ // middlewares used in this api
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
        methodOverride(function (req, res) { // method override for urlencoded POST body with _method variable
            if (req.body && typeof req.body === 'object' && '_method' in req.body) {
              // look in urlencoded POST bodies and delete it
              var method = req.body._method
              delete req.body._method
              return method
            }
        })
    ]
)
.get('/getTime',getTime)
.get('/destroy', destroy)
.get('/options', options)
.get('/pause', pause)
.get('/resume', resume)
.get('/players', players)
.get('/players/:token/kick', kickPlayer)
.get('/close_cash_table',close_cash_table)
.get('/players/:token/add', addUser)
.post('/players/add', addUsers)
.post('/players/:token/migrate', migratePlayer)
.post('/bots', addBot)
.post('/tourney/info', tourneyInfo)
.post('/tournament_next_level', tournamentNextLevel)
.get('/get_table_status', getTournamentTableStatus)
.get('/start_tournament', startTournament)
.get('/update_free_balance/:token/:balance', updateFreeBalance)
.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({ status: false, error: 'Url not found' })
})
.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack)
    res.json({ status: false, error: err.message })
});
