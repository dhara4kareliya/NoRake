import { EventEmitter } from 'events';
import winston from 'winston';
import { round2 } from './math';
import { Room } from './room';
import { TablePlayer, TableSeat, TableSeatState } from './table';

export interface TourneyInfo {
    player_id: string,
    position: number,
    number: number
}

export enum PlayerState {
    Observing,
    Joining,
    SitOut,
    Waiting,
    Playing
}

export enum AutoTopUpCase {
    LessThanBuyIn,
    OutOfChips
}

export enum UserMode {
    Player,
    Observer
}

export enum SideBetState {
    None,
    PreCards,
    PreFlop,
    Flop,
    Turn,
    River
}

export abstract class Player extends EventEmitter implements TablePlayer {
    protected _id!: string;
    public get id() { return this._id; }

    protected _thread?: string;
    public get thread() {return this._thread;}

    protected _name!: string;
    public get name() { return this._name; }

    protected _avatar!: string;
    public get avatar() { return this._avatar; }

    protected _created_at!: string;
    public get created_at() { return this._created_at; }

    protected _globalBalance: number = 1000;
    public get globalBalance() { return this._globalBalance; }
    public set globalBalance(amount: number) {this._globalBalance = amount;}
    
    protected _tableBalance: number = 0;
    public get tableBalance() { return this._tableBalance; }
    public set tableBalance(amount: number) {this._tableBalance = amount;}
    
    protected _cash: number = 0;
    public get cash() { return this._globalBalance + this._tableBalance; }

    protected _chips: number = 0;
    public get chips() { return this._chips; }

    protected _mode: UserMode | undefined = undefined;
    public get mode() { return this._mode; }

    private _state: PlayerState = PlayerState.Observing;
    public get state() { return this._state; }

    private _room?: Room;
    public get room() { return this._room; }
    public get table() { return this._room?.table; }

    protected _seat?: TableSeat;
    public get seat() { return this._seat; }

    protected _topUpMoney?: number;
    public get topUpMoney() { return this._topUpMoney; }

    private _topUpCase?: AutoTopUpCase;
    public get topUpCase() { return this._topUpCase; }

    private _exitReason?: any;
    public get exitReason() { return this._exitReason; }

    private _leavePending?: boolean;
    public get leavePending() { return this._leavePending; }

    protected _sideBetState: SideBetState = SideBetState.None;
    public get sideBetState() { return this._sideBetState }
    public set sideBetState(state: SideBetState) { this._sideBetState = state; }

    protected constructor(protected readonly logger: winston.Logger) {
        super();
    }

    protected log(message?: any, ...optionalParams: any[]) {
        this.logger.debug(`Player(${this.name}): ${message}`, ...optionalParams);
    }

    public start(room: Room) {
        this._room = room;

        this.updateState();

        this.log(`Start in room(${room.id})`);

        this.onStart();
    }

    protected onStart() {}

    public leave(reason?: any) {
        this._exitReason = reason;

        if (!!reason && reason.type == 'migrate') {
            
            this.table!.leave(this._seat!);
            this.end();
        }
        else {
            if (!this._seat)
                this.end();
            else
                this.table!.leave(this._seat);
        }
    }

    private _onTableLeave = (seat: TableSeat, pendLeave: boolean) => {
        if (seat === this._seat) {
            this._chips = seat.money ?? 0;

            if (this._exitReason === undefined) {
                this._exitReason = { type: 'table' };
            }
            this.leaveTable(pendLeave);
            if (this.room?.options.mode === 'tournament') {
                this.end();
            }
        }
    };

    public completeLeavePending() {
        this.emit('leave');

        this._seat = undefined;
        this._tableBalance = 0;
        this._leavePending = false;
    }

    private leaveTable(pendLeave: boolean) {

        this._state = PlayerState.Observing;
        this._leavePending = pendLeave;

        this.updateState();
        
        if (!!this.table) {
            this.table
                .off('leave', this._onTableLeave)
                .off('sitdown', this._onTableSitDown)
                .off('seat', this._onTableSeat)
                .off('end', this._onTableRoundEnd);
            }
    }

