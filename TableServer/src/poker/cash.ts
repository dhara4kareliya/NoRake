import { Room } from "./room";
import { Player } from "./player";
import { TableSeatState, Table, TableOptions, TableSeat, TableRoundStartContext } from "./table";
import { PFLogic } from "./pfl";
import { round2 } from "./math";
import winston from "winston";
import moment from 'moment';
export interface CashTableOptions extends TableOptions {
    minBuyIn?: number;
    maxBuyIn?: number;
}

type PlayerContext = {
    missingBB?: boolean;
    missingSB?: boolean;

    waitForBB?: boolean;
    sitOutNextHand?: boolean;
};

export class CashTable extends Table {
    private _pfl: PFLogic;
    private _seatContexts: PlayerContext[];

    constructor(public readonly options: CashTableOptions, logger: winston.Logger) {
        super(options, logger);

        this.options.minBuyIn ??= this.options.bigBlind * 20;

        this._pfl = new PFLogic();

        this._seatContexts = [];
        for (let i = 0; i < this.options.numberOfSeats; ++i)
            this._seatContexts.push({});
    }

    protected onLeave(seat: TableSeat) {
        this._pfl.playerLeaves(seat.index);
        this._seatContexts[seat.index] = {};
    }

    protected onSeatState(seat: TableSeat) {
        if (seat.state === TableSeatState.Waiting) {
            this.waitForBB(seat, true);
        }
        else if (seat.state === TableSeatState.SitOut) {
            this._pfl.playerSitOut(seat.index, false);
        }
        else if (seat.state === TableSeatState.Joining) {
            this._pfl.playerLeaves(seat.index);
        }
    }

    protected onSitIn(seat: TableSeat) {
        if (seat.state === TableSeatState.Playing) {
            this._pfl.addPlayer(seat.index, false);
        }
    }

    protected startTurnTimer() {
        this.stopTurnTimer();

        const seat = this._seats[this._context.turn!];
        this._turnTimeout = setTimeout(() => {
            this.log(`Seat#${seat.index}(${seat.player?.name}): Turn timer timeout. Fold and sitout.`);
            this.emit('message', true, `Turn timer timeout. Fold and sitout.`);
            this.action(seat, 'fold');
            this.sitOut(seat);
        }, (this.options.timeToReact! + seat.timebank!) * 1000);
        this._turnTimer.start();
    }

    public buyIn(seat: TableSeat, amount: number) {
        const money = (seat.money ?? 0);
        if (money < this._bigBlind!) {
            const newMoney = amount + money;

            if (newMoney < this.options.minBuyIn!) {
                this.log(`Seat#${seat.index}(${seat.player?.name}): Player did buy-in below min. buyin: $${amount}, min-buy-in: $${this.options.minBuyIn}. Discarding buy-in.`);
                return 0;
            }
    
            if (this.options.maxBuyIn !== undefined && newMoney > this.options.maxBuyIn) {
                amount = round2(newMoney - this.options.maxBuyIn);
            }
        }

        return super.buyIn(seat, amount);
    }

    public addChips(seat: TableSeat, amount: number) {
        return super.buyIn(seat, amount);
    }

