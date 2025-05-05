import { setTimeout as setTimeoutA } from "timers/promises";
import { TableSeatState, Table, TableSeat, TableRoundStartContext, TableOptions } from "./table";
import { Room } from "./room";
import { Player } from "./player";
import { PFLogic } from "./pfl";
import winston from "winston";
import moment, { duration } from 'moment';
import { delay } from "../services/utils";
import { getErrorMessage } from "../messages";

export interface TournamentTableOptions extends TableOptions {
    ante: number;
    levels: TimeOptions[],
    tournamentRegistrationFee:number,
    cancelWaitingTime:number,
    tournamentName:string,
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
    private nextLevel?: number = 0;
    private nextAnte?: number =0;
    public currentLevelOption: any;
    public nextLevelOption: any;
    private tournamentStartTime:string = "";
    public isLevelStart:boolean = false;

    private breakTime: boolean = false;

    private nextLevelFlag = false;
    private onePlayerTimerInterval?: NodeJS.Timer = undefined;
    private tournamentRegistrationFee:number = 0;
    public cancelWaitingTime:string;
    private tournamentName:string;

    public onePlayerLeft:boolean = false;

    constructor(options: TournamentTableOptions, logger: winston.Logger) {
        super(options, logger);
        
        this._roundEnabled= false;
        this.tournamentRegistrationFee = options.tournamentRegistrationFee;
        this.tournamentName = options.tournamentName;
        this.tournamentStartTime = (options.levels.length != 0) ? options.levels[0]['time_to_start'] : "";
        this.cancelWaitingTime =  moment(this.tournamentStartTime).add(options.cancelWaitingTime,'minutes').format("YYYY-MM-DD HH:mm:ss");



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

        this._pfl = new PFLogic(this.options.numberOfSeats);
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
        this.nextLevel = nextLevel.level;
        this.nextAnte = nextLevel.ante;
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
        this.nextLevel = nextLevel.level;
        this.nextAnte = nextLevel.ante;

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
        return {
            ...super.getSettings(),
            mode: 'tournament',
            level: this.level,
            duration: this.duration,
            nextSB: this.nextSB,
            nextBB: this.nextBB,
            nextLevel:  this.nextLevel,
            nextAnte: this.nextAnte,
            displaySB: this.displaySB,
            displayBB: this.displayBB,
            displayAnte: this.displayAnte,
            tournamentStartTime: this.tournamentStartTime,
            timeDuration: (moment(this.tournamentStartTime, "YYYY-MM-DD HH:mm:ss").valueOf() - moment().valueOf()) / 1000,
            tournamentName:this.tournamentName,
            sidebetBB: Math.max(2, Math.ceil(this.tournamentRegistrationFee / 50))
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
    }

    protected checkOnePlayerLeft(){
        if (this.getStayPlayers().length === 1)
            if (!this.onePlayerTimerInterval) {
                this.onePlayerTimerInterval = setInterval(() => { 
                    
                    this.log(`Stayed player length: ${this.getStayPlayers().length}`);
                    if (this.getStayPlayers().length != 1 || this.submitErrorReport) {
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

    public getLeavePlayers() {
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
            this.emit('message', true,  getErrorMessage("turnTimerError"));
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

        this._selfOutPlayers.push({user_token: (seat.player as Player)?.id, chips: seat.money})
    }

    public setTournamentStartTime(){
        this.emit('settournamentStartTime');
    }

    public startTournament() {
        if(this.isLevelStart)
            return;

        this.lastAction = {actionType:"tournamentStart",lastActionTime:new Date()};
        this.isLevelStart = true;
        this.emit('showCancelTime');
        this.emit('startlevel');        
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
           
        if(this.onePlayerLeft && start.seats.length > 1)
            this.onePlayerLeft = false;

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

        this.checkOnePlayerLeft();
    }

    public startNextLevel(nextLevelOption: any) {
        this.nextLevelFlag = true;

        this.setCurrentDisplayLevel(this.nextLevelOption, nextLevelOption);

        if (isBreakOptions(this.currentLevelOption)) {
            this.log(`--- BREAK TIME END ---`);

            this._lastAction = {actionType:"tournamentBreakEnd",lastActionTime:new Date()};
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

    protected async insurance() {
        const getActivePlayers = this._context.getPlayingSeats().filter(seat => seat.fold !== true);
        const streetLog = this.getactionLogInfo().filter(action => action.action.includes('allin'));
        const allinPlayers = getActivePlayers.filter(seat => seat.lastAction == "allin").map(seat => seat.index);
        if(getActivePlayers.length == 2 && allinPlayers.length == 2 && streetLog.length == 2 && !this._insurance && this.tournamentRegistrationFee > 5)
        {
            await this.CheckWinner();
            var insuranceDelay = false;

            this.getPlayingSeats().forEach(seat => {
                this.log(`Seat#${seat.index}(${seat.player?.name}),lossPercentage:${seat.lossPercentage}`);                       
                if(allinPlayers.includes(seat.index) && this._context.getSeat(seat.index).money == 0  && seat.lossPercentage !== undefined && seat.lossPercentage < 0.33 && seat.lossPercentage > 0)
                {
                    var insurancePrice = (this.tournamentRegistrationFee * (seat.lossPercentage) * 1.05).toFixed(2);
                    this.log(`Seat#${seat.index}(${seat.player?.name}) (${this.tournamentRegistrationFee} * (${seat.lossPercentage}) * 1.05) = ${insurancePrice}`);
                    if(Number(insurancePrice) > 0){
                        insuranceDelay = true;
                        var opindex = allinPlayers.find(index => index  != seat.index);
                        var opPlayer = this.getSeatAt(opindex!);
                        var tablecards = this.getTableCards();
                        
                        this.emit('insurance', { status: true, seatIndex: seat.index, data: { allInPrice:  this.tournamentRegistrationFee, insurancePrice: insurancePrice, cards: seat.context.cards, percentage:(100 - seat.lossPercentage) * 100, opCards : opPlayer.context.cards, opPercentage: (100 - opPlayer.lossPercentage!) * 100, tableCards: tablecards } });
                    };
                }
            });

            if (insuranceDelay) {
                this._insurance = true;
                await delay(1000 * 5);
                this.emit('insurance', { status: false, data: [] });
            }
        }
    }

    protected async removeAllPlayersAndDeleteTable(){
        this.emit('closeTable', true);
        await delay(1000 * 5);
        process.exit();
    }

    public showTournamentCancelTime()
    {
        this.emit('showCancelTime');
    }

    public getTournamentCancelTime(){
       const startTimeDuration =  (moment(this.tournamentStartTime, "YYYY-MM-DD HH:mm:ss").valueOf() - moment().valueOf()) / 1000
        if(startTimeDuration > 0) return 0;
        
        return (moment(this.cancelWaitingTime, "YYYY-MM-DD HH:mm:ss").valueOf() - moment().valueOf()) / 1000;
    }

    public setOnePlayerLeft(status:boolean){
        this.onePlayerLeft = status;
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
    startTime?: string;
    timeline: TimeOptions[];
    breakBeforeRoundHour?: number; 
    breakLengthBeforeRoundHour?:number;
    isTournamentStarted:boolean;
}

export class TournamentGameController {
    private static pendingPlayers: Player[] = [];
    private idleTimeout?: NodeJS.Timeout;
    private lastRoundEnd: boolean = true;
    private lastRound: boolean = false;
    private tournamentStartTime: number = 0;

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
        this.table.on('startlevel', () => this.onStartLevel());
        this.table.on('settournamentStartTime', () => this.onSetTournamentStartTime());

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

    private onSetTournamentStartTime(){
        this.options.startTime = moment().format("YYYY-MM-DD HH:mm:ss");
    }

    private async onStartLevel(){
        const levels = this.options.timeline;   
        let levelIndex = 0;
        const breakDuration =  (this.options.breakLengthBeforeRoundHour ?? 0) * 60;
        const breakStartTime  = 60 - (this.options.breakBeforeRoundHour ?? 0);
        var isBreak = false;
        var time = 0;
        var tournamentStart = new Date(this.options.startTime!);
        var nowTime = new Date(moment().valueOf());
        var firstBreakSkip = moment(this.options.startTime,'YYYY-MM-DD HH:mm:ss').minutes() == moment().minute();

        if(this.tournamentStartTime > 0)
        {
            firstBreakSkip = tournamentStart.getMinutes() === breakStartTime; 
        }
        
    

        // Calculate durations for each level
        for (let index = 0; index < levels.length; index++) {
            if ((levels.length - 1) === index) {
                if(levels[index].type == "break")
                {
                    var lastTime = new Date(levels[index].time_to_start);
                    let levelDifferenceTime =  lastTime.getTime() - new Date(levels[index - 1].time_to_start).getTime()
                    lastTime.setTime(lastTime.getTime() + levelDifferenceTime)
                    levels.push({...levels[index - 1],time_to_start:moment(lastTime).format("YYYY-MM-DD HH:mm:ss")});
                } else {
                    levels[index]["duration"] = 0;
                    continue;
                }
            }

            // Calculate duration between current and next level
            const currentLevel = levels[index];
            const nextLevel = levels[index + 1];
            var duration = (moment(nextLevel.time_to_start, "YYYY-MM-DD HH:mm:ss").valueOf() - moment(currentLevel.time_to_start, "YYYY-MM-DD HH:mm:ss").valueOf()) / 1000;
            if (this.tournamentStartTime > 1) {
                this.tournamentStartTime -= duration;
                if (breakDuration > 0) {
                    const oldTime = new Date(tournamentStart);
                    tournamentStart.setTime(tournamentStart.getTime() + (duration * 1000));
                    const startMinutes = oldTime.getMinutes();
                    const endMinutes = tournamentStart.getMinutes();

                    if (!firstBreakSkip && ((oldTime.getHours() === tournamentStart.getHours() && startMinutes <= breakStartTime && endMinutes >= breakStartTime) || (oldTime.getHours() < tournamentStart.getHours() && (startMinutes <= breakStartTime || endMinutes >= breakStartTime)))) {
                        
                        var oldTimes = new Date(oldTime);
                        while (oldTimes.getMinutes() != breakStartTime && oldTimes.getTime() <= tournamentStart.getTime()) {
                            oldTimes.setTime(oldTimes.getTime() + (60 * 1000));
                        }
                        var letDuration = (oldTimes.getTime() - oldTime.getTime()) / 1000;
                    
                        duration -= letDuration;
                        this.tournamentStartTime += duration;
                        if(this.tournamentStartTime < 0)
                        {
                            this.tournamentStartTime -= duration;
                            if (this.tournamentStartTime < 0) {
                                duration = Math.abs(this.tournamentStartTime);
                            } else {
                                duration = 0;
                                levelIndex++;
                            }
                        } else {
                            this.tournamentStartTime -= breakDuration;
                            tournamentStart.setTime(tournamentStart.getTime() + (breakDuration * 1000));
                            if(this.tournamentStartTime < 0)
                            {
                                time = breakDuration - Math.abs(this.tournamentStartTime);
                                isBreak = true;
                            } else {
                                tournamentStart.setTime(tournamentStart.getTime() + (duration * 1000));
                                this.tournamentStartTime -= duration;
                                if (this.tournamentStartTime < 0) {
                                    duration = Math.abs(this.tournamentStartTime);
                                } else {
                                    duration = 0;
                                    levelIndex++;
                                }
                                time = 0;
                                isBreak = false;
                            }
                        }
                    } else {
                        if(firstBreakSkip)
                            firstBreakSkip = false;

                        if (this.tournamentStartTime < 0) {
                            duration = Math.abs(this.tournamentStartTime);
                        } else {
                            levelIndex++;
                            duration = 0;
                        }
                    }
                } else {
                    if (this.tournamentStartTime < 0) {
                        if(levels[levelIndex].type == "break")
                        {
                            time = duration - Math.abs(this.tournamentStartTime);
                        }
                        duration = Math.abs(this.tournamentStartTime);
                    } else {
                        levelIndex++;
                        duration = 0;
                    }
                }
            }
            levels[index]["duration"] = duration;
        }

        var nextLevel;
        if((levels.length - 1)  === levelIndex)
             nextLevel = {type: 'level', duration: 0, smallBlind: 0, bigBlind: 0};
        else
             nextLevel = levels[levelIndex + 1];

        if(isBreak)
        {
            this.table.setLevel({"time_to_start": "","type": "break",duration:breakDuration - time});
            this.table.setNextLevel(levels[levelIndex]);
            this.table.setCurrentDisplayLevel({"time_to_start": "","type": "break",duration:breakDuration - time}, levels[levelIndex]);
            this.table.setBreak(true,breakDuration - time);
           
            nowTime.setSeconds(nowTime.getSeconds() + breakDuration);
            this.table.lastAction = {actionType:"tournamentStart",lastActionTime:nowTime};
        }else {
            
            this.table.setLevel(levels[levelIndex]);
            this.table.setNextLevel(nextLevel);
            this.table.setCurrentDisplayLevel(levels[levelIndex], nextLevel);
            if(levels[levelIndex].type == "break")
            {
                this.table.setBreak(true,levels[levelIndex].duration);
           
                nowTime.setSeconds(nowTime.getSeconds() + levels[levelIndex].duration!);
                this.table.lastAction = {actionType:"tournamentStart",lastActionTime:nowTime};
            }
        }
        this.table.roundEnabled = true;
        this.table.scheduleNewRound();
       

        let level = levels[levelIndex];
        if(breakDuration < 1 && (levels.length - 1)  === levelIndex)
            return;
       
        
       var levelInterval = setInterval(() => {
            // Check if level duration is complete and it's time for a break (every 4 levels)
            time++;
            
            const nowMinute = moment().minute();           
            if(breakDuration > 0 && breakStartTime === nowMinute && !isBreak && !firstBreakSkip)
            {
                isBreak = true;
                time = 0;
                this.table.setNextLevel({"time_to_start": "","type": "break",duration:breakDuration});
                this.table.startNextLevel(level); 
                this.table.setCurrentDisplayLevel({"time_to_start": "","type": "break",duration:breakDuration}, level);
                return;
            } else if(breakStartTime !== nowMinute && firstBreakSkip) {
                firstBreakSkip = false;
            }

            if (isBreak && time > breakDuration) {
                // End break and continue with remaining level duration
                isBreak = false;
                level.duration!--;
                time = 0;
                console.log(`${levelIndex} === ${levels.length - 1}`);
                
                if (levelIndex === levels.length - 1) 
                    this.table.startNextLevel({type: 'level', duration: 0, smallBlind: 0, bigBlind: 0});
                else
                     this.table.startNextLevel(levels[levelIndex + 1]);     

                return;
            }
            // Handle regular level progression           
            if (!isBreak && levelIndex < levels.length - 1 && 1 >= level.duration!--) {
                levelIndex++;
                level = levels[levelIndex];
                if (levelIndex === levels.length - 1) {
                    this.table.startNextLevel({type: 'level', duration: 0, smallBlind: 0, bigBlind: 0});
                    if(!!levelInterval && breakDuration <= 0)
                        clearInterval(levelInterval);
                    return;
                }
                this.table.startNextLevel(levels[levelIndex + 1]);                 
            }
        }, 1000);
       
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
                var customOrder = [0,1,2,3,4,5,6,7,8];
                if(this.table.options.numberOfSeats == 9)
                     customOrder = [0, 4, 5, 2, 7, 3, 6, 1, 8];
                else if(this.table.options.numberOfSeats == 6)
                    customOrder = [0, 3, 4, 1,5,2];
                

                const seat = this.table.getEmptySeats().sort((a, b) => {
                    const aPos = customOrder.indexOf(a.index);
                    const bPos = customOrder.indexOf(b.index);
                    return (aPos === -1 ? Infinity : aPos) - (bPos === -1 ? Infinity : bPos);
                  })[0];
                
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
            .on('tip', (tipInfo) => this.onPlayerTip(tipInfo));

        player.addTableListener();

        this.log(`Player(${player.name}) sitdown. seat: ${seat.index}`);
        this.table.lastAction ={actionType:"newPlayerJoin",seat:seat.index,lastActionTime:new Date(new Date().getTime() + (120 * 1000))};
        this.table.sitDown(seat, player);

        this.log(`Player(${player.name}) buyin. chips: ${player.chips}`);
        this.table.buyIn(seat, player.chips);
    }

    

    private onPlayerTip(tipInfo:{msg: string,seat:number}) {
        this.table.doBroadcastTip(tipInfo);
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
        const delayedMs = (startTime - now) % (60 * 1000);

        for (let i = 0; i < delayedHours; ++i) {
            await delay(60 * 1000);
        }

        await delay(delayedMs);


        if(this.options.isTournamentStarted && this.table.isLevelStart === false)
        {
            let tournamentStartTime = (moment().valueOf() - moment(this.options.startTime, "YYYY-MM-DD HH:mm:ss").valueOf()) / 1000;
            if(tournamentStartTime > 0)
                this.tournamentStartTime = tournamentStartTime;
            
            this.table.startTournament();
        } else {
            setTimeout(()=>{
                this.table.showTournamentCancelTime();
           },5000);
        }
      
        this.table.lastAction = {actionType:"tournamentStart",lastActionTime:new Date()};
        
        setInterval(()=>{
            if(this.table.submitErrorReport === false  && this.table.roundEnabled && !isBreakOptions(this.table.currentLevelOption) && !this.table.onePlayerLeft)
            {
                let lastActionTime = this.table.lastAction.lastActionTime.getTime();
                const totalPlayers = this.table.getStayPlayers().length;                
                if(totalPlayers < 2)
                    lastActionTime = lastActionTime + (15*60*1000);
                           
                if(((new Date().getTime() - lastActionTime)/1000) > (2 * (this.table.options.timebankMax! + this.table.options.timeToReact!)))
                {
                    const reason = this.table.getErorrReportReason(this.room.options.mode!);
                    this.room.submitErrorReport(reason);
                    this.table.submitErrorReport = true;
                    this.table.emit('errorreport');
                } 
            }
        },1000);
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
