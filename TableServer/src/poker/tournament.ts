import { setTimeout as setTimeoutA } from "timers/promises";
import { TableSeatState, Table, TableSeat, TableRoundStartContext, TableOptions } from "./table";
import { Room } from "./room";
import { Player } from "./player";
import { PFLogic } from "./pfl";
import winston from "winston";
import moment, { duration } from 'moment';
import { delay } from "../services/utils";

export interface TournamentTableOptions extends TableOptions {
    ante: number;
    levels: TimeOptions[],
}

export class TournamentTable extends Table {
    
    private _pfl: PFLogic;
    
    private level: number = 0;
    private duration?: number = 0;
    private displaySB: number = 0;
    private displayBB?: number = 0;
    private displayAnte?: number = 0;
    private nextSB?: number = 0;
    private nextBB?: number = 0;
    public currentLevelOption: any;
    public nextLevelOption: any;
    private tournamentStartTime:string = "";

    private breakTime: boolean = false;

    private nextLevelFlag = false;
    private onePlayerTimerInterval?: NodeJS.Timer = undefined;

    constructor(options: TournamentTableOptions, logger: winston.Logger) {
        super(options, logger);
        
        this._roundEnabled= false;
        this.tournamentStartTime = (options.levels.length != 0) ? options.levels[0]['time_to_start'] : "";

        // this.currentLevelOption = {
        //     type: "level", 
        //     level: options.current_level, 
        //     bigBlind: options.bigBlind,
        //     smallBlind: options.smallBlind,
        //     ante: options.ante
        // };
        // this.nextLevelOption = options.levels[0];

        // const duration = (moment(this.nextLevelOption.time_to_start, "YYYY-MM-DD HH:mm:ss").valueOf() - moment(options.startTime, "YYYY-MM-DD HH:mm:ss").valueOf()) / 1000;
        // this.setLevel(this.currentLevelOption.level, this.currentLevelOption.smallBlind, this.currentLevelOption.bigBlind, this.currentLevelOption.ante, duration);
        // this.setNextLevel(this.nextLevelOption.smallBlind, this.nextLevelOption.bigBlind);
        // this.setCurrentDisplayLevel(
        //     { level: this.currentLevelOption.level, 
        //         smallBlind: this.currentLevelOption.smallBlind, 
        //         bigBlind: this.currentLevelOption.bigBlind, 
        //         ante: this.currentLevelOption.ante, 
        //         duration: duration,
        //         nextBB: this.nextLevelOption.bigBlind,
        //         nextSB: this.nextLevelOption.smallBlind});

        this._pfl = new PFLogic();
    }

    public setLevel(currentLevel: any) {
        this.log(`Level: ${currentLevel.level}, sb: $${currentLevel.smallBlind}, bb: $${currentLevel.bigBlind}, ante: $${currentLevel.ante}`);
        
        this.level = currentLevel.level;
        this.setBlinds(currentLevel.smallBlind, currentLevel.bigBlind);
        this._ante = currentLevel.ante ?? 0;
        this.duration = currentLevel.duration;

        this.currentLevelOption = currentLevel;
    }

    public setNextLevel(nextLevel: any) {
        this.nextSB = nextLevel.smallBlind;
        this.nextBB = nextLevel.bigBlind;

        this.nextLevelOption = nextLevel;
    }

    public setCurrentDisplayLevel(currentLevel: any, nextLevel: any) {
        this.displaySB = currentLevel.smallBlind;
        this.displayBB = currentLevel.bigBlind;
        this.displayAnte = currentLevel.ante;
        this.level = currentLevel.level;
        this.duration = currentLevel.duration;
        this.nextBB = nextLevel.bigBlind;
        this.nextSB = nextLevel.smallBlind;

        this.emit('levelchange');
    }

    public setBreak(value: boolean = true, duration: number = 0) {
        if (this.breakTime === value)
            return;

        this.breakTime = value;

        if (value) {
            this.log(`Entering break time.`);
            this.duration = duration;
            this.pause();
        }
        else {
            this.log(`Exiting break time.`);
            this.resume();
        }
    }

    public getSettings() {
        let now = moment().valueOf();
        console.log(`now ${new Date(now)}`);
        return {
            ...super.getSettings(),
            mode: 'tournament',
            level: this.level,
            ante: this._ante,
            duration: this.duration,
            nextSB: this.nextSB,
            nextBB: this.nextBB,
            displaySB: this.displaySB,
            displayBB: this.displayBB,
            displayAnte: this.displayAnte,
            tournamentStartTime: this.tournamentStartTime
        };
    }