    public waitForBB(seat: TableSeat, value: boolean = true) {
        const context = this._seatContexts[seat.index];
        if (!context)
            return false;

        if (seat.state !== TableSeatState.Waiting) {
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player is not waiting. Discarding waitforbb setting.`);
            return false;
        }

        context.waitForBB = value;
        this.log(`Seat#${seat.index}(${seat.player?.name}): Setting waitforbb success. value: ${context.waitForBB}`);
        return true;
    }

    public sitOutNextHand(seat: TableSeat, value: boolean = true) {
        const context = this._seatContexts[seat.index];
        if (!context)
            return false;

        if (seat.state !== TableSeatState.Playing) {
            this.log(`Seat#${seat.index}(${seat.player?.name}): Player is not playing. Discarding sitout setting.`);
            return false;
        }

        context.sitOutNextHand = value;
        this.log(`Seat#${seat.index}(${seat.player?.name}): Setting sitout nexthand success. value: ${context.sitOutNextHand}`);
        return true;
    }

    public getSettings() {
        return {
            ...super.getSettings(),
            mode: 'cash',
            minBuyIn: this.options.minBuyIn,
            maxBuyIn: this.options.maxBuyIn,
        };
    }

    public getStatus() {
        const status = super.getStatus();
        return {
            ...status,
            seats: status.seats.map((seat, index) => {
                const context = this._seatContexts[index];
                return {
                    ...seat,
                    missingSB: context.missingSB,
                    missingBB: context.missingBB,
                    waitForBB: context.waitForBB,
                    sitOutNextHand: context.sitOutNextHand,
                }
            }),
        };
    }

    public startRound() {
        // try to add new players
        this.getWaitingSeats().forEach(seat => {
            if (!(seat.play ?? 0)) {
                const context = this._seatContexts[seat.index];

                if (this._pfl.canjoinNow(seat.index, context.waitForBB ?? false, false))
                    this._pfl.addPlayer(seat.index, false);
            }
        });
            
        const list = this._pfl.run(this.options.bigBlind, this.options.smallBlind, false);

        const start: TableRoundStartContext = {
            seats: [],
            seatOfDealer: 0,
        };
        list.forEach(res => {
            const context = this._seatContexts[res.sitIndex];
            context.missingBB = res.missBB;
            context.missingSB = res.missSB;
            let sum = res.sum;

            if (res.isSB) sum -= this.options.smallBlind;
            if (res.isBB) sum -= this.options.bigBlind;
                
            let ante = 0;
            if (res.missSB || res.sbAnte) {
                ante = this.options.smallBlind;
                sum -= this.options.smallBlind;
            }
            if (res.missBB) {
                sum = this.options.bigBlind;
            }

            if (!res.emptySit && !res.sitOut) {
                start.seats.push({
                    index: res.sitIndex,
                    ante,
                    sum,
                });
            }

            if (res.isD) start.seatOfDealer = res.sitIndex;
            if (res.isBB) start.seatOfBigBlind = res.sitIndex;
            if (res.isSB) start.seatOfSmallBlind = res.sitIndex;
            if (res.noBB) start.noBB = res.noBB;
        });

        return start;
    }

    protected onEnd() {
        this.getWaitingSeats().forEach(seat => {
            if (seat.money! < this.options.bigBlind!) {
                this.log(`Seat#${seat.index}(${seat.player?.name}): Player has insufficient money to play. money: $${seat.money}, Waiting buyin.`);
                this.joining(seat);
            }
            else {
                const context = this._seatContexts[seat.index];
                if (!!context && (context.sitOutNextHand ?? false)) {
                    this.sitOut(seat);
                    context.sitOutNextHand = undefined;
                }
            }
        });
    }

    public updateWaitList(players: Player[]) {
        this.emit('waitlist', players);
    }
}

type PlayerLastStatus = {
    time: number;
    money: number;
    timebank?: number;
}

export class CashGameController {
    private waitingListPlayers: Player[] = [];
    private lastStatus: Map<string, PlayerLastStatus> = new Map();
	private lastDate: string = moment(new Date()).format("DD/MM/YYYY");

    constructor(private readonly room: Room, private readonly table: CashTable, private readonly logger: winston.Logger) {
    }

    private log(message?: any, ...optionalParams: any[]) {
        this.logger.debug(`CashGame(Table#${this.table.id}): ${message}`, ...optionalParams);
    }

