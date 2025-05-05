import { setTimeout as setTimeoutAsync } from 'timers/promises';
import { randomChoice, randomElement, randomInRange, shuffle } from './random';
import { Player, PlayerState, SideBetState } from './player';
import { Table, TableSeatState } from "./table";
import { Room } from './room';
import { PlayerInfo } from '../services/game';
import { round0, floor4,floor2 } from './math';
import winston from 'winston';
import { dealMe, hit } from './sideGame';
import { RoundState } from './round';
import { generateHashAndServerString,verifyJSONFromServer } from '../services/utils';
import { Card } from './card';

export class BotPlayer extends Player {
    
    private _allHashes?:string;
    private _randomString?:string;
    private _hash?:string;

    constructor(logger: winston.Logger, thread: string, info?: any) {
        super(logger);
        this._thread = thread;
        if (!!info)
            this.setInfo(info);
    }

    private setInfo(info: any) {
        this._name = info.name;
        this._avatar = info.avatar;
        this._country = info.country;
        this._cash = info.cash;
        this._chips = info.chips;
        this._id = info.token;
        this._joiningDate = info.joiningDate;
        this._rating = info.rating;
        this._freeBalance = info.free_balance;
        this._migratePlayer = info.isMigratePlayer;
        this._isWaitingPlayer = info.isWaitingPlayer;
        if(info.tableBalance !== undefined && info.tableBalance > 0)
            this._tableBalance = info.tableBalance;

        this.log(`Bot(${this._name}): cash: ${this._cash}, chips: ${this._chips}, token: ${this._id}`);
    }

    protected onStart() {
        this.listenTable();
    }

    protected async onLeave() {
        this.unlistenTable();
    }

    protected async onState() {
        if (this.room?.options.mode === 'tournament')
            return;

        if(this.room?.options.mode === "cash" && this._migratePlayer && this._isWaitingPlayer && this.table?.options.isRandomTable && this.chips > 1)
            return;

        if (this.state == PlayerState.Joining) {
            if (!await this.botBuyIn()) {
                this.leave();
                return;
            }
        
            if (!randomChoice(2))
                this.setTopUp(this.seat?.money);
    
            if (!randomChoice(2))
                this.emit('waitforbb', false);
    
        }
    }

    private listenTable() {
        this.table!
            .on('turn', this.onRoundTurn)
            .on('cancel_bet', this.onCancelBet)
            .on('result', this.onRoundResult);
    }

    private unlistenTable() {
        this.table!
            .off('turn', this.onRoundTurn)
	    .off('cancel_bet', this.onCancelBet)
            .off('result', this.onRoundResult);
    }

    public async trySitDown(seatIndex?: number) {
        this.log(`Trying sitdown. seat:${seatIndex}`);
        const seat = this.findSeat(seatIndex);
        if (!seat) {
            this.log(`No seat: ${seatIndex}`);
            return false;
        }

        this.sitDown(seat.index);
        this.log(`SitDown: seat: ${seat.index}`);
        
        // if (!await this.botBuyIn()) {
        //     this.leave();
        //     return;
        // }
        
        if (!randomChoice(2))
            this.setTopUp(this.seat?.money);

        if (!randomChoice(2))
            this.emit('waitforbb', false);

        return true;
    }

    private async botBuyIn() {
        let buyInAmount = 0 as number;
        
        if (this.room?.options.mode === 'cash') {
            buyInAmount = floor2(randomInRange(this.room.options.minBuyIn!, this.room.options.maxBuyIn!));
        }

        if (buyInAmount > this.tableBalance) {
            const {status, transferedAmount, updatedGlobalBalance} = await this.room!.game.transferBalance(this.room!.id, this._id, buyInAmount - this.tableBalance + 10)
            if(!status)
            {
                this.log(`Transfer Balance Failed: amount: ${buyInAmount - this.tableBalance + 10}`);
                return status;
            }
            
            this.tableBalance = this.tableBalance + transferedAmount;
            this.globalBalance = updatedGlobalBalance;
        }
        
        const success = await this.buyIn(buyInAmount);
        if (success)
            this.log(`BuyIn: amount: ${buyInAmount}`);
        else 
            this.log(`BuyIn Failed: amount: ${buyInAmount}`);

        return success;
    }

    private findSeat(seatIndex?: number) {
        seatIndex ??= randomElement(this.table!.getEmptySeats().map(seat => seat.index));
        if (seatIndex === undefined)
            return;

        const seat = this.table!.getSeatAt(seatIndex);
        if (!seat || seat.state !== TableSeatState.Empty)
            return;
        return seat;
    }

    public async deposit(amount: number) {
        const playerCash = await this.room!.game.deposit(this.room!.id, this._id, amount, this.table!.round);
        if (playerCash === undefined)
            return false;

        this.tableBalance -=  amount;
        return true;
    }

