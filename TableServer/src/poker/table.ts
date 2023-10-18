import { EventEmitter } from 'events';
import { Action, Round, RoundState, Seat } from "./round";
import { Card, HandRank, solve_nlh as solveNlhHand, solve_plo as solvePloHand, winners as solveWinners, HandResult } from "./card";
import { round0, round2 } from './math';
import { Timer } from 'timer-node';
import winston from 'winston';
import { Player, SideBetState } from './player';
import { forEach, values } from 'lodash';
import { delay } from '../services/utils';

export interface TableOptions {
    id: number;
    name: string;
    gameType: string;
    numberOfSeats: number;
    smallBlind: number;
    bigBlind: number;
    timeToReact?: number;
    timebankMax?: number;
    timebankBonus?: number;
    rake?: number;
    rakeCap?: number;
    rakePreFlop?: boolean;
    rakeSplitPot?: boolean;
    rakeRound?: boolean;
    sitoutTimeout?: number;
    sideBetOptions?: SideBetOptions[][];
}

export interface SideBetOptions {
    betName: string;
    ratio: number;
    note: string;
}

export interface TablePlayer {
    name: string;
    avatar: string;
    created_at:string;
}

export type TableEvent =
    'leave' |
    'sitdown' |
    'buyin' |
    'seat' |
    'start' |
    'action' |
    'state' |
    'turn' |
    'result' |
    'showcards' |
    'showcardsbtn' |
    'foldanybet' |
    'muckcards' |
    'end' |
    'message' |
    'waitlist' |
    'log' |
    'chat';

export enum TableSeatState {
    Empty,
    Joining,
    SitOut,
    Waiting,
    Playing
}

export type TableSeat = {
    index: number;

    state: TableSeatState;

    player?: TablePlayer;
    money?: number;

    context: Seat;

    play?: number;

    ante?: number;

    timebank?: number;
    prize?: number;
    hand?: HandResult;

    sitoutTimeout?: NodeJS.Timeout;
    joiningTimeout?: NodeJS.Timeout;
    winPercentage?: number;
};

export interface TableSettings {
    id: number;
    name: string;
    gameType:string;
    numberOfSeats: number;
    smallBlind: number;
    bigBlind?: number;
    usdRate?: number;
    closeTable?: boolean;
}

export interface TableSeatStatus {
    state: TableSeatState;
    player?: TablePlayer;
    money?: number;
    moneyExtra?: number;
    play?: number;
    cards?: Card[];
    fold?: boolean;
    bet?: number;
    lastAction?: Action;
    lastBet?: number;
    handRank?: string;
}

export interface TableStatus {
    paused: boolean;
    round: number;
    state: RoundState;
    cards?: Card[];
    seatOfDealer?: number;
    seatOfSmallBlind?: number;
    seatOfBigBlind?: number;
    pot?: number;
    streetPot: number;
    turn?: number;
    seats: TableSeatStatus[];
}

export interface TableRoundStartContext {
    seats: { index: number, ante?: number, sum?: number }[];
    seatOfDealer: number;
    seatOfSmallBlind?: number;
    seatOfBigBlind?: number;
    noBB?: boolean;
}

export interface TablePotResult {
    amount: number;
    winners: TableSeat[];
    prize: number;
}

export interface TableRoundResult {
    players: TableSeat[];
    pots: TablePotResult[];
}

export interface TableTurnContext {
    pot: number;
    seat: number;
    call: number;
    canRaise: boolean;
    raise?: [number, number];
    currentBet: number;
    time: [number, number, number];
}

export interface TablePot {
    amount: number;
    seats: TableSeat[];
}

export interface InsurancePlayer {
    index?: number;
    user_id: string;
    insuranceAmount: number;
    insuranceWinAmount: number;
    is_win: boolean;
}

export abstract class Table extends EventEmitter {
    public get id() { return this.options.id; }
    public get name() { return this.options.name; }

    protected _seats: TableSeat[];

    protected _paused: boolean = false;
    public get paused() { return this._paused; }
    protected _pause: boolean = false;

    protected _startGameTimeout?: NodeJS.Timeout;

    protected _round: number = 0;
    public get round() { return this._round; }

    protected _smallBlind?: number;
    protected _bigBlind?: number;
    protected _usdRate?: number = 0;
    protected _ante?: number;

    public get bigBlind() { return this._bigBlind; }
    public get ante() { return this._ante; }

    protected _context: Round;

    protected _turnTimer: Timer = new Timer();
    protected _turnTimeout?: NodeJS.Timeout;

    protected _result?: TableRoundResult;

    protected _roundLog: any = {};
    public get roundLog() { return this._roundLog; }
    protected _roundRake: number = 0;
    public get roundRake() { return this._roundRake; }
    protected _totalRake: number = 0;
    public get totalRake() { return this._totalRake; }

    private actionLogInfo: Array<any> = [];

    protected _returnedSidePot: boolean = false;
    public get returnedSidePot() { return this._returnedSidePot; }

    protected _insurance: boolean = false;
    protected _insurancePlayers: InsurancePlayer[] = [];
    public get getInsurancePlayers() { return this._insurancePlayers; }

    private _preflopFold: boolean = false;

    protected _selfOutPlayers: Array<any> = [];

    protected _roundEnabled: boolean = true;

    protected _closed: boolean = false;
    public get isClosed() { return this._closed; }



    constructor(public readonly options: TableOptions, public readonly logger: winston.Logger) {
        super();

        this.setMaxListeners(30);

        // default options
        this.options.timeToReact ??= 40;
        this.options.timebankMax ??= 20;
        this.options.timebankBonus ??= 2;
        this.options.rake ??= 0;
        this.options.rakeCap ??= this.options.rake * 10;
        this.options.rakePreFlop ??= false;
        this.options.rakeSplitPot ??= false;
        this.options.rakeRound ??= false;
        this.options.sitoutTimeout ??= 5 * 60;

        this._smallBlind = this.options.smallBlind;
        this._bigBlind = this.options.bigBlind;
        this._context = new Round({
            numberOfSeats: this.options.numberOfSeats,
        });

        this._seats = [];
        for (let i = 0; i < this.options.numberOfSeats; ++i) {
            this._seats.push({
                index: i,
                state: TableSeatState.Empty,
                context: this._context.getSeat(i),
            });
        }
    }

    public on(ev: 'leave', listener: (seat: TableSeat, pendLeave: boolean) => void): this;
    public on(ev: 'sitdown', listener: (seat: TableSeat) => void): this;
    public on(ev: 'buyin', listener: (seat: TableSeat, amount: number) => void): this;
    public on(ev: 'seat', listener: (seat: TableSeat) => void): this;
    public on(ev: 'start', listener: (round: number) => void): this;
    public on(ev: 'action', listener: (seat: TableSeat, lastAction: Action, bet?: number) => void): this;
    public on(ev: 'state', listener: (state: RoundState) => void): this;
    public on(ev: 'turn', listener: (turn: number) => void): this;
    public on(ev: 'result', listener: () => void): this;
    public on(ev: 'showcards', listener: (seat: TableSeat) => void): this;
    public on(ev: 'showcardsbtn', listener: (seat: TableSeat) => void): this;
    public on(ev: 'foldanybet', listener: (seat: TableSeat) => void): this;
    public on(ev: 'muckcards', listener: (seat: TableSeat) => void): this;
    public on(ev: 'end', listener: () => void): this;
    public on(ev: 'levelchange', listener: () => void): this;
    public on(ev: 'serverdisconn', listener: () => void): this;
    public on(ev: 'message', listener: (seat: TableSeat, msg: string) => void): this;
    public on(ev: 'waitlist', listener: (players: Player[]) => void): this;
    public on(ev: 'chat', listener: (player: Player, msg: string) => void): this;
    public on(ev: string, listener: (...args: any[]) => void): this;
    public on(ev: TableEvent | string, listener: (...args: any[]) => void): this {
        return super.on(ev, listener);
    }