    public start() {
        this.log(`Starting cash game.`);

        this.room.setTable(this.table);
        this.room.on('join', (player) => this.onPlayerJoin(player));
		this.room.setCurrencyRate();
		
		setInterval(()=>{
			var todayDate = moment(new Date()).format("DD/MM/YYYY");
			this.log(`setCurrencyRate function call lastDate :${this.lastDate},${todayDate}`);
            if(this.lastDate != todayDate)
			{
				this.room.setCurrencyRate();
				this.lastDate = todayDate;
				this.log(`getCurrencyRate api call lastDate : ${this.lastDate}`);
			}
				
        }, 1000 * 60 * 60);
    }

    private onPlayerJoin(player: Player) {
        if (!this.checkLastStatus(player)) {
            this.log(`The last status of the player(${player.name}) is invalid. Leaving now.`);
            setImmediate(() => player.leave({ type: 'kickout' }));
            return;
        }

        setTimeout(() => {
            this.table.updateWaitList(this.waitingListPlayers);
        }, 100);

        player
            .on('leave', () => this.onPlayerLeave(player))
            .on('sitdown', (seatIndex) => this.onPlayerSitDown(player, seatIndex))
            .on('buyin', (amount) => this.onPlayerBuyIn(player, amount))
            .on('action', (action, bet?) => this.onPlayerAction(player, action, bet))
            .on('showcards', () => this.onPlayerShowCards(player))
            .on('sitout', () => this.onPlayerSitOut(player))
            .on('sitin', () => this.onPlayerSitIn(player))
            .on('waitforbb', (value) => this.onPlayerWaitForBB(player, value))
            .on('sitoutnexthand', (value) => this.onPlayerSitOutNextHand(player, value))
            .on('joinwaitlist', () => this.onPlayerJoinWaitlist(player))
            .on('chat', (msg) => this.onPlayerChat(player, msg));
    }

    private onPlayerJoinWaitlist(player: Player) {
        if (this.waitingListPlayers.length >= 6) 
            return;

        this.waitingListPlayers.push(player);
        this.table.updateWaitList(this.waitingListPlayers);
    }

    private onPlayerChat(player: Player, msg: string) {
        this.table.doBroadcastChat(player, msg);
    }

    private onPlayerLeave(player: Player) {
        this.saveLastStatus(player);
        this.processWaitingListPlayers();
    }

    private processWaitingListPlayers() {
        setTimeout(() => {
            while (this.waitingListPlayers.length > 0) {
                const seat = this.table.getEmptySeats()[0];
                if (!seat)
                    break;
                
                const player = this.waitingListPlayers.shift()!;
                this.sitDown(player, seat);

                this.table.updateWaitList(this.waitingListPlayers);
            }
        }, 100);
    }

    private sitDown(player: Player, seat: TableSeat) {
        player.sitDown(seat.index);
    }

    private checkRejoinInterval(player: Player) {
        const lastStatus = this.lastStatus.get(player.name);

        if (player.leavePending) return { "status": false, "RestOfTime": 61*1000 };
        if (lastStatus === undefined) return { "status": true, "RestOfTime": 60*1000 };

        const now = moment().valueOf();
        const RestOfTime = (lastStatus.time + 60*1000) - now;
        if (RestOfTime >= 0)
        return { "status": false, "RestOfTime":RestOfTime };
        
    return { "status": true, "RestOfTime": RestOfTime };
    }

    private checkLastStatus(player: Player) {
        this.collectOldLastStatus();

        const lastStatus = this.lastStatus.get(player.name);
        return lastStatus === undefined || player.cash >= lastStatus.money;
    }

    private collectOldLastStatus() {
        const now = moment().valueOf();
        [...this.lastStatus.entries()]
        .filter(([_, lastStatus]) => now - lastStatus.time >= 3600*1000)
        .map(([key, _]) => key)
        .forEach(key => {
            this.lastStatus.delete(key);
        });
    }

    private saveLastStatus(player: Player) {
        const seat = player.seat;
        if (!seat)
            return;

        this.lastStatus.set(player.name, {
            time: moment().valueOf(),
            money: seat.money ?? 0,
            timebank: seat.timebank,
        });
    }