    protected _onTableRoundEnd = async () => {
        if (this.room?.options.mode === 'tournament') return;
        if (!this._seat) return;

    };

    protected _onTableRoundState = (state: RoundState) => {
        if (!this.table?.options.sideGameEnabled || this.table.options.lowActionEnabled) return;

        if ((this._seat?.state === TableSeatState.Playing && (this._seat.context.fold || false)) || this._seat?.state === TableSeatState.SitOut || this._seat?.state === TableSeatState.Waiting) {
            if (randomChoice(30) < 1) {
                this.hitGame01();
            }

            if (randomChoice(30) < 1) {
                this.dealGame02();
            }
        }
    };

    protected onSideBetOptions(street?: SideBetState, options?: ({betName: string, ratio: number, note: string} | null)[]) {
        if (!this.table?.options.sideBetEnabled || this.table.options.lowActionEnabled) return;

        if (this._seat?.state === TableSeatState.Playing && !(this._seat.context.fold || false)) {
            const bigBlind = this.table?.bigBlind!;
            const betAmounts = [bigBlind * 2, bigBlind * 5, bigBlind * 10];
            const sidebets = [] as {betName: string, amount: string}[];

            let accuredAmount = 0;
            let sidebetDone = false;
            if (randomChoice(30) < 1)
                options?.forEach(option => {
                    if (randomChoice(3) < 1) {
                        const index = randomChoice(3);
                        const betAmount = (shuffle(betAmounts))[index];
                        accuredAmount += betAmount;
                        if (this._freeBalance >= accuredAmount) {
                            sidebetDone = true;
                            sidebets.push({
                                betName: option?.betName!,
                                amount: betAmount.toString()
                            });
                        }
                    }
                });

            if (sidebetDone) {
                this.submitSidebet(Number(street), sidebets);
            }
        }
    }

    protected _onInsurance = (data: { status: boolean, seatIndex: number, data: any }) => {
        
        if(this.table?.options.lowActionEnabled || !data.status || data.seatIndex !== this.seat?.index || randomChoice(2) === 0 )
            return;
        
        const insuranceAmount =  Number(data.data.insurancePrice);
        const insuranceWinAmount = Number(data.data.allInPrice);
        this.submitInsurance(insuranceAmount,insuranceWinAmount);
    }

    public onGenerateHashAndRandomString = () =>{
        const {randomString,hash} = generateHashAndServerString();
       
        this._randomString = randomString;
        this._hash = hash;
        this.table?.setPlayerHash(this.seat!,hash);
        this.emit('get_player_hash');
    };

    public onGetPlayerRandomString = () =>{
        this.table?.setPlayerRandomString(this.seat!,this._randomString!);
        this.emit('get_player_random_string');
        
    };

    protected _onSendAllHashesToPlayers = (hashes:string) => {
        this._allHashes = hashes;

        
    };

    protected _onVerifyJsonString = (data:{jsonString:string,seed:string,pfCount:number,commonCards:Card[]}) => {
        const { status, message,players } = verifyJSONFromServer(data.jsonString);

        if(!status)
        {
                for (let index = 0; index < players.length; index++) {
                    const player = players[index];
                    if(player === "server")
                        continue;
                    
                    this.table?.setWrongHashPlayers(player);
                }
        } 
        this.log(message);
    };

    private async hitGame01() {
        const betSizes = [1, 2, 4];
        const index = randomChoice(3);
        let ratio = betSizes[index];
        let bigBlind = (this.table?.bigBlind || 0);
        if(this.room?.options.mode === "tournament")
        {
            bigBlind = 1;
            ratio = ratio * 1;
        }
        const {status, betId, freeBalance} = await this.room!.game.submitSideGame(this.room!.id, this._id, ratio * bigBlind, 'game01',this.room?.options.mode,this.room?.options.tournament_id);
        
        if (!status) {
            return;
        }

        const hitResult = hit();
        const data = {
            status: true,
            ...hitResult,
            winningRatioBB: hitResult.winningOdd * ratio
        };

        if (data.winningRatioBB > 0) {
            const response = await this.room!.game.submitSideGameResult(this.room!.id, this._id, betId, data.winningRatioBB * bigBlind, this.table!.round,this.room?.options.mode,this.room?.options.tournament_id);
        }
    }

    private async dealGame02() {
        const betSizes = [2, 4, 8];
        const index = randomChoice(3);
        let ratio = betSizes[index];
        let bigBlind = (this.table?.bigBlind || 0);
        if(this.room?.options.mode === "tournament")
        {
            bigBlind = 1;
            ratio = ratio * 1;
        }
        const {status, betId, freeBalance} = await this.room!.game.submitSideGame(this.room!.id, this._id, ratio * bigBlind, 'game02',this.room?.options.mode,this.room?.options.tournament_id);
        
        if (!status) {
            return;
        }
        const dealResult = dealMe();
        const data = {
            status: true,
            ...dealResult,
            winningRatioBB: dealResult.winningOdd * ratio / 2
        };

        if (data.winningRatioBB > 0) {
            const response = await this.room!.game.submitSideGameResult(this.room!.id, this._id, betId, data.winningRatioBB * bigBlind, this.table!.round,this.room?.options.mode,this.room?.options.tournament_id);
        }
    }

