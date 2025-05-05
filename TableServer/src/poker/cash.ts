import { Room } from "./room";
import { Player, SideBetState } from "./player";
import { TableSeatState, Table, TableOptions, TableSeat, TableRoundStartContext } from "./table";
import { PFLogic } from "./pfl";
import { floor4,round0 } from "./math";
import winston from "winston";
import moment from 'moment';
import { delay } from '../services/utils';
import { getErrorMessage } from "../messages";

export interface CashTableOptions extends TableOptions {
    minBuyIn?: number;
    maxBuyIn?: number;
    ante?:number;
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

        this._pfl = new PFLogic(this.options.numberOfSeats);

        this._seatContexts = [];
        for (let i = 0; i < this.options.numberOfSeats; ++i)
            this._seatContexts.push({});

        this._ante = this.options.ante;
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
            this.emit('message', true, getErrorMessage("TurnTimeError"));
            
            if ((seat.player as Player).hasSidebet(SideBetState.PreCards)) {
                this.action(seat, 'fold');
            }
            else {
                this.sitOut(seat);
            }
        }, (this.options.timeToReact! + seat.timebank!) * 1000);
        this._turnTimer.start();
    }

    public buyIn(seat: TableSeat, amount: number) {
        const money = (seat.money ?? 0) + (seat.pendingMoney ?? 0);
        if (money < this._bigBlind! && !this.options.isRandomTable) {
            const newMoney = amount + money;

            if (newMoney < this.options.minBuyIn! &&  amount <= 0 ) {
                this.log(`Seat#${seat.index}(${seat.player?.name}): Player did buy-in below min. buyin: $${amount}, min-buy-in: $${this.options.minBuyIn}. Discarding buy-in.`);
                return 0;
            }
    
            if (this.options.maxBuyIn !== undefined && newMoney > this.options.maxBuyIn) {
                amount = floor4(this.options.maxBuyIn - money);
            }
        }

        if (seat.state == TableSeatState.Playing && seat.context.lastAction !== 'fold') {
            this.emit('message', seat, false, getErrorMessage("AddChips"));
            seat.pendingMoney = (seat.pendingMoney ?? 0) + amount;
            return amount;
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

        if (context.waitForBB !== value) {
            this.emit('waitforbb', seat, value);
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
            sidebetBB: this.options.bigBlind,
            isRandomTable:this.options.isRandomTable,
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
                
            //let ante = 0;
             if (res.missSB || res.sbAnte) {
                //ante += this.options.ante!;
                sum -= this.options.smallBlind;
            }
            if (res.missBB) {
                sum = this.options.bigBlind;
            }

            if (!res.emptySit && !res.sitOut) {
                start.seats.push({
                    index: res.sitIndex,
                    ante:this._ante,
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

    protected async onEnd() {
        this.getWaitingSeats().forEach(async seat => {
            seat.money = (seat.money || 0) + (seat.pendingMoney || 0);
            seat.pendingMoney = undefined;

            const player = seat.player as Player;
            const status = await player.autoTopUp();

            if (seat.money! < this.options.bigBlind!) {
                this.log(`Seat#${seat.index}(${seat.player?.name}): Player has insufficient money to play. money: $${seat.money}, Waiting buyin.`);
                
                if (player.hasSidebet(SideBetState.PreCards)) {
                    setTimeout(() => {
    
                        this.dealPlayerDeadCardByIndex(seat.index);
                        this.emit('missedsidebet', SideBetState.PreCards);
                        player.sidebetUnclaimed = true;
                    }, 2000);
                    
                    if (this.getPlayingSeats().length <= 1) {
                        setTimeout(() => this.emit('sidebetcheck', SideBetState.PreCards), 2500);
                    }
                }

                if (!status) {
                    if(this.options.isRandomTable && this.isWaitingEndroundRes)
                    {

                        await new Promise((resolve, reject) => {
                            player.room?.on('end_round_finished', resolve);
                        });
                    }
                   if(seat.state !== TableSeatState.Empty)                    
                    this.joining(seat); 
                }
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

    public getLeavePlayers() {
        return this.leavePlayers.map(leavePlayer => {return {user_token: leavePlayer}});
    }

    public getStayPlayers() {

        return this.getSeats()
            .filter(seat => seat.state !== TableSeatState.Empty && seat.money! > 0 && !this.leavePlayers.includes((seat.player as Player)?.id))
            // .map(seat => {return {user_id: (seat.player as Player)?.id, chips: seat.money}})
            .map(seat => {return {user_token: (seat.player as Player)?.id}})
    }

    public updateWaitList(players: Player[]) {
        this.emit('waitlist', players);
    }

    protected async insurance() {
        const getActivePlayers = this._context.getPlayingSeats().filter(seat => seat.fold !== true);
        const streetLog = this.getactionLogInfo().filter(action => action.action.includes('allin'));
        const allinPlayers = getActivePlayers.filter(seat => seat.lastAction == "allin").map(seat => seat.index);
    
        if (getActivePlayers.length == 2 && allinPlayers.length == 2 && streetLog.length == 2 && !this._insurance) {
            await this.CheckWinner();
            var insuranceDelay = false;
            var mainPort:number = 0;
            let  pots  = this.getSidePots();

            pots.forEach(pot => {
                const allinPlayrsInPot = pot.seats.filter(seat=>allinPlayers.includes(seat.index)).map(seat => seat.index);
                if(allinPlayrsInPot.length > 0)
                    mainPort += Number(pot.amount);
            });
            if(mainPort >= (this.bigBlind!*20))
            {
                this.getPlayingSeats().forEach(seat => {
                    this.log(`Seat#${seat.index}(${seat.player?.name}),lossPercentage:${seat.lossPercentage}, cards: ${seat.context.cards}}`);                       
                    
                    if (seat.lossPercentage !== undefined && seat.lossPercentage < 0.33 && seat.lossPercentage > 0) {
                        var insurancePrice = (mainPort * seat.lossPercentage * 1.05).toFixed(2);
                        this.log(`Seat#${seat.index}(${seat.player?.name}) (${mainPort} * ${seat.lossPercentage} * 1.05) = ${insurancePrice}`);
                        if(Number(insurancePrice) > 0){
                            insuranceDelay = true;
                            var opindex = allinPlayers.find(index => index  != seat.index);
                            var opPlayer = this.getSeatAt(opindex!);
                            var tablecards = this.getTableCards();

                            this.emit('insurance', { status: true, seatIndex: seat.index, data: { allInPrice:  mainPort, insurancePrice: insurancePrice, cards: seat.context.cards, percentage:(1 - seat.lossPercentage) * 100, opCards : opPlayer.context.cards, opPercentage: (1 - opPlayer.lossPercentage!) * 100, tableCards: tablecards } });
                        }
                        
                    }
                });
            }
            if (insuranceDelay) {
                this._insurance = true;
                await delay(1000 * 5);
                this.emit('insurance', { status: false, data: [] });
            }
        }
    }

    protected calculateRake(seats: TableSeat[], amount: number) {
        //if (seats.length === 1)
        //    return 0;

        if (this._context.checkOnePlayerRemaining()) {
            if (!this.options.rakePreFlop && this.preflopFold)
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

        return this.options.rakeRound ? round0(rake) : floor4(rake);
    }

    public checkTotalTableWallet(value?: number, rakeWithdraw?: number) {
        this._walletBalance = value || this._walletBalance;
        const tableChips = this._seats.map(seat => seat.money);
        const playerWallets = this._seats.map(seat => seat.player ? (seat.player as Player).tableBalance : 0);
        this._totalRake -= rakeWithdraw || 0;

        const tableWallet = this._totalRake + this._totalTip + [...tableChips, ...playerWallets].reduce((tableWallet: number, current: any) => tableWallet + (current || 0), 0);
        const status = Math.abs(floor4(this._walletBalance) - floor4(tableWallet)) < 0.001;
        this.log(`walletBalance : ${this._walletBalance} ,this._totalRake : ${this._totalRake},tableWallet: ${tableWallet},totalTip: ${this._totalTip},  = ${Math.abs(this._walletBalance - tableWallet)}`);
        if (status) {
            const usersBalance = this._seats.filter(seat => seat.player)
                                .map(seat => {
                                    const player = seat.player as Player;
                                    return {
                                        user: player.id,
                                        on_table: seat.money,
                                        on_poket: player.tableBalance
                                    }
                                });
            this._roundLog["users_balance"] = {
                table_balance: this._walletBalance,
                rake_balance: this._totalRake,
                users_balance: usersBalance
            };
        }

        return status;
    }
    
    protected setSideBetSitoutDeadCards(onlePlayer:boolean = false){
        let isPlayersHasSidebet = false;
        this.getAllPlayers().forEach(seat =>{
            const player =  (seat.player as Player);
            if((onlePlayer === true || seat.state !== TableSeatState.Playing) === true && player?.hasSidebet(SideBetState.PreCards))
            {
               this.dealPlayerDeadCardByIndex(seat.index);
               isPlayersHasSidebet = true;
            }
        });

        if(onlePlayer && isPlayersHasSidebet)
            this.updateCurrentState();

        if (this.options.sideBetOptions != undefined) {
            this.emit('sidebet', {street: 2, options: this.options.sideBetOptions![1]});
            this.emit('sidebetcheck', SideBetState.PreCards);
        }
    }

    public dealPlayerDeadCardByIndex(seatIndex:number){
        const seat = this.getSeatAt(seatIndex);
        this._context.dealPlayerDeadCardByIndex(seatIndex);
        seat.context.isDeadCards = true; 
        this.log(`Player(${seat.player?.name}) : Player get dead cards [${seat.context.cards?.join(",")}]`);
    }

    public removePlayerDeadCardByIndex(seatIndex:number){
        const seat = this.getSeatAt(seatIndex);
        seat.context.isDeadCards = false; 
    }
    
    protected async removeAllPlayersAndDeleteTable(){
        this.setSideBetSitoutDeadCards(true);
        await delay(1000 * 2);

        this.emit('closeTable', true);
        this.getSeats().forEach(seat => {
            this.leave(seat);
        });  

        await delay(1000 * 20);
        process.exit();

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
            const totalPlayers = this.table.getAllPlayers().filter(seat => ![TableSeatState.SitOut,TableSeatState.Joining].includes(seat.state)).length;
          //  console.log(`totalPlayers : ${totalPlayers}`);
           
            if(totalPlayers > 1 && this.table.submitErrorReport === false)
            {
                const lastActionTime = this.table.lastAction.lastActionTime.getTime();
                if(((new Date().getTime() - lastActionTime)/1000) > (2 * (this.table.options.timebankMax! + this.table.options.timeToReact!)))
                {
                    console.log(`date : ${new Date()},lastActionTime : ${this.table.lastAction}`);
                    console.log(`${((new Date().getTime() - lastActionTime)/1000)} > ${2 * (this.table.options.timebankMax! + this.table.options.timeToReact!)}`);
                    const reason = this.table.getErorrReportReason(this.room.options.mode!);
                    this.room.submitErrorReport(reason);
                    this.table.submitErrorReport = true;
                    this.table.emit('errorreport');
                } 
            }
        },1000);
		
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
            .on('tip', (tipInfo) => this.onPlayerTip(tipInfo));

            if(this.table?.options.isRandomTable || player.isWaitingPlayer)
                this.joinPlayerByMigrate(player);
    }

    private joinPlayerByMigrate(player: Player) {
        
        const seat = this.table.getEmptySeats()[0];
        if (!seat)
            return;
        
        this.sitDown(player, seat);
        if(player.migratePlayer || player.isWaitingPlayer)
        {
            this.log(`Player(${player.name}) buyin. chips: ${player.chips}`);
            if(player.chips > 1)
            this.table.buyIn(seat, player.chips);

            player.migratePlayer = false;
            player.isWaitingPlayer = false;
        }
        
    }

    private onPlayerJoinWaitlist(player: Player) {
        if (this.waitingListPlayers.length >= 6) 
            return;

        this.waitingListPlayers.push(player);
        this.table.updateWaitList(this.waitingListPlayers);
    }

    private onPlayerTip(tipInfo:{msg:string,seat:number}) {
        this.table.doBroadcastTip(tipInfo);
    }

    private onPlayerLeave(player: Player) {
        if (player.isSitIn)
            this.saveLastStatus(player);
        
        this.processWaitingListPlayers();
        player.isSitIn = false;
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
            player.sendMessage(false, `A mandatory ${Math.round(checkrejoininterval.RestOfTime / 1000)}-second delay applies before you can rejoin this game.`,{type:"RejoinInterval",RestOfTime:checkrejoininterval.RestOfTime});
            return;
        }

        if (player.cash < this.table.options.minBuyIn!) {
            player.sendMessage(false, `Not enough balance. Please deposit funds. Minimum buy-in for this table is ${this.table.options.minBuyIn}.`);
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

        this.table.lastAction ={actionType:"newPlayerJoin",seat:seatIndex,lastActionTime:new Date(new Date().getTime() + (120 * 1000))};
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
        this.table.lastAction ={actionType:"playerSitOut",seat:player.seat.index,lastActionTime:new Date()};

        this.table.sitOut(player.seat);
    }

    private onPlayerSitIn(player: Player) {
        if (!player.seat) {
            this.log(`Player(${player.name}) didn't sitdown. Discarding sitin.`);
            return;
        }
        this.table.lastAction ={actionType:"playerSitIn",seat:player.seat.index,lastActionTime:new Date()};
       
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