    private async loadLastStatus(player: Player) {
        const seat = player.seat;
        if (!seat)
            return;

        const lastStatus = this.lastStatus.get(player.name);
        
        if (lastStatus === undefined)
            return;
        
        seat.timebank = lastStatus.timebank;

        const newMinBuyIn = Math.max(lastStatus.money, this.table.options.minBuyIn!);
        player.setBuyInPanelVisible(newMinBuyIn);

        // if (player.cash < lastStatus.money || lastStatus.money < this.table.options.minBuyIn!)
        //     return;

        // if (lastStatus.money > 0) {
        //     if (!await player.deposit(lastStatus.money))
        //         return;

        //     this.table.addChips(seat, lastStatus.money);
        // }
    }

    private onPlayerSitDown(player: Player, seatIndex: number) {
        const seat = this.table.getSeatAt(seatIndex);
        if (!seat) {
            this.log(`Player(${player.name}) try to invalid seat: ${seatIndex}. Discarding sitdown.`);
            return;
        }
        var checkrejoininterval = this.checkRejoinInterval(player);
        if (!checkrejoininterval.status) {
			//
            this.log(`Need wait 60s to rejoin this game. Leaving now.`);
            player.sendMessage(false, `There is mandatory ${Math.round(checkrejoininterval.RestOfTime / 1000)} seconds delay if you want to rejoin this game`,{type:"RejoinInterval",RestOfTime:checkrejoininterval.RestOfTime});
            return;
        }

        if (player.cash < this.table.options.minBuyIn!) {
            player.sendMessage(false, `Not enough balance, please deposit to your account first. min buy in for the table is ${this.table.options.minBuyIn}`);
            return;
        }

        const lastStatus = this.lastStatus.get(player.name);
        if (lastStatus !== undefined && player.cash >= lastStatus.money && lastStatus.money > 0 && lastStatus.money >= this.table.options.minBuyIn!) {
            // player.setBuyInPanelInvisible()
        }
        else if (!!lastStatus && player.cash < lastStatus.money) {
            player.sendMessage(false, `Not enough balance, please deposit to your account first. min buy in for the table is ${lastStatus.money}`);
            return;
        }

        this.table.sitDown(seat, player);

        if (player.seat) {
            this.loadLastStatus(player);
        }
    }

    
    private onPlayerBuyIn(player: Player, amount: number) {
        if (!player.seat) {
            this.log(`Player(${player.name}) didn't sit down. Discarding buy-in.`);
            return;
        }

        this.table.buyIn(player.seat, amount);
    }

    private onPlayerAction(player: Player, action: string, bet?: number) {
        if (!player.seat) {
            this.log(`Player(${player.name}) didn't sit down. Discarding action.`);
            return;
        }

        if (!['fold', 'bet'].includes(action)) {
            this.log(`Player(${player.name}) did invalid action: ${action}. Discarding action.`);
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

    private onPlayerSitOut(player: Player) {
        if (!player.seat) {
            this.log(`Player(${player.name}) didn't sitdown. Discarding sitout.`);
            return;
        }

        this.table.sitOut(player.seat);
    }

    private onPlayerSitIn(player: Player) {
        if (!player.seat) {
            this.log(`Player(${player.name}) didn't sitdown. Discarding sitin.`);
            return;
        }

        this.table.sitIn(player.seat);
    }

    private onPlayerWaitForBB(player: Player, value: boolean) {
        if (!player.seat) {
            this.log(`Player(${player?.name}) didn't sitdown. Discarding waitforbb setting`);
            return;
        }

        this.table.waitForBB(player.seat, value);
    }

    private onPlayerSitOutNextHand(player: Player, value: boolean) {
        if (!player.seat) {
            this.log(`Player(${player.name}) didn't sitdown. Discarding sitout on next hand`);
            return;
        }

        this.table.sitOutNextHand(player.seat, value);
    }
}