    public getStatus() {
        return {
            ...super.getStatus(),
            breakTime: this.breakTime && this.paused,
            duration: this.duration,
        };
    }

    protected onLeave(seat: TableSeat) {
        this._pfl.playerLeaves(seat.index);

        if (this.getStayPlayers().length === 1)
            if (!this.onePlayerTimerInterval) {
                this.onePlayerTimerInterval = setInterval(() => { 
                    
                    this.log(`Stayed player length: ${this.getStayPlayers().length}`);
                    if (this.getStayPlayers().length != 1) {
                        clearInterval(this.onePlayerTimerInterval!);
                        this.onePlayerTimerInterval = undefined;
                    }
                    else {
                        this.emit('end'); 
                    }
                }, 5000);
            }
    }

    protected onSeatState(seat: TableSeat) {
        if (seat.state === TableSeatState.SitOut) {
            this._pfl.playerSitOut(seat.index, true);
        }
        else if (seat.state === TableSeatState.Joining) {
            this._pfl.playerLeaves(seat.index);
        }
    }

    protected getLeavePlayers() {
        return [
            ...this._selfOutPlayers, 
            ...this.getSeats()
            .filter(seat => seat.state !== TableSeatState.Empty && seat.money! <= 0)
            // .map(seat => {return {user_id: (seat.player as Player)?.id, chips: seat.money}})
            .map(seat => {return {user_token: (seat.player as Player)?.id}})
        ];
    }

    protected startTurnTimer() {
        this.stopTurnTimer();

        const seat = this._seats[this._context.turn!];
        this._turnTimeout = setTimeout(() => {
            this.log(`Seat#${seat.index}(${seat.player?.name}): Turn timer timeout. Fold and Set Fold Any Bet.`);
            this.emit('message', true, `Turn timer timeout. Fold and Set Fold Any Bet.`);
            this.action(seat, 'fold');
            this.emit('foldanybet', seat);
        }, (this.options.timeToReact! + seat.timebank!) * 1000);
        this._turnTimer.start();
    }

    public getStayPlayers() {
        const seats = this.getSeats();

        return this.getSeats()
            .filter(seat => seat.state !== TableSeatState.Empty && seat.money! > 0)
            // .map(seat => {return {user_id: (seat.player as Player)?.id, chips: seat.money}})
            .map(seat => {return {user_token: (seat.player as Player)?.id}})
    }

    public addSelfOutPlayer(seat?: TableSeat) {
        if (!seat) return;

        this._selfOutPlayers.push({user_id: (seat.player as Player)?.id, chips: seat.money})
    }

    public startTournament() {
        this._roundEnabled = true;

        this.scheduleNewRound();
    }

    public startRound() {
        // try to add new players
        this.getWaitingSeats().forEach(seat => {
            if (!(seat.play ?? 0)) {
                if (this._pfl.canjoinNow(seat.index, false, true))
                    this._pfl.addPlayer(seat.index, false);
            }
        });
            
        const list = this._pfl.run(this.options.bigBlind, this.options.smallBlind, false);

        const start: TableRoundStartContext = {
            seats: [],
            seatOfDealer: 0,
        };
        list.forEach(res => {
            if (!res.emptySit) {
                start.seats.push({
                    index: res.sitIndex,
                    ante: this._ante,
                });
            }

            if (res.isD) start.seatOfDealer = res.sitIndex;
            if (res.isBB) start.seatOfBigBlind = res.sitIndex;
            if (res.isSB) start.seatOfSmallBlind = res.sitIndex;
            if (res.noBB) start.noBB=res.noBB;
        });

        return start;
    }

    protected onEnd() {
        this.getWaitingSeats().forEach(seat => {
            if (seat.money! <= 0) {
                this.log(`Seat#${seat.index}(${seat.player?.name}): Player has run out money.`);
                this.leave(seat);
            }
        });

        if (this.nextLevelFlag) {
            if (isBreakOptions(this.currentLevelOption)) {
                this.log(`--- BREAK TIME START ---`);
                this.setBreak(true, this.currentLevelOption.duration);
                // if (isLevelOptions(this.nextLevelOption))
                    this.setNextLevel(this.nextLevelOption);
            } 
            else if (isLevelOptions(this.currentLevelOption)) {

                this.log(`--- LEVEL START: ${this.currentLevelOption.level} ---`);
                this.setLevel(this.currentLevelOption);
                // if (isLevelOptions(this.nextLevelOption))
                    this.setNextLevel(this.nextLevelOption);
            }

            this.nextLevelFlag = false;
        }
    }

