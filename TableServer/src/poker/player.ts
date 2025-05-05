import { EventEmitter } from 'events';
import winston from 'winston';
import { floor4 } from './math';
import { Room } from './room';
import { SideBetOptions, SideBetResult, TablePlayer, TableSeat, TableSeatState } from './table';
import { evaluateSideBet } from './sidebet';
import { RoundState } from './round';
import {  delay } from '../services/utils';
import { Card } from './card';


export interface TourneyInfo {
    biggestStack:string,
    averageStack:string,
    players:playerPosition[]
}

export interface playerPosition
{
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

export interface SideBetStatus {
    street: SideBetState,
    streetName: String,
    bets: {id: string, betName: string, ratio: number, amount: number, enoughBalance: boolean}[]
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

    protected _country!: string;
    public get country() { return this._country; }

    protected _joiningDate!: string;
    public get joiningDate() { return this._joiningDate; }

    protected _rating!:string;
    public get rating(){return this._rating;}

    protected _globalBalance: number = 1000;
    public get globalBalance() { return this._globalBalance; }
    public set globalBalance(amount: number) {this._globalBalance = amount;}
    
    protected _tableBalance: number = 0;
    public get tableBalance() { return this._tableBalance; }
    public set tableBalance(amount: number) {this._tableBalance = amount;}

    protected _freeBalance: number = 0;
    public get freeBalance() { return this._freeBalance; }
    
    protected _cash: number = 0;
    public get cash() { return this._globalBalance + this._tableBalance; }

    protected _chips: number = 0;
    public get chips() { return this._chips; }

    protected _migratePlayer:boolean = false;
    public get migratePlayer() { return this._migratePlayer; }
    public set migratePlayer(status:boolean) { this._migratePlayer = status; }

    protected _isWaitingPlayer:boolean = false;
    public get isWaitingPlayer() { return this._isWaitingPlayer; }
    public set isWaitingPlayer(status:boolean) { this._isWaitingPlayer = status; }

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

    private _kickByAdmin?:boolean;
    public get kikckByAdmin(){return this._kickByAdmin;}

    protected _currentSideBets?: SideBetStatus[];
    public get currentSideBets() { return this._currentSideBets; }
    public set currentSideBets(info: SideBetStatus[] | undefined) { this._currentSideBets = info; }

    protected _cancelSideBet:any[] = [];

    protected _isSitIn?: boolean;
    public get isSitIn() { return this._isSitIn; }
    public set isSitIn(value: boolean | undefined) { this._isSitIn = value; }

    protected _sidebetUnclaimed: boolean = false;
    public get sidebetUnclaimed() {return this._sidebetUnclaimed;}
    public set sidebetUnclaimed(value: boolean) { this._sidebetUnclaimed = value; }

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