    public async autoTopUp() {
        const top = this._topUpMoney ?? 0;
        if (top === 0)
            return false;

        const money = (this._seat?.money ?? 0);
        const randomValue = randomInRange(1, top);

        if (randomChoice(10) < 3 && money < top) {}
        else if (money < randomValue) {}
        else return false;
        
        const amount = floor4(top - money);

        if (this.tableBalance < amount) 
            return false;
    
        return this.buyIn(amount);
    }


    private onRoundTurn = (turn: number) => {
        if (turn === undefined || turn !== this.seat?.index)
            return;

        this.ai();
    }
    private onCancelBet = (seat: any) => {
        if (seat === undefined || seat.index !== this.seat?.index)
            return;

        this.ai();
    }

    private async ai() {
        const context = this.table!.getTurnContext();

        const thinkTime = randomInRange(1, 4) * 1000;
        await setTimeoutAsync(thinkTime);

        if (!context.canRaise || randomChoice(10) > 3) {
            this.log(`AI: Call`);
            return this.action('bet', context.call);
        }
        
        if (randomChoice(100) < 50 && !this.table?.options.lowActionEnabled) {
            const mult = Math.floor(Math.random() * 3) + 1;
            const [min, max] = context.raise!;
            let raise = min + Math.floor((max-min) * Math.random());

            const random = randomChoice(100);

            if (random < 2) {
                raise = max;
            }
            else if (random < 100) {
                raise = min;
            }
                
            this.log(`AI: Raise: ${raise}`);
            return this.action('bet', raise);
        }

        if (!context.call) {
            this.log(`AI: Check`);
            return this.action('bet', context.call);
        }

        this.log(`AI: Fold`);
        return this.action('fold');
    }
    
    private onRoundResult = () => {
        if (!this.seat || !this.seat.prize)
            return;

        if (!randomChoice(2)) {
            this.log(`AI: ShowCards`);
            this.table!.showCards(this.seat);
        }
    }
}

export interface BotManagerOptions {
    initialCount?: number|[number, number]; 
    addInterval?: number|[number, number];
    addCount?: number|[number, number];
}

export class BotManager {
    private nextId: number = 0;

    public constructor(public readonly room: Room, public readonly options: BotManagerOptions, private readonly logger: winston.Logger) {
        this.options.initialCount ??= 0;
        this.options.addInterval ??= 0;
        this.options.addCount ??= 0;
    }
    
    public async start() {
        const count = this.options.initialCount instanceof Array ? Math.floor(randomInRange(this.options.initialCount[0], this.options.initialCount[1])) : this.options.initialCount!;
        for (let i = 0; i < count; ++i) {
            if (!await this.add())
                break;
        }

        if (this.options.addInterval === 0 || this.options.addCount === 0)
            return;

        while (true) {
            const timeout = this.options.addInterval instanceof Array ? randomInRange(this.options.addInterval[0], this.options.addInterval[1]) * 1000 : this.options.addInterval! * 1000;
            await setTimeoutAsync(timeout);

            const count = this.options.addCount instanceof Array ? Math.floor(randomInRange(this.options.addCount[0], this.options.addCount[1])) : this.options.addCount!;
            for (let i = 0; i < count; ++i) {
                if (!await this.add())
                    break;
            }
        }
    }

    public async add(seat?: number) {
        const token = `BOT${this.nextId}`;
        this.nextId++;

        const info = await this.room.game.getUser(token, this.room.id, true);
        if (!info)
            return;

        const bot = new BotPlayer(this.logger, token, info);
        if (!this.room.join(bot))
            return;

        if (bot.seat)
            return bot;

        if (!bot.trySitDown(seat)) {
            bot.leave();
            return;
        }

        return bot;
    }

    public async addBot(threadToken : string) {

        const info = await this.room.game.getUser(threadToken, this.room.id, true);
        if (!info)
            return;

        const bot = new BotPlayer(this.logger, threadToken, info);
        if (!this.room.join(bot))
            return;

        if (bot.seat)
            return bot;

        // if (!bot.trySitDown()) {
        //     bot.leave();
        //     return;
        // }

        return bot;
    }

    public addBotsByList(info: any) {
        const {t, ...other} = info

        const bot = new BotPlayer(this.logger, t, {...info, cash: info.main_balance});
        if (!this.room.join(bot))
            return;

        if (bot.seat)
            return bot;

        if (this.room.options.mode === 'cash') {
            if (!bot.trySitDown()) {
                bot.leave();
                return;
            }
        }

        return bot;
    }
}