    public startNextLevel(nextLevelOption: any) {
        this.nextLevelFlag = true;

        this.setCurrentDisplayLevel(this.nextLevelOption, nextLevelOption);

        if (isBreakOptions(this.currentLevelOption)) {
            this.log(`--- BREAK TIME END ---`);

            this.currentLevelOption = this.nextLevelOption;
            this.nextLevelOption = nextLevelOption;
            
            this.setLevel(this.currentLevelOption);
            if (isLevelOptions(this.nextLevelOption))
                this.setNextLevel(this.nextLevelOption);

            this.setBreak(false);

            return;
        }
        else if (isLevelOptions(this.currentLevelOption))
            this.log(`--- LEVEL END: ${this.currentLevelOption.level} ---`);
        
        this.currentLevelOption = this.nextLevelOption;
        this.nextLevelOption = nextLevelOption;
    }
}

export interface TimeOptions {
    time_to_start: string;
    duration?: number;
    type: string;
}

export interface LevelOptions extends TimeOptions {
    type: 'level';
    level: number;
    smallBlind: number;
    bigBlind?: number;
    ante?: number;
}

function isLevelOptions(value: any): value is LevelOptions {
    return value !== undefined && 'type' in value && value.type === 'level';
}

export interface BreakOptions extends TimeOptions {
    type: 'break';
}

function isBreakOptions(value: any): value is BreakOptions {
    return value !== undefined && 'type' in value && value.type === 'break';
}

export interface TournamentGameControllerOptions {
    startTime?: number;
    timeline: TimeOptions[];
}

export class TournamentGameController {
    private static pendingPlayers: Player[] = [];
    private idleTimeout?: NodeJS.Timeout;
    private lastRoundEnd: boolean = true;
    private lastRound: boolean = false;

    constructor(private readonly room: Room, private readonly table: TournamentTable, private readonly options: TournamentGameControllerOptions, private readonly logger: winston.Logger) {
    }

    private log(message?: any, ...optionalParams: any[]) {
        this.logger.debug(`TournamentGame(Table#${this.table.id}): ${message}`, ...optionalParams);
    }

    public static removePendingPlayer(player: Player) {
        const pendingPlayers = TournamentGameController.pendingPlayers;
        const index = pendingPlayers.indexOf(player);
        if (index > -1) {
            console.log("Remove Pending Player:", player.id);
            pendingPlayers.splice(index, 1);
        }
    }

    public start() {
        this.log(`Starting tournament game.`);

        this.room.setTable(this.table);

        this.room.on('join', (player) => this.onPlayerJoin(player));
        this.table.on('leave', (seat) => this.onLeaveFromTable(seat));
        this.table.on('end', () => this.onRoundEnd());

        this.run();
    }

    private onPlayerJoin(player: Player) {
        if (!player.chips)
            return;

        TournamentGameController.pendingPlayers.push(player);
        this.processPendingPlayers();
    }

    private onRoundEnd() {
        this.processPendingPlayers();
    }

    private onLeaveFromTable(seat: TableSeat) {
        this.processPendingPlayers();
        
        if(this.table.getEmptySeats().length >= this.table.getSeats().length) {
            this.setIdleStatus();
        }
    }

    private checkIdleStatus() {
        return this.table.getEmptySeats().length >= this.table.getSeats().length;
    }