    public emit(ev: TableEvent | string, ...args: any[]): boolean {
        return super.emit(ev, ...args);
    }

    protected log(message?: any, ...optionalParams: any[]) {
        this.logger.debug(`Table#${this.id}: ${message}`, ...optionalParams);
    }

    public getSettings(): TableSettings {
        return {
            id: this.options.id,
            name: this.options.name,
            gameType:this.options.gameType,
            numberOfSeats: this.options.numberOfSeats,
            smallBlind: this._smallBlind!,
            bigBlind: this._bigBlind,
            usdRate: this._usdRate,
            closeTable: this._closed,
        };
    }

    public getSideBetOptions(state: SideBetState): SideBetOptions[] {
        return this.options.sideBetOptions![state];
    }

    public getSeats() {
        return [...this._seats];
    }

    public getTableCards() {
        return this._context.cards?.join(' ');
    }

    public getSeatAt(index: number) {
        return this._seats[index];
    }

    public getEmptySeats() {
        return this._seats.filter(seat => seat.state === TableSeatState.Empty);
    }

    public getPlayingSeats() {
        return this._seats.filter(seat => seat.state === TableSeatState.Playing);
    }

    public getWaitingSeats() {
        return this._seats.filter(seat => seat.state === TableSeatState.Waiting);
    }

    public getSitOutSeats() {
        return this._seats.filter(seat => seat.state === TableSeatState.SitOut);
    }

    public findSeatForPlayer(player: TablePlayer) {
        return this._seats.find(seat => seat.state !== TableSeatState.Empty && seat.player === player);
    }

    public getStatus(): TableStatus {
        return {
            paused: this._paused,
            round: this._round,
            state: this._context.state,
            cards: this._context.cards,
            seatOfDealer: this._context.seatOfDealer,
            seatOfSmallBlind: this._context.seatOfSmallBlind,
            seatOfBigBlind: this._context.seatOfBigBlind,
            streetPot: this._context.streetPot,
            pot: this._context.pot,
            turn: this._context.turn,
            seats: this._seats.map(seat => ({
                state: seat.state,
                player: seat.state !== TableSeatState.Empty ? seat.player : undefined,
                money: seat.money,
                play: seat.play,
                ante: seat.ante,
                handRank: (seat.state === TableSeatState.Playing && !seat.context.fold) ? seat.hand?.hand.name : undefined,
                cards: (seat.state === TableSeatState.Playing || seat.state === TableSeatState.SitOut) ? seat.context.cards : undefined,
                fold: (seat.state === TableSeatState.Playing || seat.state === TableSeatState.SitOut) ? seat.context.fold : undefined,
                bet: (seat.state === TableSeatState.Playing || seat.state === TableSeatState.SitOut) ? seat.context.bet : undefined,
                lastAction: (seat.state === TableSeatState.Playing || seat.state === TableSeatState.SitOut) ? seat.context.lastAction : undefined,
                lastBet: (seat.state === TableSeatState.Playing || seat.state === TableSeatState.SitOut) ? seat.context.lastBet : undefined,
            })),
        };
    }

    public setBlinds(smallBlind: number, bigBlind?: number) {
        this._smallBlind = smallBlind;
        this._bigBlind = bigBlind;
    }

    public removeTournament() {
        this.emit('remove_tournament');
    }

    public doBroadcastChat(player: Player, msg: string) {
        this.emit('chat', { "playerName": player.name, "msg": msg });
    }

    public leave(seat: TableSeat) {
        if (seat.state === TableSeatState.Empty)
            return;

        const player = seat.player;
        this.log(`Seat#${seat.index}(${player?.name}): Leaving.`);

        seat.state = TableSeatState.Empty;

        this.onLeave(seat);

        this.emit('leave', seat, this._context.state > RoundState.None);

        this.clearSitOutTimeout(seat);

        seat.player = undefined;
        seat.money = undefined;
        seat.play = undefined;
        seat.timebank = undefined;

        this.onSeatState(seat);
        this.emit('seat', seat);

        if (this._context.isSeatPlaying(seat.index) && this._context.turn === seat.index) {
            this.log(`Seat#${seat.index}(${player?.name}): Player is at turn. Giving up.`);
            setImmediate(() => this.action(seat, 'fold'));
        }

    }

    public setSeatFoldAtTurn(seat: TableSeat | undefined) {
        if (!seat)
            return;

        if (this._context.isSeatPlaying(seat.index) && this._context.turn === seat.index) {
            setImmediate(() => this.action(seat, 'fold'));
        }
    }

    protected onLeave(seat: TableSeat) { }
    protected onSeatState(seat: TableSeat) { }

    protected startSitOutTimeout(seat: TableSeat) {
        this.clearSitOutTimeout(seat);

        this.log(`Seat#${seat.index}(${seat.player?.name}): Starting sitout timeout.`);
        seat.sitoutTimeout = setTimeout(() => {
            this.log(`Seat#${seat.index}(${seat.player?.name}): sitout timeout. Leaving now.`);
            this.leave(seat);
        }, this.options.sitoutTimeout! * 1000);
    }

    protected clearSitOutTimeout(seat: TableSeat) {
        if (!!seat.sitoutTimeout) {
            this.log(`Seat#${seat.index}(${seat.player?.name}): sitout timeout clear.`);
            clearTimeout(seat.sitoutTimeout);
            seat.sitoutTimeout = undefined;
        }
    }

    protected startJoiningTimeout(seat: TableSeat) {
        this.clearJoiningTimeout(seat);

        this.log(`Seat#${seat.index}(${seat.player?.name}): Starting joining timeout.`);
        seat.joiningTimeout = setTimeout(() => {
            this.log(`Seat#${seat.index}(${seat.player?.name}): joining timeout. to Observing.`);
            this.leave(seat);
        }, 60 * 1000);
    }

    protected clearJoiningTimeout(seat: TableSeat) {
        if (!!seat.joiningTimeout) {
            this.log(`Seat#${seat.index}(${seat.player?.name}): joining timeout clear.`);
            clearTimeout(seat.joiningTimeout);
            seat.sitoutTimeout = undefined;
        }
    }

    public sitDown(seat: TableSeat, player: TablePlayer) {
        if (!!this.findSeatForPlayer(player)) {
            this.log(`Seat#${seat.index}: Player(${player.name}) already sitdown down. Discarding sitdown.`);
            return false;
        }

        if (!!seat.player) {
            this.log(`Seat#${seat.index}: Player(${player.name}) is sitting down with non-empty seat. Discarding sitdown.`);
            return false;
        }

        seat.state = TableSeatState.Joining;
        seat.player = player;
        seat.play = undefined;
        seat.money = 0;

        this.log(`Seat#${seat.index}(${player.name}): Sit down success. state:${TableSeatState[seat.state]}`);
        this.emit('message', seat, `${player.name}: Sit down success. state:${TableSeatState[seat.state]}`);
        this.onSitDown(seat);
        this.emit('sitdown', seat);

        this.onSeatState(seat);
        this.emit('seat', seat);

        this.startJoiningTimeout(seat);

        return true;
    }

    protected onSitDown(seat: TableSeat) { }

