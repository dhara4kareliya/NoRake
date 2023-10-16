import { setTimeout as setTimeoutAsync } from 'timers/promises';
import { randomChoice, randomElement, randomInRange } from './random';
import { Player, PlayerState } from './player';
import { TableSeatState } from "./table";
import { Room } from './room';
import { PlayerInfo } from '../services/game';
import { round0, round2 } from './math';
import winston from 'winston';
import moment from 'moment';
import { random } from 'lodash';
export class BotPlayer extends Player {
    constructor(logger: winston.Logger, thread: string, info?: PlayerInfo) {
        super(logger);
        this._thread = thread;
        if (!!info)
            this.setInfo(info);
    }

    private setInfo(info: PlayerInfo) {
        this._name = info.name;
        this._avatar = info.avatar;
        this._cash = info.cash;
        this._chips = info.chips;
        this._id = info.token;
        this._created_at = info.created_at;

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
            .on('result', this.onRoundResult);
    }

    private unlistenTable() {
        this.table!
            .off('turn', this.onRoundTurn)
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
            buyInAmount = round0(randomInRange(this.room.options.minBuyIn!, this.room.options.maxBuyIn!));
        }

        if (buyInAmount > this.tableBalance) {
            const {status, transferedAmount, updatedGlobalBalance} = await this.room!.game.transferBalance(this.room!.id, this._id, buyInAmount - this.tableBalance + 10)
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

        return true;
    }

    protected _onTableRoundEnd = () => {
        if (this.room?.options.mode === 'tournament') return;
        if (!this._seat) return;

        this.autoTopUp();
    };

    protected async autoTopUp() {
        const top = this._topUpMoney ?? 0;
        if (top === 0)
            return;

        const money = (this._seat?.money ?? 0);
        const randomValue = randomInRange(1, top);

        if (randomChoice(10) < 3 && money < top) {}
        else if (money < randomValue) {}
        else return;
        
        const amount = round2(top - money);
        this.buyIn(amount);
    }


    private onRoundTurn = (turn: number) => {
        if (turn === undefined || turn !== this.seat?.index)
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

        if (randomChoice(10) < 3) {
            const mult = Math.floor(Math.random() * 3) + 1;
            const [min, max] = context.raise!;
            let raise = min + Math.floor((max-min) * Math.random());

            const random = randomChoice(10);
            if (random >= 1) {
                raise = min;
            }
            else if (random < 0.025) {
                raise = max;
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