    private setIdleStatus() {
        if (!!this.idleTimeout) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = undefined;
        }
        this.idleTimeout = setTimeout(() => {
            if(this.checkIdleStatus()) {
                this.table.removeTournament();
            }
        }, (10 * 60) * 1000);
    }

    private processPendingPlayers() {
        setTimeout(() => {
            const pendingPlayers = TournamentGameController.pendingPlayers;

            while (pendingPlayers.length > 0) {
                const seat = this.table.getEmptySeats()[0];
                if (!seat)
                    break;
                
                const player = pendingPlayers.shift()!;
                this.sitDown(player, seat);
            }
        }, 100);
    }

    private sitDown(player: Player, seat: TableSeat) {
        player
            .on('action', (action, bet?) => this.onPlayerAction(player, action, bet))
            .on('showcards', () => this.onPlayerShowCards(player))
            .on('sitin', () => this.onPlayerSitIn(player))
            .on('chat', (msg) => this.onPlayerChat(player, msg));

        player.addTableListener();

        this.log(`Player(${player.name}) sitdown. seat: ${seat.index}`);
        this.table.sitDown(seat, player);

        this.log(`Player(${player.name}) buyin. chips: ${player.chips}`);
        this.table.buyIn(seat, player.chips);
    }

    private onPlayerChat(player: Player, msg: string) {
        this.table.doBroadcastChat(player, msg);
    }

    private onPlayerAction(player: Player, action: string, bet?: number) {
        if (!player.seat) {
            this.log(`Player(${player.name}) didn't sit down. Discarding action.`);
            return;
        }

        if (action !== 'fold' && action !== 'bet') {
            this.log(`Player(${player.name}) did invalid action. action: ${action}. Discarding action.`);
            return;
        }

        this.table.action(player.seat, action as any, bet);
    }

    private onPlayerShowCards(player: Player) {
        if (!player.seat) {
            this.log(`Player(${player.name}) didn't sitdown. Discarding showdown.`);
            return;
        }

        this.table.showCards(player.seat);
    }

    private onPlayerSitIn(player: Player) {
        if (!player.seat) {
            this.log(`Player(${player.name}) didn't sitdown. Discarding sitin.`);
            return;
        }

        this.table.sitIn(player.seat);
    }

    private async run() {
        // let startTime = this.options.startTime ?? moment().valueOf();
        
        const timeline = this.options.timeline;
        if (timeline.length === 0)
            return;

        let startTime = moment(timeline[0].time_to_start, "YYYY-MM-DD HH:mm:ss").valueOf();
        // initial break time
        let now = moment().valueOf();
        console.log(`now ${new Date(now)} & startTime ${new Date(startTime)}`);
        
        if(startTime < now) 
        {
            console.log("start time is already passed");
        }

        const delayedHours = Math.floor((startTime - now) / 60 / 1000);
        const delayedMs = (startTime - now) % (60 * 1000) - 57;
        for (let i = 0; i < delayedHours-1; ++i) {
            await delay(60 * 1000);
        }

        await delay(delayedMs);
     
        let currentStartTime = startTime;

        const duration_1 = (moment(timeline[1].time_to_start, "YYYY-MM-DD HH:mm:ss").valueOf() - moment(timeline[0].time_to_start, "YYYY-MM-DD HH:mm:ss").valueOf()) / 1000;
        const duration_2 = (moment(timeline[2].time_to_start, "YYYY-MM-DD HH:mm:ss").valueOf() - moment(timeline[1].time_to_start, "YYYY-MM-DD HH:mm:ss").valueOf()) / 1000;
        this.table.setLevel({...timeline[0], duration: duration_1});
        this.table.setNextLevel({...timeline[1], duration: duration_2});
        this.table.setCurrentDisplayLevel({...timeline[0], duration: duration_1}, timeline[1]);

        this.table.startTournament();

        for (let i = 1; i < timeline.length; ++i) {
            const nextTime = moment(timeline[i].time_to_start, "YYYY-MM-DD HH:mm:ss").valueOf();

            const duration = nextTime - currentStartTime;
            currentStartTime = nextTime;

            if (duration < 0)
                continue;

            await setTimeoutA(duration);

            if (i === timeline.length - 1) {
                this.table.startNextLevel({type: 'level', duration: 0, smallBlind: 0, bigBlind: 0});
                continue;
            }

            const nextDuration = !!timeline[i + 2] ? (moment(timeline[i + 2].time_to_start, "YYYY-MM-DD HH:mm:ss").valueOf() - moment(timeline[i + 1].time_to_start, "YYYY-MM-DD HH:mm:ss").valueOf()) / 1000 : 0; 
            this.table.startNextLevel({...timeline[i + 1], duration: nextDuration});
        }
    }

    // private async breakTime(duration: number) {
    //     this.log(`--- BREAK TIME START ---`);
    //     this.table.setBreak(true, duration / 1000);
    //     if (duration > 0) {
    //         await setTimeoutA(duration);
    //         this.table.setBreak(false);
    //         this.log(`--- BREAK TIME END ---`);
    //     }
    // }

    // private async applyLevel(options: LevelOptions, duration: number) {
    //     this.log(`--- LEVEL START: ${options.level} ---`);
    //     this.lastRoundEnd = false;
    //     this.lastRound = false;
    //     this.table.setLevel(options.level, options.smallBlind, options.bigBlind, options.ante, duration / 1000);
    //     if (duration > 0) {
    //         await setTimeoutA(duration);
    //         this.lastRound = true;
    //         this.log(`--- LEVEL END: ${options.level} ---`);
    //     }
    // }

    // private async applyNextLevel(options: LevelOptions) {
    //     this.table.setNextLevel(options.smallBlind, options.bigBlind!);
    // }

    // private until(conditionFunction : any) {

    //     const poll = (resolve : any) => {
    //       if(conditionFunction()) resolve();
    //       else setTimeout(_ => poll(resolve), 400);
    //     }
      
    //     return new Promise(poll);
    // }

    // private onRoundResult() {
    //     if (this.lastRound)
    //         this.lastRoundEnd = true;
    // }
}