    public buyIn(seat: TableSeat, amount: number) {
        if (!seat.player) {
            this.log(`Seat#${seat.index}: Seat is empty. Discarding buy-in. amount: ${amount}.`);
            return 0;
        }

        seat.money = (seat.money ?? 0) + amount;

        if (seat.state === TableSeatState.Joining) {
            seat.state = TableSeatState.Waiting;
            this.onSeatState(seat);
            this.emit('seat', seat);
            this.clearJoiningTimeout(seat);
        }

        this.log(`Seat#${seat.index}(${seat.player.name}): Buy-in success. buy-in: $${amount}, money: $${seat.money}, state: ${TableSeatState[seat.state]}`);

        this.onBuyIn(seat, amount);
        this.emit('buyin', seat, amount);

        this.scheduleNewRound();

        return amount;
    }

    protected onBuyIn(seat: TableSeat, amount: number) { }

    public pause() {
        this._pause = true;
    }

    public resume() {
        this._pause = false;
        this.scheduleNewRound();
    }

    public scheduleNewRound() {
        if (!!this._startGameTimeout)
            clearTimeout(this._startGameTimeout);

        this._startGameTimeout = setTimeout(() => {
            if (this._closed !== true) {
                this.newRound();
            } else {
                this.emit('closeTable', true);
            }

        }, 1 * 1000);
    }

    protected newRound() {
        if (this._context.state > RoundState.None) // already started
            return;

        this._paused = this._pause;
        if (this._paused) {
            this.updateCurrentState();
            return;
        }

        this._roundLog = {};
        this._roundLog["settings"] = {
            "round_id": this._round + 1,
            "table_id": undefined,
            "game_type": this.options.gameType,
            "mode": undefined,
            "max_players": undefined,
            "min_buy_in": undefined,
            "max_buy_in": undefined,
            "tournament_type": undefined,
        };

        const roundStartContext = this.startRound();
        if (!roundStartContext || roundStartContext.seats.length < 2 || !this._roundEnabled) {
            this.updateCurrentState();
            return;
        }

        this._returnedSidePot = false;
        this._preflopFold = false;
        this._insurance = false;
        this._insurancePlayers = [];
        this._selfOutPlayers = [];

        ++this._round;
        this.log(`-- NEW ROUND: ${this._round} --`);
        this.logger.info(`Round#${this._round}`);
        this.emit('log', `Round: ${this._round}`);
        // this._roundLog = {};
        // this._roundLog["settings"] = {
        //     "round_id" : this._round,
        //     "table_id" : undefined,
        //     "game_type" : this.options.gameType,
        //     "mode" : undefined,
        //     "max_players" : undefined,            
        //     "min_buy_in" : undefined,    
        //     "max_buy_in" : undefined,
        //     "tournament_type" : undefined,
        // };

        this._result = undefined;
        this._roundRake = 0;

        // add players
        this._context.reset();

        this.onStart(this._round);
        this.emit('start', this._round);

        this.log(`Round start. sb: $${this._smallBlind}, bb: $${this._bigBlind}`);
        var initStates: any = {};
        var seatStates: Array<any> = [];
        roundStartContext.seats.forEach(seatStartContext => {
            const seat = this._seats[seatStartContext.index];

            if (seat.money)
                seat.money = round2(seat.money)

            this.log(`Seat#${seat.index}(${seat.player?.name}): Join in round. money: $${seat.money}`);
            this.logger.info(`Seat#${seat.index}: ${seat.player?.name} (${seat.money} chips)`);
            var seat_state: any = {};
            seat_state["seat"] = `Seat#${seat.index}`;
            seat_state["user_id"] = (seat.player as Player)?.id;
            seat_state["chips"] = seat.money;

            seatStates.push(seat_state);
            // this._roundLog += `Seat#${seat.index}: ${(seat.player as Player)?.id} (${seat.money} chips)` + "\n";
            if (seat.state !== TableSeatState.SitOut) {
                seat.state = TableSeatState.Playing;
                this.onSeatState(seat);
                this.emit('seat', seat);
            }

            seat.play = (seat.play ?? 0) + 1;
            seat.hand = undefined;
            seat.timebank ??= this.options.timebankMax;
            seat.prize = 0;
            seat.winPercentage = undefined;

            let ante = seatStartContext.ante ?? 0;

            if (ante > 0) {
                const money = seat.money!;
                seat.money = Math.max(0, round2(money - ante));
                ante = money - seat.money;

                this._context.addAnteToPending(ante);
                this._context.addAnte(seat.index, ante, seat.money <= 0);

                seat.ante = ante;

                this.log(`Seat#${seat.index}(${seat.player?.name}): Post ante. ante: $${ante}, money: $${seat.money}`);
                this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: ante ${ante}`);
                // this._roundLog += `Seat#${seat.index}: ${(seat.player as Player)?.id}: ante ${ante}` + "\n";
            }
            else {
                seat.ante = 0;
            }

            this._context.add(seat.index, seat.money!);
        });

        initStates["data"] = seatStates;

        this._context.start({
            smallBlind: this._smallBlind!,
            bigBlind: this._bigBlind,
            seatOfDealer: roundStartContext.seatOfDealer,
            seatOfSmallBlind: roundStartContext.seatOfSmallBlind,
            seatOfBigBlind: roundStartContext.seatOfBigBlind,
            gameType: this.options.gameType,
            noBB: roundStartContext.noBB,
        });

        this.updateCurrentState();

        roundStartContext.seats.forEach(seatStartContext => {
            const seat = this._seats[seatStartContext.index];

            const sum = seatStartContext.sum ?? 0;

            if (sum > 0) {
                this._context.bet(seat.index, sum, 'call');
                seat.money = seat.context.money;
                this.log(`Seat#${seat.index}(${seat.player?.name}): Post sum. sum: $${sum}, money: $${seat.money}`);
                this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: call ${sum}`);
            }
        });

        // initial money sync
        this._context.getPlayingSeats().forEach(seat => {
            this._seats[seat.index].money = seat.money;
        });

        if (this._context.seatOfDealer !== undefined) {
            this.logger.info(`D: Seat#${this._context.seatOfDealer}`);
            initStates["D"] = `Seat#${this._context.seatOfDealer}`;
        }
        else {
            this.logger.info(`D: empty`);
            initStates["D"] = `empty`;
        }
        if (this._context.seatOfSmallBlind !== undefined) {
            const seat = this._seats[this._context.seatOfSmallBlind];
            this.log(`Seat#${seat.index}(${seat.player?.name}): SB, action: ${seat.context.lastAction}, bet: $${seat.context.lastBet}, money: $${seat.money}`);
            this.logger.info(`SB: Seat#${this._context.seatOfSmallBlind}`);
            initStates["SB"] = {
                "seat": `Seat#${this._context.seatOfSmallBlind}`,
                "user_id": (seat.player as Player)?.id,
                "sb": this._smallBlind
            };
        }
        else {
            this.logger.info(`SB: empty`);
            initStates["SB"] = `empty`;
        }

        if (this._context.seatOfBigBlind !== undefined) {
            const seat = this._seats[this._context.seatOfBigBlind];
            this.log(`Seat#${seat.index}(${seat.player?.name}): BB, action: ${seat.context.lastAction}, bet: $${seat.context.lastBet}, money: $${seat.money}`);
            this.logger.info(`BB: Seat#${this._context.seatOfBigBlind}`);
            initStates["BB"] = {
                "seat": `Seat#${this._context.seatOfBigBlind}`,
                "user_id": (seat.player as Player)?.id,
                "bb": this._bigBlind
            };
        }
        else {
            this.logger.info(`BB: empty`);
            initStates["BB"] = `empty`;
        }
        if (this._context.seatOfSmallBlind !== undefined) {
            const seat = this._seats[this._context.seatOfSmallBlind];
            this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: sb ${this._smallBlind}`);
        }

        if (this._context.seatOfBigBlind !== undefined) {
            const seat = this._seats[this._context.seatOfBigBlind];
            this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: bb ${this._bigBlind}`);
        }

        this._roundLog["init_state"] = initStates;

        setTimeout(() => {
            this._context.dealPlayerCards();
            this.startCurrentState();
            this.emit('sidebet', { street: 2, options: this.options.sideBetOptions![1] });
            var dealtCards: Array<any> = [];
            this.getPlayingSeats().forEach(seat => {
                const cards = seat.context.cards?.join();
                this.log(`Seat#${seat.index}(${seat.player!.name}): cards: [${cards}]`);
                this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: dealt: [${cards}]`);
                dealtCards.push({
                    "seat": `Seat#${seat.index}`,
                    "user_id": (seat.player as Player)?.id,
                    "dealt": `[${cards}]`
                });
                this._seats[seat.index].timebank = Math.min(seat.timebank! + this.options.timebankBonus!, this.options.timebankMax!);
                this.log(`Seat#${seat.index}(${seat.player?.name}): Player didn't use time bank. bonus: +${this.options.timebankBonus}s, now timebank: ${seat.timebank}s`);
                this.emit('message', true, `Player didn't use time bank. bonus: +${this.options.timebankBonus}s, now timebank: ${seat.timebank}s`);
            });
            this._roundLog["dealt_cards"] = dealtCards;


        }, 500)

