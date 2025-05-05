import { EventEmitter } from 'events';
import winston from 'winston';
import { GameService } from '../services/game';
import { delay } from '../services/utils';
import { BotManager } from './bot';
import { Player, PlayerState, UserMode } from './player';
import { SocketLobby } from './sockets';
import { Table, TableSeat, TableSeatState,InsurancePlayer } from "./table";
import { TournamentGameController } from './tournament';
import { floor4 } from './math';
import path from 'path';
import fs from 'fs';

export interface RoomOptions {
    id: string;
    maxPlayers?: number;
    lostTimeout?: number;
    observerTimeout?: number;
    mode? : 'cash' | 'tournament';
    tournament_id?: string;
    minBuyIn?: number;
    maxBuyIn?: number;
}

type PlayerContext = {
    player: Player;

    lostTimeout?: NodeJS.Timeout;
    observerTimeout?: NodeJS.Timeout;
}

export class Room extends EventEmitter {
    public get id() { return this.options.id; }
    
    private _table!: Table;
    public get table() { return this._table; }

    private contexts: Map<string, PlayerContext> = new Map();

    constructor(public readonly game: GameService, public readonly options: RoomOptions, public readonly logger: winston.Logger) {
        super();

        // default options
        this.options.lostTimeout ??= 30;
        this.options.observerTimeout ??= 80;
    }

    public setTable(table: Table) {
        this.logger.debug(`Room(Table#${table.id}): Starting`);

        this._table = table;

        this._table
            .on('sitdown', (seat) => this.onTableSitDown(seat))
            .on('leave', (seat) => this.onTableLeave(seat))
            .on('remove_tournament', (seat) => this.onTournamentRemove())
            .on('end', () => this.onTableRoundResult())
            .on('turn', (turn) => this.onTableTurn(turn))
            .on('winInsurance', (InsurancePlayers) => this.onWinInsurance(InsurancePlayers))
            .on('reportplayer',(seat,type)=> this.onReportPlayer(seat,type))
            .on('reconnectfailed', (msg) => this.submitErrorReport(msg));


        this.options.maxPlayers ??= this._table.options.numberOfSeats * 2;
    }

    public on(ev: 'join', listener: (player: Player) => void): this;
    public on(ev: 'end_round_finished', listener: (value: unknown) => void): this;
    public on(ev: string, listener: (...args: any[]) => void): this {
        return super.on(ev, listener);
    }

    public join(player: Player) {
        if (this.contexts.size > this.options.maxPlayers!) {
            this.logger.debug(`Room(Table#${this._table.id}): Max players limit reached. Discarding this player(${player.name}).`);
            return false;
        }
	
	const isPlayerExist = this.contexts.get(player.id);
        if (isPlayerExist !== undefined) {
            const player = isPlayerExist.player;
            if(player.mode === UserMode.Observer && this.options.mode === "tournament"){
                this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}):. Leave from observation mode.`);
                player.leave({ type: 'observation_leave' })
            }else {
                this.logger.debug(`Room(Table#${this._table.id}): Player is existed. Discarding this player(${player.name}).`);
            }
        }

        const context: PlayerContext = {
            player
        };
        this.contexts.set(player.id, context);

        player.start(this);
        player
            .on('leaveroom', () => this.onPlayerLeave(player))
            .on('state', (state) => this.onPlayerState(player, state))
            .on('online', () => this.onPlayerOnline(player))
            .on('offline', () => this.onPlayerOffline(player));

        this.emit('join', player);

        if (this.options.mode === 'tournament')
            return true;