    public async leave(reason?: any) {
        this._exitReason = reason;

        if (!!reason && reason.type == 'migrate') {
            
            this.table!.leave(this._seat!);
            this.end();
        }
        else {
            if (!this._seat)
                this.end();
            else
            {
                if(!!reason && reason.type == 'kick' && this.room?.options.mode === "cash")
                    this._kickByAdmin = true;

  
                if(this.room?.options.mode === "cash" && this.hasSidebet(SideBetState.PreCards))
                {
                   await this.dealDeadCard();
                }
                this.table!.leave(this._seat);
                if(reason && reason.type == 'timeout')  
                    this.onLeave();
            }
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
        this._kickByAdmin = false;

        if(this._exitReason && this._exitReason.type === 'timeout')
            this.leave();
    }

    private leaveTable(pendLeave: boolean) {

        this._state = PlayerState.Observing;
        if (this._isSitIn)
            this._leavePending = pendLeave;

        this.updateState();
        
        if (!!this.table) {
            this.table
                .off('leave', this._onTableLeave)
                .off('sitdown', this._onTableSitDown)
                .off('seat', this._onTableSeat)
                .off('state', this._onTableRoundState)
                .off('end', this._onTableRoundEnd)
                .off('sidebet', this._onSideBetOptions)
                .off('insurance', this._onInsurance)
                .off('sendAllHashesToPlayers',this._onSendAllHashesToPlayers)
                .off('verifyJsonString',this._onVerifyJsonString)
                .off('sidebetcheck', this._onTableSideBetEvaluate);
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
                .off('state', this._onTableRoundState)
                .off('end', this._onTableRoundEnd)
                .off('sidebet', this._onSideBetOptions)
                .off('insurance', this._onInsurance)
                .off('sendAllHashesToPlayers',this._onSendAllHashesToPlayers)
                .off('verifyJsonString',this._onVerifyJsonString)
                .off('sidebetcheck', this._onTableSideBetEvaluate);
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

    public onTourneyInfo(data: any,averageStack:string,biggestStack:string) {}

    public updateFreeBalance(balance: number) {
        this._freeBalance = balance;
    }

    public setBuyInPanelVisible(minBuyIn: number) {}

    public sendMessage(status: false, msg: string, data?: any) {}

    protected onState() {}

    public online() {
        this.emit('online');
    }

    public offline() {
        if (this.mode === UserMode.Observer) {
            this.leave();
        }
        else {
            this.emit('offline');
        }
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
            .on('end', this._onTableRoundEnd)
            .on('state', this._onTableRoundState)
            .on('sidebet', this._onSideBetOptions)
            .on('insurance', this._onInsurance)
            .on('sendAllHashesToPlayers',this._onSendAllHashesToPlayers)
            .on('verifyJsonString',this._onVerifyJsonString)
            .on('sidebetcheck', this._onTableSideBetEvaluate);
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

    protected _onTableRoundState = (state: RoundState) => {
    };

    protected _onTableRoundEnd = async () => {
        if (!!this._seat) {
            
            // if (this._exitReason !== undefined) {
            //     if (this._exitReason.type == 'migrate') {
            //         this.table!.leave(this._seat!);
            //         this.end();
            //     }
            // }
        }
    };

    protected _onInsurance = (data: { status: boolean, seatIndex: number, data: any }) => {

    };

    public onGenerateHashAndRandomString = () => {};

    public onGetPlayerRandomString = () => {};

    protected _onSendAllHashesToPlayers = (hashes:string) => {};

    protected _onVerifyJsonString = (data:{jsonString:string,seed:string,pfCount:number,commonCards:Card[]}) => {};

    private _onSideBetOptions = (data: {street: number, options: SideBetOptions[]}) => {
        if (this.seat?.state !== TableSeatState.Playing || (this.room?.options.mode == 'tournament' && data.street == SideBetState.PreCards) || (this.room?.options.mode == 'cash' && this.table?.options.isRandomTable && data.street == SideBetState.PreCards)) {
            this.onSideBetOptions();
            return;
        }

        const tableCards = this.table?.getTableCards();
        const handCards = this.table?.getSeats()
            .find(seat => seat.index === this.seat?.index)
            ?.context.cards;

        const filteredOptions = data.options?.map(option => {
            const odds = option.odds.filter(odd => odd.selector(handCards, tableCards));
            if (odds.length > 0) {
                return {
                    betName: option.betName,
                    ratio: odds[0].value,
                    note: option.note
                };
            }

            return null;
        }).filter(option => option !== null);

        this.onSideBetOptions(data.street, filteredOptions);
    }

    public hasSidebet(state: SideBetState) {
        const sidebet = this._currentSideBets?.find(sidebet => sidebet.street === state);
        return !!sidebet;
    }

    private _onTableSideBetEvaluate = async (state: SideBetState) => {
        if ((this.room?.options.mode == 'tournament' || (this.room?.options.mode == 'cash' && this.table?.options.isRandomTable))  && state == SideBetState.PreCards) {
            return;
        }

        const evaluatedSidebet = this._currentSideBets?.find(sidebet => sidebet.street === state);

        if (!evaluatedSidebet) {
            return false;
        }

        const sideBets = evaluatedSidebet.bets;
        const tableCards = this.table?.getTableCards() || [];
        const handCards = this.table?.getSeats()
            .find(seat => seat.index === this.seat?.index)
            ?.context.cards || [];
        this.log(`Side Bet Hand Cards: ${handCards.join(',')} -- Table Cards: ${tableCards.join(',')}`);
        let totalReward = 0;
        let sidebetResults = [];
        let winSideBets = [];
        let loseSideBets = [];

        for (let i = 0; i < sideBets.length; ++i) {
            const isWin = evaluateSideBet(SideBetState[evaluatedSidebet.street], sideBets[i].betName, handCards, tableCards);

            let winAmount = 0;
            if (isWin) {
                //winAmount = (sideBets[i].ratio! - 1) * sideBets[i].amount;
                winAmount = (sideBets[i].ratio!) * sideBets[i].amount;
                totalReward += winAmount;
                winSideBets.push({
                    winAmount,
                    betID:sideBets[i].id,
                });
                this.log(`Side Bet Result: Win (Bet Name:${sideBets[i].betName}, Awards: ${winAmount}, Ratio: ${sideBets[i].ratio})`);
            }
            else {
                loseSideBets.push(sideBets[i].id);
                this.log(`Side Bet Result: Lose (Bet Name:${sideBets[i].betName})`);
            }
            
            const sideBetResult = { betName: sideBets[i].betName,streetName: evaluatedSidebet.streetName, award: winAmount, timestamp: new Date()};
            sidebetResults.push(sideBetResult);

          
            if (winAmount > 0) {
                this.table?.setSideBetHistory(this.id, sideBetResult);

               const logData = {
                    'user_token': this._id,
                    'bet_id': sideBets[i].id,
                    'amount': String(winAmount),
                }
                this.table?.logSideBet(false, logData);
                
            }
        }

        const cancelBetAmount = this._cancelSideBet.reduce((accumulator, currentValue) => accumulator + currentValue.amount,0,);
        const data = await this.room?.game.submitSidebetResult(this.room!.id, this._id, String(totalReward + cancelBetAmount),winSideBets,loseSideBets,this._cancelSideBet, this.table?.round!, tableCards.join(' '), handCards.join(' '),this.room?.options.mode,this.room?.options.tournament_id);
        if (data?.status) {
            this.updateFreeBalance(Number(data?.freeBalance));
            this._cancelSideBet = [];
        }    
           

        this.onTableSideBetEvaluate(totalReward, this.table?.getSideBetHistory(this.id), sidebetResults);

        this._currentSideBets = this._currentSideBets?.filter(sidebet => sidebet.street !== evaluatedSidebet.street);

        if(state === SideBetState.PreCards && this._seat?.context.isDeadCards === true)
             this.table?.removePlayerDeadCardByIndex(this._seat!.index); 
    }

    protected onSideBetOptions(street?: SideBetState, options?: ({betName: string, ratio: number, note: string} | null)[]) {
    }

    protected onTableSideBetEvaluate(reward: number, historyLists?: SideBetResult[], results?: SideBetResult[]) {
    }

    protected async submitSidebet(street: number, sidebets: {betName: string, amount: string}[],isHolePreCards?:boolean) {
        if (this.hasSidebet(street) || sidebets.length === 0) return;

        let updatedSidebets = [];
        let sideBets:any[] = [];
        let totalSideBetAmount = 0;
        const tableCards = this.table?.getTableCards();
        const handCards = this.table?.getSeats()
            .find(seat => seat.index === this.seat?.index)
            ?.context.cards;

        let sidebetCount =  this._currentSideBets?.reduce((count, sideBets) => sideBets.bets.length + count, 0) ?? 0;
    
        for (let i = 0; i < sidebets.length; ++i) {
            if(sidebetCount >= 7)
                break;

            const sideBetOptions = this.table?.options.sideBetOptions![street - 1];
            const sideBetName = sidebets[i].betName;
            const sideBetAmount = sidebets[i].amount;
            const ratio = sideBetOptions?.find(option => option.betName === sideBetName)?.odds.
                find(odd => odd.selector(handCards, tableCards))?.value!;

                sideBets.push({
                    sideBetName,
                    sideBetAmount,
                    ratio
                });
                totalSideBetAmount += Number(sideBetAmount);
             sidebetCount++;
        }

        if(sideBets.length <= 0 || totalSideBetAmount <= 0) return;

        const {status,isCancel, sideBetsInfo, freeBalance} = await new Promise<{status:boolean,isCancel:boolean,sideBetsInfo?:any,freeBalance?:number}>(async(resolve, reject)=>{
            const setimeOutid = setTimeout(()=>{
                this.logger.error(`Side bet has been cancelled due to waiting for response`);
                resolve({status:false,isCancel:true});
            },3000);
            
            const data = await this.room!.game.submitSidebet(this.room!.id, this._id, totalSideBetAmount,sideBets,SideBetState[street], this.table?.round!, this.table?.bigBlind!, (tableCards || []).join(' '), (handCards || []).join(' '), this.room?.options.mode === 'cash',this.room?.options.mode,this.room?.options.tournament_id);
           if(!!setimeOutid)
            clearTimeout(setimeOutid);

            resolve({...data,isCancel:false});
        });

        if(!status)
        {
            if(isCancel)
            {
                this._cancelSideBet.push({amount:totalSideBetAmount,sideBets:sideBets,street:SideBetState[street],roundId:this.table?.round});
                if(!this._currentSideBets || this._currentSideBets.length <= 0)
                {
                    const data = await this.room?.game.submitSidebetResult(this.room!.id, this._id, String(totalSideBetAmount),[],[],this._cancelSideBet, this.table?.round!, '','',this.room?.options.mode,this.room?.options.tournament_id);
                    if(data?.status)
                    {
                        this.updateFreeBalance(Number(data?.freeBalance));
                        this._cancelSideBet = [];
                    }
                }
            }
            return;
        }
            

        for (let index = 0; index < sideBetsInfo.length; index++) {
            const sideBet = sideBetsInfo[index];
            const logData = {
                'user_token': this._id,
                'bet_id': sideBet.betId,
                'bet_name': sideBet.sideBetName,
                'bet_street': SideBetState[street],
                'amount': sideBet.sideBetAmount,
                'odds': sideBet.ratio,
            }

            this.table?.logSideBet(true, logData);
            updatedSidebets.push({id: sideBet.betId, betName: sideBet.sideBetName, ratio: sideBet.ratio, amount: Number(sideBet.sideBetAmount), enoughBalance: status});
        }

        this.updateFreeBalance(Number(freeBalance));
        const streetName = (isHolePreCards === true) ? "HolePreCards" : SideBetState[street];
        if (this._currentSideBets !== undefined) {
            this._currentSideBets.push({ street: street,streetName,bets: updatedSidebets });
        }
        else {
            this._currentSideBets = [{ street: street,streetName: streetName, bets: updatedSidebets }];
        }

        if(street === SideBetState.PreCards && this._seat?.state === TableSeatState.Playing && (this.seat?.context.fold ?? false))
        {
            this.dealDeadCard();
        }
    }

    protected async submitInsurance(insuranceAmount:number,insuranceWinAmount:number){
        
        if(this.table!.getInsurancePlayers.filter(player => player.user_id == this._id).length > 0)
            return  false;

        const mode = this.room?.options.mode ?? 'cash';
        const { status, insuranceId } = await this.room!.game.submitInsurance(this.room!.id, this._id, insuranceAmount, insuranceWinAmount,this.table!.round,mode,this.room?.options.tournament_id);
        if (status == true) {
            const InsurancePlayers = this.table!.getInsurancePlayers;
            InsurancePlayers.push({
                index: this.seat?.index,
                user_id: this._id,
                insuranceAmount: insuranceAmount,
                insuranceWinAmount: insuranceWinAmount,
                is_win: false,
                insuranceId:insuranceId
            });
            this.table!.logInsurance(this.seat?.index! , this._id,this.seat?.lossPercentage!,insuranceAmount,insuranceWinAmount,insuranceId);
        }
        return status;
    }

    public async dealDeadCard(){
        
        if(this._seat?.context.isDeadCards !== true)
        {
            this.table?.dealPlayerDeadCardByIndex(this._seat!.index);
            this._onTableRoundState(RoundState.None);
            await delay(2000);
            this._onTableSideBetEvaluate(SideBetState.PreCards);  
        }else{
            await delay(4000);
        }        
    }

    public async autoTopUp() {
        const top = this._topUpMoney ?? 0;
        if (top === 0)
            return false;

        const money = (this._seat?.money ?? 0);
        if (this._topUpCase == AutoTopUpCase.LessThanBuyIn && money >= top)
            return false;

        if (this._topUpCase == AutoTopUpCase.OutOfChips && money >= this._room?.table.bigBlind!)
            return false;

        const amount = floor4(top - money);

        if (this.tableBalance < amount) 
            return false;
        
        return this.buyIn(amount);
    }

    public action(action: string, bet?: number) {
        this.emit('action', action, bet);
    }

    public playerChatMessage(msg:string) {
        const time = new Date().toLocaleString([], { hour: 'numeric', minute: 'numeric', hour12: true });
        this.room?.table.doBroadcastChat({msg:msg,playerName:this.name,time,seat:this.seat?.index!});
    }

    public showCards() {
        this.emit('showcards');
    }
}