        this.checkDAndSBOrBB();
    }

    private checkDAndSBOrBB() {
        if (this._context.seatOfBigBlind === undefined && !this._context.NoBB) {
            this.logger.error("BigBlind is not existed");
            this.logger.error(this._roundLog);
            return;
        }

        let seatOfDealer = this._context.seatOfDealer;

        if (this._context.seatOfSmallBlind === undefined) {
            const seatOfBB = this.getNextPlayingSeatIndex(seatOfDealer!);
            if (this._context.seatOfBigBlind !== seatOfBB) {
                this.logger.error("D, BB Order is wrong when SB empty");
                this.logger.error(this._roundLog);
            }
            else {
                this.logger.info("D, BB Order is matching when SB empty");
            }
        }
        else {
            const seatOfSB = this.getNumOfPlayingPlayers() > 2 ? this.getNextPlayingSeatIndex(seatOfDealer!) : seatOfDealer!;
            const seatOfBB = this.getNextPlayingSeatIndex(this._context.seatOfSmallBlind);
            if (!this._context.NoBB)
                if (this._context.seatOfSmallBlind === seatOfSB && this._context.seatOfBigBlind === seatOfBB) {
                    this.logger.info("D, SB, BB Order is matching when SB not empty");
                }
                else {
                    this.logger.error("D, SB, BB Order is wrong when SB not empty");
                    this.logger.error(this._roundLog);
                }
        }
    }

    private getNextPlayingSeatIndex(seatIndex: number) {
        let nextIndex = undefined;

        for (let i = 1; i < this._seats.length; ++i) {
            seatIndex = (seatIndex + 1) % this._seats.length;
            if (!this._context.isSeatPlaying(seatIndex))
                continue;

            nextIndex = seatIndex;
            break;
        }

        return nextIndex;
    }

    private getNumOfPlayingPlayers() {
        return this._seats.filter((_, i) => this._context.isSeatPlaying(i)).length;
    }

    protected abstract startRound(): TableRoundStartContext | undefined;
    protected onStart(round: number) { }

    public getOnePlayerRemainingSeat() {
        return this._context.getOnePlayerRemainingSeat();
    }

    public getTurnContext(): TableTurnContext {
        const { turn, pot } = this._context;

        let context: any = {
            pot: pot!,
            seat: turn,
        };

        if (turn !== undefined) {
            const seat = this._seats[turn];
            let { actions, call, raise } = this._context.getActions();
            const timeout = this.options.timeToReact! + seat.timebank! - this.turnTimerElapsed();
            context = {
                ...context,
                call,
                canRaise: actions.includes('raise'),
                raise,
                currentBet: seat.context.lastBet,
                time: [timeout, this.options.timeToReact!, seat.timebank!],
            };
        }
        return context;
    }

    public checkOfflinePlayerAndFold(player: Player) {
        if (!player.seat?.index)
            return;

        if (player.seat?.index === this._context.turn) {
            const seat = this._seats[this._context.turn!];

            if (seat.state === TableSeatState.Playing)
                this.action(seat, 'fold');
        }
    }

    public async action(seat: TableSeat, action: 'fold' | 'bet', bet: number = 0) {
        // if (!this._context.isSeatPlaying(seat.index) || seat.state === TableSeatState.Empty) {
        if (!this._context.isSeatPlaying(seat.index)) {
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player is not playing. Discarding action. action: ${action}, bet: $${bet}`);
            this.emit('message', seat, false, `Player is not playing. Discarding action. action: ${action}, bet: $${bet}`);
            return false;
        }

        if (seat.index != this._context.turn) {
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player is not turn. turn:${this._context.turn}. Discarding action. action: ${action}, bet: $${bet}`);
            this.emit('message', seat, false, `Player is not turn. turn:${this._context.turn}. Discarding action. action: ${action}, bet: $${bet}`);
            return false;
        }

        if (action === 'fold') {
            this._context.fold(this._context.turn);
            this.emit('animation', { "type": "betAction", "data": { "action": action, "bet": bet, "index": seat.index, "state": seat.state } });
            this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: fold`);
            this.actionLogInfo.push({
                "seat": `Seat#${seat.index}`,
                "user_id": (seat.player as Player)?.id,
                "action": "fold"
            });

        }
        else if (action === 'bet') {
            if (!this._context.bet(this._context.turn, bet)) {
                this.log(`Seat#${seat.index}(${seat.player?.name}): Player did incorrect bet. money: $${seat.money}, table last bet: $${this._context.lastBet}, seat bet: $${seat.context.bet}, legal bet: $${this._context.lastBet! - seat.context.bet!}, bet: $${bet}. Discarding action.`);
                this.emit('message', seat, false, `Player did incorrect bet. money: $${seat.money}, table last bet: $${this._context.lastBet}, seat bet: $${seat.context.bet}, legal bet: $${this._context.lastBet! - seat.context.bet!}, bet: $${bet}. Discarding action.`);
                return false;
            }
            this.emit('animation', { "type": "betAction", "data": { "action": action, "bet": bet, "index": seat.index, "state": seat.state } });

            if (seat.context.lastAction === 'check') {
                this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: check`);
                this.emit('message', seat, true, `action: check`);
                this.actionLogInfo.push({
                    "seat": `Seat#${seat.index}`,
                    "user_id": (seat.player as Player)?.id,
                    "action": "check"
                });
            }
            else if (seat.context.lastAction === 'call') {
                this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: call ${seat.context.lastBet}`);
                this.emit('message', seat, true, `action: call ${seat.context.lastBet}`);
                this.actionLogInfo.push({
                    "seat": `Seat#${seat.index}`,
                    "user_id": (seat.player as Player)?.id,
                    "action": `call : ${seat.context.lastBet}`
                });
            }
            else if (seat.context.lastAction === 'raise') {
                this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: raise to ${seat.context.lastBet}`);
                this.emit('message', seat, true, `action: raise to ${seat.context.lastBet}`);
                this.actionLogInfo.push({
                    "seat": `Seat#${seat.index}`,
                    "user_id": (seat.player as Player)?.id,
                    "action": `raise : ${seat.context.lastBet}`
                });
            }
            else if (seat.context.lastAction === 'allin') {
                this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: allin ${seat.context.lastBet}`);
                this.emit('message', seat, true, `action: allin ${seat.context.lastBet}`);
                this.actionLogInfo.push({
                    "seat": `Seat#${seat.index}`,
                    "user_id": (seat.player as Player)?.id,
                    "action": `allin : ${seat.context.lastBet}`
                });
            }
        }
        else {
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player did invalid action. Discarding action. action: ${action}, bet: $${bet}`);
            this.emit('message', seat, false, `action: Player did invalid action. Discarding action. action: ${action}, bet: $${bet}`);
            return false;
        }

        seat.money = seat.context.money;

        this.log(`Seat#${seat.index}(${seat.player?.name}): Action success. action: ${seat.context.lastAction}, bet: $${seat.context.lastBet}, total bet: $${seat.context.bet}, money: $${seat.context.money}`);
        this.emit('message', seat, true, `Action success. action: ${seat.context.lastAction}, bet: $${seat.context.lastBet}, total bet: $${seat.context.bet}, money: $${seat.context.money}`);
        this.timebank(seat);

        this.onAction(seat, seat.context.lastAction, bet);
        this.emit('action', seat, seat.context.lastAction, bet);
        this.emit('log', `${seat.player?.name}:${seat.context.lastAction} ${bet === 0 ? '' : bet}`)

        if (this._context.state < RoundState.Showdown && this._context.checkAllPlayersBet()) {
            this.returnLastSidepot();
        }
        if (this._context.checkAllPlayersBet() && (seat.player as Player).room?.options.mode === "cash")
            await this.insurance();

        if (!this.checkState()) {
            const setTurnTimeout = this._context.state === RoundState.Showdown ? false : true;
            if (setTurnTimeout) {
                setTimeout(() => this.nextTurn(), 2000);
            } else {
                this.nextTurn();
            }
        } else {
            this._returnedSidePot = false;
        }

        if (seat.state === TableSeatState.Empty) {
            this._context.remove(seat.index);
        }


        return true;
    }

    protected onAction(seat: TableSeat, action: Action | undefined, bet: number | undefined) { }

    protected timebank(seat: TableSeat) {
        const elapsed = this.stopTurnTimer();

        if (seat.state !== TableSeatState.Playing)
            return;

        /*if (elapsed <= this.options.timeToReact!) { // if player didn't use timebank, +bonus timebank until max value
            seat.timebank = Math.min(seat.timebank! + this.options.timebankBonus!, this.options.timebankMax!);
            this.log(`1 elapsed : ${elapsed},options.timebankBonus : ${this.options.timebankBonus},options.timebankMax : ${this.options.timebankMax},seat.timebank = ${seat.timebank}`);
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player didn't use time bank. bonus: +${this.options.timebankBonus}s, now timebank: ${seat.timebank}s`);
            this.emit('message', true, `Player didn't use time bank. bonus: +${this.options.timebankBonus}s, now timebank: ${seat.timebank}s`);
        }
        else {
            seat.timebank = Math.max(this.options.timeToReact! + seat.timebank! - elapsed, 0);
            this.log(`2 elapsed : ${elapsed},options.timeToReact : ${this.options.timeToReact},seat.timebank = ${seat.timebank}`);
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player time bank: ${seat.timebank}s`);
            this.emit('message', true, `Player time bank: ${seat.timebank}s`);
        }*/

        if (elapsed >= this.options.timeToReact!) {
            seat.timebank = Math.max(this.options.timeToReact! + seat.timebank! - elapsed, 0);
            this.log(`2 elapsed : ${elapsed},options.timeToReact : ${this.options.timeToReact},seat.timebank = ${seat.timebank}`);
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player time bank: ${seat.timebank}s`);
            this.emit('message', true, `Player time bank: ${seat.timebank}s`);
        }
    }

    protected checkState() {

        if (this._context.checkPreflopOnePlayerRemaining()) {
            this._preflopFold = true;
        }

        const state = this._context.checkState();
        if (state === undefined)
            return false;

        if (state >= RoundState.River) {
            this.emit('sidebet', { street: 1, options: this.options.sideBetOptions![0] });
        }
        else {
            this.emit('sidebet', { street: state + 1, options: this.options.sideBetOptions![state] });
        }

        setTimeout(() => this.emit('animation', { "type": "TableStatus", "data": { "state": RoundState[state] } }), this._seats.length * 55);
        if (state >= RoundState.HoleCards && state <= RoundState.Showdown) {
            this.getPlayingSeats().forEach(seat => {
                if (seat.context.fold ?? false) {
                    seat.hand = undefined;
                }
                else {
                    this.solveHands(seat);
                }
            });
        }

        setTimeout(() => this.startCurrentState(), 1200);
        return true;
    }

    protected async insurance() {
        const allinPlayers = this._context.getPlayingSeats().filter(seat => seat.lastAction == "allin" && seat.fold !== true).map(seat => seat.index);
        console.log(`allinPlayers : ${allinPlayers.length}`);
        if (allinPlayers.length == 2 && !this._insurance) {
            this.CheckWinner();
            var insuranceDelay = false;
            var insuranceWinPrice:number = 0;
             let pots = this._context.calculatePots();
            console.log(pots);
            pots.forEach(pot => {
               const allinPlayrsInPot = pot.seats.filter(seat=>allinPlayers.includes(seat.index)).map(seat => seat.index);
               console.log(`allin players : ${allinPlayers}`);
               console.log(`allinPlayrsInPot : ${allinPlayrsInPot}`);
               console.log(`pot.amount : ${pot.amount}`);

                if(allinPlayrsInPot.length > 0)
                    insuranceWinPrice += Number(pot.amount);
            });

            this.getPlayingSeats().forEach(seat => {
                var loosePercentage = Number((100 - seat.winPercentage!).toFixed(2));
                console.log(`Seat#${seat.index}(${seat.player?.name}),winPercentage:${seat.winPercentage},loosePercentage:${loosePercentage}`);
                if (seat.winPercentage !== undefined && loosePercentage <= 33) {

                    var insurancePrice = (insuranceWinPrice * (loosePercentage + 5) / 100).toFixed(2);
                    console.log(`Seat#${seat.index}(${seat.player?.name}) (${insuranceWinPrice} * (${loosePercentage} +5) / 100) = ${insurancePrice}`);
                    this.emit('insurance', { status: true, seat: seat, data: { allInPrice:  insuranceWinPrice, insurancePrice: insurancePrice } });
                    insuranceDelay = true;
                }
            });

            if (insuranceDelay) {
                this._insurance = true;
                await delay(1000 * 5);
                this.emit('insurance', { status: false, data: [] });
            }
        }
    }

    protected CheckWinner() {
        const seats: TableSeat[] = [];
        const totalWin: number[] = [];
        const removeCards: String[] = [...this._context.cards!];
        var totalCards:number = 0;
        this.getPlayingSeats().forEach(seat => {
            if (seat.context.fold !== true && seat.context.lastAction == "allin") {
                seats.push(seat);
                removeCards.push(...seat.context.cards!);
            }
        });
        console.log(removeCards);
        const deckCards  = this._context.getNewDeck.filter(card => !removeCards.includes(card));
        if(RoundState.HoleCards === this._context.state){
            seats.forEach(seat => {
                var selectedCards = ["AC","AH","AD","AS"];
                if(seat.context.cards!.find((palyerCard) => selectedCards.includes(palyerCard)) !== undefined)
                {
                    seat.winPercentage = 66;
                }
            });
            return true;
        }
        else if(RoundState.Flop === this._context.state)
        {
            totalCards = deckCards.length * (deckCards.length - 1);
            const flopCards = deckCards;
            flopCards.forEach(flopCard=> {
                const turnCard = deckCards;
                turnCard.forEach(turnCard=> {
                    if(flopCard !== turnCard)
                    {
                        const winners =  this.getWinnser(seats,[flopCard,turnCard]);
                        winners.forEach(winner => {
                            totalWin[winner.index] = (totalWin[winner.index] != null) ? totalWin[winner.index] + 1 : 1;
                        });
                    }
                });
            });
        }else if(RoundState.Turn === this._context.state)
        {
            totalCards = deckCards.length;
            deckCards?.forEach(card => {
              const winners =  this.getWinnser(seats,[card]);
                winners.forEach(winner => {
                    totalWin[winner.index] = (totalWin[winner.index] != null) ? totalWin[winner.index] + 1 : 1;
                });
            });
        }
        console.log(`deckCards :${totalCards}`);
        console.log(totalWin);

        totalWin.forEach((totalwin, index) => {
            if (totalwin)
                this._seats[index].winPercentage = Number((totalwin * 100 / totalCards).toFixed(2));
        });
    }

    protected getWinnser(seats:TableSeat[],cards:Card[]) {
        seats.forEach(seat => {
            const totalCards = [...this._context.cards!, ...cards, ...seat.context.cards!];
            if (this.options.gameType === 'nlh')
                seat.hand = solveNlhHand(totalCards);
            else if (this.options.gameType === 'plo' || this.options.gameType === 'plo5' || this.options.gameType === 'nlh4')
                seat.hand = solvePloHand(seat.context.cards!, [...this._context.cards!,...cards]);

        });
       return this.getWinners(seats);
    }

    protected calculateInsuranceWinner() {
        const results = this._result;
        const winners:Array<number> = [];
        results?.pots.forEach(result => {
            result.winners.forEach(seat => {
                if(!winners.includes(seat.index))
                    winners.push(seat.index);
            });
        });

        console.log(`winners : ${winners},insurancePlayers:${JSON.stringify(this.getInsurancePlayers)}`);
        this._insurancePlayers.filter(player => winners.includes(player.index!)).forEach(value => { 
            value.is_win = true; 
            value.insuranceWinAmount = value.insuranceWinAmount / winners.length;
        });

        const insurancePlayers = this._insurancePlayers.filter(player => player.is_win == true);
        if (insurancePlayers.length <= 0) {
           
            this._insurancePlayers.forEach(player => { 
                player.is_win = true;
                player.insuranceWinAmount = player.insuranceAmount;
             });
             console.log(`insurancePlayers loose game:${JSON.stringify(this.getInsurancePlayers)}`);
        }
    }

    protected startCurrentState() {

        this.updateCurrentState();

        this.stopTurnTimer();

        if (this._context.state !== RoundState.HoleCards)
            this._context.resetStreetPot();

        const cards = this._context.cards?.join();
        this.log(`-> STATE: ${RoundState[this._context.state]}, cards: [${cards}]`);
        this.logger.info(`*** ${RoundState[this._context.state]} *** [${cards}]`);
        this.emit('log', RoundState[this._context.state]);

        const streetStrs = ['pre_flop', 'flop', 'turn', 'river'];
        streetStrs.forEach(str => {
            if (this._roundLog[str] === undefined) {
                this._roundLog[str] = {
                    data: undefined,
                    dealt: undefined
                };
            }
        });

        if (this._context.state === RoundState.Flop) {
            this._roundLog["pre_flop"]["data"] = this.actionLogInfo;
            this._roundLog["flop"]["dealt"] = cards;
            this.actionLogInfo = [];
        }
        else if (this._context.state === RoundState.Turn) {
            this._roundLog["flop"]["data"] = this.actionLogInfo;
            this._roundLog["turn"]["dealt"] = cards;
            this.actionLogInfo = [];
        }
        else if (this._context.state === RoundState.River) {
            this._roundLog["turn"]["data"] = this.actionLogInfo;
            this._roundLog["river"]["dealt"] = cards;
            this.actionLogInfo = [];
        }
        else if (this._context.state === RoundState.Showdown) {
            this._roundLog["river"]["data"] = this.actionLogInfo;
            this.actionLogInfo = [];
        }

        const setTurnTimeout = this._context.state === RoundState.Showdown ? false : true;
        if (setTurnTimeout) {
            setTimeout(() => this.startCurrentTurn(), 2000);
        } else {
            this.startCurrentTurn();
        }

        if (this._context.state === RoundState.Showdown) {
            this.showdown();
        }
        else if (this._context.state < RoundState.Showdown && this._context.checkAllPlayersAllIn()) {
            this.log(`All players all-in. To showdown.`);
            this.emit('animation', { "type": "AllIn" });
            // this.returnLastSidepot();

            setTimeout(() => this.checkState(), 1500);
        }

        return true;
    }

    protected updateCurrentState() {
        const state = this._context.state;
        this.onState(state);
        this.emit('state', state);
    }

    public returnLastSidepot() {
        if (this._returnedSidePot)
            return;

        const players = this.getPlayingSeats();
        const pots = this._context.calculatePots();

        const { returnSeatIndex, returnBet } = this._context.getReturnBet(pots);

        if (!!returnSeatIndex)
            this._returnedSidePot = true;

        players.forEach(seat => {
            if (seat.index === returnSeatIndex) {
                const money = round2(seat.money! + (returnBet ?? 0));
                this.log(`Seat#${seat.index}(${seat.player?.name}): returnMoney: +$${returnBet}, money: $${seat.money!} -> $${money}`);
                this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: returned ${returnBet} from pot`);
                seat.money = money;
                seat.context.money = money;
                seat.context.bet = seat.context.bet! - (returnBet ?? 0);
                this._context.lastBet = this._context.lastBet - (returnBet ?? 0)
            }
        });
    }

    protected onState(state: RoundState) { }

    protected nextTurn() {
        this._context.nextTurn();

        this.startCurrentTurn();
    }

    protected startCurrentTurn() {
        this.log(`TURN: ${this._context.turn}`);
        this.onTurn(this._context.turn);
        this.emit('turn', this._context.turn);

        if (this._context.turn === undefined)
            return;

        this.startTurnTimer();

        const seat = this._seats[this._context.turn];
        if (seat.state !== TableSeatState.Playing) { // leave or sitout
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player isn't in playing. missing turn.`);

            setImmediate(() => this.action(seat, 'fold'));
        }
    }

    protected onTurn(turn: number | undefined) { }

    protected startTurnTimer() { }

    protected stopTurnTimer() {
        if (!!this._turnTimeout) {
            clearTimeout(this._turnTimeout);
            this._turnTimeout = undefined;
        }
        const elapsed = this._turnTimer.ms() / 1000.0;
        this._turnTimer.clear();
        return elapsed;
    }

    protected turnTimerElapsed() {
        return this._turnTimer.ms() / 1000.0;
    }

    public getSidePots(): TablePot[] {
        const allInSeats = this._context.getPlayingSeats()
            .filter(seat => seat.lastAction === 'allin');

        if (allInSeats.length > 0) {
            let pots = this._context.calculatePots();

            if (this._returnedSidePot)
                pots.pop();

            return pots.map(pot => ({
                ...pot,
                seats: pot.seats.map(seat => this._seats[seat.index])
            }));
        }
        else
            return [];
    }

    private solveHands(seat: TableSeat) {
        const cards = [...this._context.cards!, ...seat.context.cards!];
        if (this.options.gameType === 'nlh')
            seat.hand = solveNlhHand(cards);
        else if (this.options.gameType === 'plo' || this.options.gameType === 'plo5' || this.options.gameType === 'nlh4')
            seat.hand = solvePloHand(seat.context.cards!, this._context.cards!);
    }

    protected async showdown() {
        this.log(`SHOWDOWN`);
        this.getPlayingSeats().forEach(seat => {
            if (seat.context.fold ?? false) {
                this.log(`Seat#${seat.index}(${seat.player?.name}): fold`);
            }
            else if (this._context.cards!.length === 5) {
                const action = seat.context.lastAction === 'allin' ? 'allin' : 'bet';

                this.solveHands(seat);

                this.log(`Seat#${seat.index}(${seat.player?.name}): ${action}, amount: $${seat.context.bet}, cards: [${seat.hand!.cards.join()}], rank: ${HandRank[seat.hand!.rank]}`);
                this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: ${action}, amount: $${seat.context.bet}, cards: [${seat.hand!.cards.join()}], rank: ${HandRank[seat.hand!.rank]}`);
            }
        });

        if (this._context.checkAllPlayersFold()) {
            // return bets
            this.log(`All players fold. Returning bets.`);
            this.getPlayingSeats().forEach(seat => {
                seat.money! += seat.context.bet!;
            });
        }
        else {
            await this.doShowCards();
            this.calculateResult();
        }

        this.onResult();
        this.emit('result');

        setTimeout(() => this.endRound(), 1000 + 2000 * (this._result?.pots.length ?? 0));
    }

    private async doShowCards() {
        if (this._context.checkAllPlayersAllIn() || this._context.checkOnePlayerRemaining()) {
            return;
        }

        const sidePotWinners = this.getSidePotsWinners();

        const raisedSeats = this.getPlayingSeats()
            .filter(seat => !(seat.context.fold ?? false) && seat.context.lastAction === 'raise')
            .sort((a, b) => (b.context.lastBet ?? 0) - (a.context.lastBet ?? 0));

        let firstSeat = raisedSeats.length > 0 ? raisedSeats[0] : this._seats[this._context.seatOfSmallBlind ?? this._context.seatOfBigBlind!];

        // if (raisedSeats.length > 0) {
        //     raisedSeats.forEach(seat => {
        //         if (seat.context.lastBet! > (firstSeat.context.lastBet!))
        //             firstSeat = seat;

        //     });
        // }

        if (!(firstSeat.context.fold ?? false))
            this.emit('showcards', firstSeat);

        if (firstSeat == undefined) { console.log(this._context.seatOfSmallBlind) }
        let firstIndex = firstSeat.index;
        let prevSeat = firstSeat;
        for (let i = 1; i < this._seats.length; ++i) {
            const nextIndex = (firstIndex + i) % this._seats.length;
            const seat = this._seats[nextIndex];
            if (seat.state !== TableSeatState.Playing)
                continue;
            if (seat.context.fold ?? false) {
                continue;
            }
            const betterIndexs = this.getWinners([prevSeat, seat]).map(seat => seat.index);
            if (betterIndexs.indexOf(seat.index) != -1 || sidePotWinners.find(winner => winner.index === seat.index) !== undefined) {
                this.emit('showcards', seat);
                prevSeat = seat;
            }
            else {
                this.emit('muckcards', seat);
            }

            await delay(1000);
        }

    }

    protected onResult() { }

    private getSidePotsWinners() {
        let winners: TableSeat[] = [];
        let pots = this._context.calculatePots();

        if (this._returnedSidePot)
            pots.pop();

        pots.forEach((pot) => {
            const seats = pot.seats.map(seat => this._seats[seat.index]);
            winners.push(...this.getWinners(seats));
        });

        return winners;
    }

    protected calculateResult() {
        const players = this.getPlayingSeats();
        const results: TablePotResult[] = [];
        const lastRaise = this.calculateLastRaise();

        const potResult: Array<any> = [];
        const sidePots: Array<any> = [];
        let pots = this._context.calculatePots();

        if (this._returnedSidePot)
            pots.pop();
        // const {returnSeatIndex, returnBet} = this._context.getReturnBet(pots);
        // if (!!returnBet)
        //     pots.pop();

        this.log(`Side POTs.`);
        pots.forEach((pot, i, pots) => {
            const seats = pot.seats
                .map(seat => this._seats[seat.index])
                .map(seat => {
                    return { seat: `Seat#${seat.index}`, user_id: (seat.player as Player)?.id };
                });
            this.log(`POT#${i}: amount: $${pot.amount}, seats: ${JSON.stringify(seats)}`);
            sidePots.push({
                index: i,
                amount: pot.amount,
                players: seats.map(seat => seat.user_id)
            });
        });

        this.log(`Splitting POTs.`);

        pots.forEach((pot, i, pots) => {
            const seats = pot.seats.map(seat => this._seats[seat.index]);

            const rake = this.calculateRake(seats, (i === pots.length - 1) ? round2(pot.amount - lastRaise) : pot.amount);
            this._roundRake = round2(this._roundRake + rake);
            const amount = round2(pot.amount - rake);

            const result = this.splitPot(seats, amount);
            this.log(`POT#${i}: amount: $${pot.amount}, number of winners: ${result.winners.length}, prize: $${result.prize}, rake: $${rake}`);
            this.logger.info(`POT#${i}: amount: ${pot.amount}, number of winners: ${result.winners.length}, prize: ${result.prize}, rake: ${rake}`);

            const winners: Array<any> = [];
            result.winners.forEach(seat => {
                this.log(`Seat#${seat.index}(${seat.player?.name}): Prize: +$${result.prize}`);
                seat.prize = round2(seat.prize! + result.prize);
                winners.push({
                    "user_id": (seat.player as Player)?.id,
                    "seat": `Seat#${seat.index}`,
                    "collect": result.prize,
                })
            });

            results.push(result);
            potResult.push({
                "amount": amount,
                "winners": winners,
                "prize": result.prize,
                "rake": rake,
            });
        });

        this.log(`Giving prizes.`);
        players.forEach(seat => {
            if (seat.prize! > 0) {
                const money = round2(seat.money! + seat.prize!);
                this.log(`Seat#${seat.index}(${seat.player?.name}): prize: +$${seat.prize}, money: $${seat.money!} -> $${money}`);
                this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: collected ${seat.prize} from pot`);
                seat.money = money;
            }

            // if (seat.index === returnSeatIndex) {
            //     const money = round2(seat.money! + (returnBet ?? 0));
            //     this.log(`Seat#${seat.index}(${seat.player?.name}): returnMoney: +$${returnBet}, money: $${seat.money!} -> $${money}`);
            //     this.logger.info(`Seat#${seat.index}: ${seat.player?.name}: returned ${returnBet} from pot`);
            //     seat.money = money;
            // }
        });

        this._totalRake = round2(this._totalRake + this._roundRake);
        this.log(`Rake: round: $${this._roundRake}, total: $${this._totalRake}`);
        this.logger.info(`Rake: ${this._roundRake}`);

        this._roundLog["showdown"] = {
            "pots": potResult,
            "Rake": this._roundRake,
        };

        this._roundLog["pots"] = sidePots;

        if (!this.checkSum()) {
            this.logger.error(JSON.stringify(this._roundLog));
        }

        this._roundLog.LeavePlayers = this.getLeavePlayers();
        this._roundLog.StayPlayers = this.getStayPlayers();

        this._result = {
            players,
            pots: results,
        };

        this.calculateInsuranceWinner();
    }

    public addSelfOutPlayer(seat?: TableSeat) { }

    protected getLeavePlayers() { }

    public getStayPlayers() { }

    private checkSum() {
        const initialSum = this._roundLog.init_state.data
            .reduce((initialSum: number, current: any) => initialSum + current.chips, 0);

        const lastSum = this.getPlayingSeats()
            .filter(playSeat => {
                const seat = this._seats[playSeat.index];
                const userId = (seat.player as Player)?.id;

                return this._roundLog.init_state.data.filter((data: any) => data.user_id == userId).length > 0;
            })
            .reduce((lastSum: number, current: TableSeat) => lastSum + (current.money ?? 0), 0)
            + this._roundLog.showdown.Rake;

        console.log("initialSum => ", initialSum);
        this._roundLog.StartBalance = [];

        this._roundLog.init_state.data.map((seat: any) => {
            console.log(seat.user_id, '=>', seat.chips);
            this._roundLog.StartBalance.push({ user_id: seat.user_id, chips: seat.chips });
        });

        console.log("lastSum => ", lastSum);
        this._roundLog.EndBalance = [];

        this.getPlayingSeats()
            .filter(playSeat => {
                const seat = this._seats[playSeat.index];
                const userId = (seat.player as Player)?.id;

                if (this._roundLog.init_state.data.filter((data: any) => data.user_id == userId).length > 0) {
                    console.log(userId, '=>', seat.money);
                    this._roundLog.EndBalance.push({ user_id: userId, chips: seat.money });
                }

                return this._roundLog.init_state.data.filter((data: any) => data.user_id == userId).length > 0;
            });

        console.log("CheckSum => ", initialSum == lastSum);

        return Math.abs(initialSum - lastSum) < 0.001;
    }

    protected calculateLastRaise() {
        const bets = this._context.getPlayingSeats().map(seat => seat.bet ?? 0).sort((a, b) => b - a);
        return round2(bets[0] - bets[1]);
    }

    protected calculateRake(seats: TableSeat[], amount: number) {
        if (seats.length === 1)
            return 0;

        if (this._context.checkOnePlayerRemaining()) {
            if (!this.options.rakePreFlop && this._preflopFold)
                return 0;
        }
        else {
            const winners = this.getWinners(seats);
            if (winners.length > 1 && !this.options.rakeSplitPot)
                return 0;
        }

        let rake;

        if (this.options.rakeCap! !== 0)
            rake = Math.min(this.options.rakeCap!, amount * this.options.rake! / 100);
        else
            rake = amount * this.options.rake! / 100;

        return this.options.rakeRound ? round0(rake) : round2(rake);
    }

    protected splitPot(seats: TableSeat[], amount: number): TablePotResult {
        const winners = this.getWinners(seats);
        const prize = winners.length > 0 ? round2(amount / winners.length) : 0;
        return { amount, winners, prize, };
    }

    protected getWinners(seats: TableSeat[]) {
        seats = seats.filter(seat => !seat.context.fold);
        if (seats.length < 2 || seats.every(seat => seat.hand === undefined))
            return seats;

        seats = seats.filter(seat => seat.hand !== undefined);
        return solveWinners(seats.map(seat => seat.hand!))
            .map(hand => seats.find(seat => seat.hand === hand)!);
    }

    public getRoundResult() {
        return this._result;
    }

    public getSeatsToShowCards() {
        const seats: TableSeat[] = [];
        // if (this._context.state !== RoundState.Showdown) {
        if (this._context.checkAllPlayersAllIn()) {
            seats.push(...this.getPlayingSeats());
        }
        // }
        // else {
        //     seats.push(...this.getPlayingSeats().filter(seat => !(seat.context.fold ?? false)));
        // }

        return seats.length === 1 ? [] : seats;
    }

    protected endRound() {
        this.log(`ROUND END`);

        this._context.reset();
        this._result = undefined;

        this._seats.forEach(seat => {

            if (seat.state === TableSeatState.Playing) {
                seat.state = TableSeatState.Waiting;
                this.emit('seat', seat);
            }
            // else if (seat.state === TableSeatState.SitOut) {
            //     seat.play = undefined;
            // }
        });

        this.onEnd();
        this.emit('end');

        this._seats.forEach(seat => {
            if (seat.state === TableSeatState.SitOut) {
                seat.play = undefined;
            }
        });

        // this.scheduleNewRound();
    }

    protected onEnd() { }

    public showCards(seat: TableSeat) {
        if (seat.state != TableSeatState.Playing) {
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player is not playing. Discarding showcards.`);
            return false;
        }

        if (this._context.state !== RoundState.Showdown) {
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player did showcards in incorrect state. state: ${RoundState[this._context.state]}. Discarding showcards.`);
            return false;
        }

        this.log(`Seat#${seat.index}(${seat.player?.name}): Player showcards success. showcards: [${seat.context.cards?.join()}]`);

        this.onShowCards(seat);
        this.emit('showcards', seat);
        return true;
    }

    protected onShowCards(seat: TableSeat) { }

    public joining(seat: TableSeat) {
        seat.state = TableSeatState.Joining;
        seat.play = undefined;
        this.onSeatState(seat);
        this.emit('seat', seat);

        this.log(`Seat#${seat.index}(${seat.player?.name}): State changed to Joining.`);
        this.emit('message', seat, true, `State changed to Joining.`);

        return true;
    }

    public sitOut(seat: TableSeat) {
        if (seat.state !== TableSeatState.Playing && seat.state !== TableSeatState.Waiting) {
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player is not waiting or playing. Discarding sitout.`);
            this.emit('message', seat, false, `Player is not waiting or playing. Discarding sitout.`);
            return false;
        }

        seat.state = TableSeatState.SitOut;

        if (this._context.turn === seat.index)
            this.action(seat, 'fold');

        this.onSeatState(seat);
        this.emit('seat', seat);

        this.startSitOutTimeout(seat);

        this.log(`Seat#${seat.index}(${seat.player?.name}): Sitout success.`);
        this.emit('message', seat, true, `Sitout success.`);

        return true;
    }

    public sitIn(seat: TableSeat) {
        if (seat.state !== TableSeatState.SitOut) {
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player is not sitout. Discarding sitin.`);
            this.emit('message', seat, false, `Player is not sitout. Discarding sitin.`);
            return false;
        }

        if (this._context.isSeatPlaying(seat.index)) {
            seat.state = TableSeatState.Playing;
        }
        else {
            seat.state = TableSeatState.Waiting;
        }
        this.onSeatState(seat);
        this.emit('seat', seat);

        this.onSitIn(seat);

        this.clearSitOutTimeout(seat);

        this.log(`Seat#${seat.index}(${seat.player?.name}): Sitin success.`);
        this.emit('message', seat, true, `Sitin success.`);

        this.scheduleNewRound();

        return true;
    }

    public setClosed(status: boolean) {
        this._closed = status;
        if (status)
            this.emit('closeTable', true);
    }


    protected onSitIn(seat: TableSeat) { }

    public startNextLevel(nextLevelOption: any) { }

    public startTournament() { }
    public setUsdRate(usdRate: number) {
        this._usdRate = usdRate;
    }
}