        this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}) has joined.`);

        if (player.mode === UserMode.Player && !this.table.options.isRandomTable)
            this.startObserverTimeout(context);
        
        player.on('joinwaitlist', () => this.onPlayerJoinWaitlist(player));

        return true;
    }

    private onPlayerJoinWaitlist(player: Player) {
        const context = this.contexts.get(player.id);
        if (!context)
            return;

        this.clearLostTimeout(context);
        this.clearObserverTimeout(context);
    }

    private onPlayerLeave(player: Player) {
        const context = this.contexts.get(player.id);
        if (!context)
            return;

        this.game.notifyLeaveMT(player.id, this.id, player.thread);

        this.clearLostTimeout(context);
        this.clearObserverTimeout(context);

        this.contexts.delete(player.id);

        this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}) has left.`);
    }

    private onPlayerState(player: Player, state: PlayerState) {
        const context = this.contexts.get(player.id);
        if (!context)
            return;

        if (!player.name.startsWith("BOT"))
            console.log(`onPlayerState shows player (${player.name}) -- ${state}`);
        if (state === PlayerState.Observing)
            this.startObserverTimeout(context);
        else
            this.clearObserverTimeout(context);
    }

    private startObserverTimeout(context: PlayerContext) {
        const player = context.player;
        if (!context.observerTimeout && this.options.observerTimeout) {
            this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Starting observer timeout.`);
        
            context.observerTimeout = setTimeout(() => {
                this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Observer timeout. Leaving now.`);
                player.leave({type: 'timeout'});
            }, this.options.observerTimeout!*1000);
        }
    }

    private clearObserverTimeout(context: PlayerContext) {
        if (!!context.observerTimeout) {
            const player = context.player;
            this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Observer timeout clear.`);
            clearTimeout(context.observerTimeout);
            context.observerTimeout = undefined;
        }
    }

    private onPlayerOnline(player: Player) {
        const context = this.contexts.get(player.id);
        if (!context)
            return;

        this.clearLostTimeout(context);
    }

    private onPlayerOffline(player: Player) {
        const context = this.contexts.get(player.id);
        if (!context)
            return;

        this.table.checkOfflinePlayerAndFold(player);
        
        if (this.options.mode === 'tournament') {
            return;
        }
        
        this.startLostTimeout(context);
    }

    private onTableTurn(turn: number) {
        const seat = this.table.getPlayingSeats().find(seat => seat.index === turn);
        
        // if (!!seat)
        //     this.game.updateTurn(this.id, (seat.player as Player).id);
    }

    private startLostTimeout(context: PlayerContext) {
        this.clearLostTimeout(context);

        const player = context.player;
        this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Starting lost timeout.`);
        
        context.lostTimeout = setTimeout(() => {
            this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Lost timeout. Leaving now.`);
            player.leave({ type: 'offline' });
        }, this.options.lostTimeout!*1000);
    }

    private clearLostTimeout(context: PlayerContext) {
        if (!!context.lostTimeout) {
            const player = context.player;
            this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Lost timeout clear.`);
            clearTimeout(context.lostTimeout);
            context.lostTimeout = undefined;
        }
    }

    private onTableSitDown(seat: TableSeat) {
        const player = seat.player as Player;

        if(this.options.mode === 'tournament' || player.migratePlayer)
            return;

        //this.game.sit(this.id, player.id, seat.index);

        this.game.notifyPlayerSitdown(this.id, player.id);
    }

    private onTableLeave(seat: TableSeat) {
        const player = seat.player as Player;

        setTimeout(() => {
            if (!player.leavePending) {
                if(this.options.mode === 'cash' && (this.table.options.isRandomTable == false || player.exitReason.type != 'migrate')) {
                    this.game.leave(this.id, player.id, player.chips + player.tableBalance, this.table.round);
                }
                player.completeLeavePending();
            }
        }, 100);

        if (player.exitReason !== undefined) {
            if (player.exitReason.type == 'migrate')
                this.game.moveToOtherTable(player.exitReason.server, player.exitReason.info,this.options.tournament_id!)
        }
        
        setTimeout(()=>{      
            if(this.table.leavePlayers.length > 0 && this.table.getSeats().filter(seat => seat.state !== TableSeatState.Empty).length < 2)
            {               
                this.onTableRoundResult();
            }
        },2000);
    }

    private onTournamentRemove() {
        this.game.tournament_remove(this.id);
    }

    private async onTableRoundResult() {
        this.getPlayers()
                    .filter(player => player.leavePending === true)
                    .map(player => { 
                        if(this.options.mode === 'cash' && (this.table.options.isRandomTable == false || player.exitReason.type != 'migrate')) {
                            this.game.leave(this.id, player.id, player.chips + player.tableBalance, this.table.round);
                        }
                        player.completeLeavePending();
                    });

        const players = this.table.getSeats()
            .filter(seat => seat.state !== TableSeatState.Empty)
            .map(seat => ({
                token: (seat.player as Player).id,
                seat: seat.index,
                money: seat.money!,
                pocketBalance:(seat.player as Player).tableBalance
            }));

        if (players.length === 0 && this.options.mode == "tournament") return;

        
        if(this.table.roundLog.settings === undefined)
            this.table.roundLog['settings'] = {};

        this.table.roundLog.settings.table_id = this.id;
        this.table.roundLog.settings.mode = this.options.mode;
        this.table.roundLog.settings.max_players = this._table.options.numberOfSeats;
        this.table.roundLog.settings.min_buy_in = this.options.minBuyIn;
        this.table.roundLog.settings.max_buy_in = this.options.maxBuyIn;
        this.table.roundLog.settings.tournament_id = this.options.tournament_id;

        this.table.roundLog.LeavePlayers = (this.options.mode === "tournament") ? this.table.roundLog.LeavePlayers ?? [] : this.table.getLeavePlayers();
        this.table.roundLog.StayPlayers = this.table.getStayPlayers();

        this.table.isWaitingEndroundRes = true;
        const {status, tables, isDeleteTable, handId} = await this.game.endRound(this.id, this.table.round, this.table.roundRake, players, this.table.roundLog, this.options.tournament_id);

        if (status === 3) {
            for (const player of this.getPlayers()) {
                player.leave({type: 'kick'});
            }
            setTimeout(async () => {
                // process.exit();
                await this.getTournamentErrorLogs();
                await delay(1000);
                this.game.deleteTournamentTables(this.options.tournament_id!);
            }, 3000);
        }else if(status === 2 && this.options.mode === "tournament")
        {
            this.table.roundLog.LeavePlayers = [];
            this.table.setOnePlayerLeft(true);
        }

        if(this.options.mode === "cash" && this.table.leavePlayers.length > 0)
        {
            this.table.roundLog.LeavePlayers.forEach((leavePlayer:any)=>{
                const index = this.table.leavePlayers.indexOf(leavePlayer.user_token);
                if (index > -1) 
                    this.table.leavePlayers.splice(index,1);
            });
        }
       
        console.log(`next_table --------------------for table ${this.id}`, tables);
        if (tables !== undefined && this.table.submitErrorReport !== true && this.table.isClosed !== true) {
            let infos : any = [];

            tables.map((table: any) => {
                table.players.map((player: any) => {
                    infos.push({ server: table.server, token: table.table_token, user_id: player.user_token });
                })
            })

            for (let i = 0; i < infos.length; ++i) {
                const info = infos[i];
                const player = this.getPlayer(info.user_id);
                if (!!player && info.token !== this.id) {
                    console.log('migrate player', info.user_id);
                    const { server, token } = info;

                    
                     let currentChips = this.table.getSeats()
                        .find(seat => (seat.player as Player)?.id === player.id)?.money!;                    

                    const playerInfo = {
                        name: player.name,
                        avatar: player.avatar,
                        country: player.country,
                        main_balance: player.cash,
                        chips: currentChips ?? player.chips,
                        tableBalance: player.tableBalance || 0,
                        token: player.id,
                        mode: player.mode,
                        t: player.thread || '',
                        is_bot: player.name.startsWith("BOT") ? "1" : "0",
                        rating:player.rating,
                        joiningDate:player.joiningDate,
                        free_balance: player.freeBalance,
                        isMigratePlayer:true,
                        isWaitingPlayer:false,
                    };
                    
                    const targetTablePlayers = await this.game.getPlayers(server);
                    if (targetTablePlayers.length >= this._table.options.numberOfSeats) {
                        this.logger.debug(`Abort migration. Target table: (${server}) full`);
                        await this.game.migrationResponse(token, this.table.round, this.options.tournament_id!, false, 'Table overflow');
                        this.submitErrorReport(`Table overflow in round ${this._table.round}`);
                        continue;
                    }

                    if (player.seat === undefined) {
                        await this.game.moveToOtherTable(server, playerInfo,this.options.tournament_id!);
                        if(this.options.mode == "tournament")
                            TournamentGameController.removePendingPlayer(player);
                    }
                    else {
                        player!.leave({
                            type: 'migrate',
                            server,
                            token,
                            info: playerInfo
                        });
                    }
                }
            }
        }

        this.emit('end_round_finished');
        this.table.isWaitingEndroundRes = false;
        
        if (isDeleteTable) {
            this.logger.debug('Got command to delete table from End Round api');
            await delay(5000);
            process.exit();
        }

        this.table.handId = handId ?? 0;
        this.table.scheduleNewRound();
        // console.log(JSON.stringify(this.table.roundLog));
    }

    private async onWinInsurance(InsurancePlayers:InsurancePlayer[]){
        for (const player of InsurancePlayers) {
            const winAmount = player.is_win ? player.insuranceWinAmount : 0;
            const { status } = await this.game.winInsurance(this.id, player.user_id,player.is_win, String(winAmount),this.table.round,this.options.mode ?? "cash",player.insuranceId,this.options.tournament_id);
            if (player.is_win && status == true && player.index !== undefined && this.options.mode === "cash") {
                const seat = this.table.getSeatAt(player.index);
                this.logger.debug(`Seat#${seat.index}: ${seat.player?.name}: collected ${player.insuranceWinAmount} insurance price`);
                console.log(`seat.money(${seat.money}) + player.insuranceWinAmount(${player.insuranceWinAmount}) = ${floor4(seat.money! + player.insuranceWinAmount)}`)
                seat.money = floor4(seat.money! + player.insuranceWinAmount);
            }
        }
    }

    private async onReportPlayer(seat: TableSeat,type:string){
        const reporter = (seat.player as Player).id;
        await this.game.submitReport(this.id,this.id,type,'You send wrong hash',this.table.round,reporter);
    }

    public async getTournamentErrorLogs() {
        if(this.options.mode !== "tournament") return;

        const cwd = process.cwd();
        const logdir = path.resolve(cwd,  `./logs/tournament-${this.options.tournament_id!}`);
        console.log(logdir);
       const files =  fs.readdirSync(logdir);
       for (let index = 0; index < files.length; index++) {
            const file = files[index];
            var data = "";
            if(file.includes('-error') && (data = fs.readFileSync(logdir+"/"+file, 'utf8').toString()) != "")
                await this.game.submitTournamentLog(this.options.tournament_id!,file,data);
        
       }
    }

    public async submitErrorReport(msg:string){
        this.game.submitErrorReport(this.id,true,this.options.mode??'cash',msg,this.options.tournament_id);
        
        if(this.options.mode === "tournament")
            this.game.submitErrorTOMS(this.options.tournament_id!);
    }

    public getPlayers() {
        return [...this.contexts.values()].map(context => context.player);
    }

    public getPlayer(id: string) {
        return this.contexts.get(id)?.player;
    }
	public async setCurrencyRate() {
		const setUsdRate = await this.game.getCurrencyRate();
		this._table.setUsdRate(setUsdRate);
	}
}