    private end() {
        this.onLeave();
        this.emit('leaveroom');

        this._seat = undefined;

        if (!!this.table) {
            this.table
                .off('leave', this._onTableLeave)
                .off('sitdown', this._onTableSitDown)
                .off('seat', this._onTableSeat)
                .off('end', this._onTableRoundEnd);
            }

        this.log(`Destroyed.`);
    }

    protected async onLeave() {}

    private _onTableSitDown = (seat: TableSeat) => {
        if (seat.player === this) {
            this._seat = seat;
            this.onSitDown();
        }
    };

    protected onSitDown() {}

    private _onTableSeat = (seat: TableSeat) => {
        if (seat === this._seat) {
            this.updateState();
        }
    };

    private updateState() {
        switch (this._seat?.state) {
            case TableSeatState.SitOut:
                this._state = PlayerState.SitOut;
                break;
            case TableSeatState.Waiting:
                this._state = PlayerState.Waiting;
                break;
            case TableSeatState.Playing:
                this._state = PlayerState.Playing;
                break;
            case TableSeatState.Joining:
                this._state = PlayerState.Joining;
                break;
            default:
                this._state = PlayerState.Observing;
                break;
        }

        this.onState();

        this.emit('state', this._state);
    }

    public onTourneyInfo(data: any) {}

    public updateFreeBalance(balance: number) {}

    public setBuyInPanelVisible(minBuyIn: number) {}

    public sendMessage(status: false, msg: string, data?: any) {}

    protected onState() {}

    public online() {
        this.emit('online');
    }

    public offline() {
        this.emit('offline');
    }

    public sitOut() {
        this.emit('sitout');
    }

    public sitIn() {
        this.emit('sitin');
    }

    public sitDown(seatIndex: number) {
        this.addTableListener();

        this.emit('sitdown', seatIndex);
    }

    public addTableListener() {
        this.table!
            .on('leave', this._onTableLeave)
            .on('sitdown', this._onTableSitDown)
            .on('seat', this._onTableSeat)
            .on('end', this._onTableRoundEnd);
    }

    public async buyIn(amount: number) {
        const tableMoney = (this._seat?.money ?? 0) + amount;
        if (tableMoney > this._room?.options.maxBuyIn! 
            || this._tableBalance < this._room?.options.minBuyIn! 
            || (this._seat?.context.bet ?? 0) > this._room?.table.bigBlind! + (this._room?.table.ante ?? 0)) {
            return false;
        }

        if (!await this.deposit(amount))
            return false;

        this.emit('buyin', amount);
        return true;
    }

    public async deposit(amount: number) {
        if (this._tableBalance < amount)
            return false;
        this._tableBalance -= amount;
        return true;
    }

    public setTopUp(top?: number) {
        this._topUpMoney = top;
    }

    public setTopUpCase(topUpCase?: AutoTopUpCase) {
        this._topUpCase = topUpCase;
    }

    protected _onTableRoundEnd = () => {
        if (!!this._seat) {
            this.autoTopUp();
            
            // if (this._exitReason !== undefined) {
            //     if (this._exitReason.type == 'migrate') {
            //         this.table!.leave(this._seat!);
            //         this.end();
            //     }
            // }
        }
    };

    protected async autoTopUp() {
        const top = this._topUpMoney ?? 0;
        if (top === 0)
            return;

        const money = (this._seat?.money ?? 0);
        if (this._topUpCase == AutoTopUpCase.LessThanBuyIn && money >= top)
            return;

        if (this._topUpCase == AutoTopUpCase.OutOfChips && money >= this._room?.table.bigBlind!)
            return;

        const amount = round2(top - money);
        this.buyIn(amount);
    }

    public action(action: string, bet?: number) {
        this.emit('action', action, bet);
    }

    public showCards() {
        this.emit('showcards');
    }
}
