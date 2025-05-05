import { last } from "lodash";
import { Card, createDeck, shuffleCards,encryptedShuffle } from "./card";
import { equal, floor4 } from "./math";
import { shuffle } from "./random";


export type Action = 'fold' | 'sb' | 'bb' | 'check' | 'call' | 'raise' | 'allin' | 'ante';

export type Seat = {
    index: number;
    money?: number;

    // cards?: [Card, Card];
    cards?: Card[];
    fold?: boolean;
    isDeadCards?:boolean;
    bet?: number;
    ante?: number;
    lastAction?: Action;
    lastBet?: number;
    lastActionState?:number;
};

function isPlayingSeat(seat: Seat) {
    return seat.money !== undefined;
}

export enum RoundState {
    None,
    PreFlop,
    Flop,
    Turn,
    River,
    Showdown,
    End
}

export type RoundOptions = {
    numberOfSeats: number;
    randomDeal?: boolean;
    burnCard?: boolean;
    gameType?:string;
    isEncryptedShuffling?:boolean;
};

export type RoundStartOptions = {
    smallBlind: number;
    bigBlind?: number;
    deck?: Card[];
    seatOfDealer: number;
    seatOfSmallBlind?: number;
    seatOfBigBlind?: number;
    gameType: string;
    noBB?:boolean;
    shuffleKey?:string;
};

export class Round {
    private _seats: Seat[];
    public get numberOfPlayers() { return this.getPlayingSeats().length; }
    public get canPlay() { return this.numberOfPlayers >= 2; }

    private _state: RoundState = RoundState.None;
    public get state() { return this._state; }
    public set state(state_: RoundState) { this._state = state_; }
    private _prevState:RoundState = RoundState.None;
    public get prevState(){ return this._prevState;}
    private _smallBlind?: number;
    public get smallBlind() { return this._smallBlind; }
    private _bigBlind?: number;
    public get bigBlind() { return this._bigBlind; }

    private _gameType?: string;
    private _deck?: Card[];
    public get getNewDeck() { return shuffle(createDeck())}
    private _cards?: Card[];
    public get cards() { return this._cards; }
    private _pot: number = 0;
    public get pot() { return this._pot; }
    private _streetPot: number = 0;
    public get streetPot() { return this._streetPot; }
    private _pendingAnte?: number;
    public get pendingAnte() { return this._pendingAnte; }
    private _seatOfDealer?: number;
    public get seatOfDealer() { return this._seatOfDealer; }
    private _seatOfSmallBlind?: number;
    public get seatOfSmallBlind() { return this._seatOfSmallBlind; }
    private _seatOfBigBlind?: number;
    public get seatOfBigBlind() { return this._seatOfBigBlind; }
    private _noBB?: boolean;
    public get NoBB() { return this._noBB; }
    private _turn?: number;
    public get turn() { return this._turn; }
    private _prevRaisedSeat?: number;
    public get prevRaisedTurn() { return this._prevRaisedSeat; }
    private _minBet?: number;
    public get minBet() { return this._minBet!; }
    public set minBet(bet: number) { this._minBet = bet;}
    private _legalRaise?: number;
    public get legalRaise() { return this._legalRaise; }
    private _seatOfRaisedBySmall?: number;
    public get seatOfRaisedBySmall() { return this._seatOfRaisedBySmall; }
    private _bbBeted?: boolean;

    private _shuffleKey?:string;
    private _pfCount?:number;
    public get pfCount() { return this._pfCount; }

    private _numberOfPlayers?:number;
    private _numberOfHoleCards?:number = 2;
    private _preFlopArray:Card[] = [];

    constructor(private _options: RoundOptions) {
        this._options.randomDeal = this._options.randomDeal ?? true;
        this._options.burnCard = this._options.burnCard ?? true;
        this._gameType = this._options.gameType;

        this._seats = [];
        for (let i = 0; i < this._options.numberOfSeats; ++i) {
            this._seats.push({
                index: i,
            });
        }
    }

    public reset() {
        this._seats.forEach(seat => {
            seat.money = undefined;
            seat.cards = undefined;
            seat.fold = undefined;
            seat.bet = undefined;
            seat.ante = undefined;
            seat.lastAction = undefined;
            seat.lastBet = undefined;
            seat.isDeadCards = undefined;
            seat.lastActionState = undefined;
        });

        this._state = RoundState.None;
        this._prevState = RoundState.None;
        this._deck = undefined;
        this._cards = [];
        this._pot = 0;
        this._streetPot = 0;
        this._pendingAnte = undefined;
        this._turn = undefined;
        this._prevRaisedSeat = undefined;
        this._minBet = undefined;
        this._legalRaise = undefined;
        this._seatOfBigBlind = -1;
        this._noBB=false;
        this._seatOfDealer = -1;
        this._seatOfSmallBlind = -1;
        this._shuffleKey = undefined;
        this._numberOfHoleCards = 2;
        this._numberOfPlayers = undefined;
        this._pfCount = undefined;
        this._preFlopArray = [];
        this._seatOfRaisedBySmall  = undefined;
    }

    public resetStreetPot() {
        this._streetPot = 0;
    }

    public add(index: number, money: number) {
        const seat = this._seats[index];
        seat.money = floor4((seat.money ?? 0) + money);
    }

    public remove(index: number) {
        const seat = this._seats[index];
        seat.money = undefined;
        seat.cards = undefined;
        seat.fold = undefined;
        seat.bet = undefined;
        seat.ante = undefined;
        seat.lastAction = undefined;
        seat.lastBet = undefined;
        seat.isDeadCards = undefined;
        seat.lastActionState = undefined;
    }

    public getPlayingSeats() {
        return this._seats.filter(isPlayingSeat);
    }

    public getSeat(index: number) {
        return this._seats[index];
    }

    public isSeatPlaying(index: number) {
        return isPlayingSeat(this._seats[index]);
    }

    public addAnteToPending(amount: number) {
        this._pendingAnte = floor4((this._pendingAnte ?? 0) + amount);
    }

    public start(opts: RoundStartOptions) {
        this._smallBlind = opts.smallBlind;
        this._bigBlind = opts.bigBlind ?? (this._smallBlind * 2);
        this._deck = opts.deck;
        this._gameType = opts.gameType;
        this._seatOfDealer = opts.seatOfDealer;
        this._seatOfSmallBlind = opts.seatOfSmallBlind;
        this._seatOfBigBlind = opts.seatOfBigBlind;
        this._noBB=opts.noBB;
        this._state = RoundState.None;
        this._prevState = RoundState.None;
        this._shuffleKey = opts.shuffleKey;

        this.roundStart();
    }

    private roundStart() {
        // state
        this._state = RoundState.PreFlop;
        this._prevState = RoundState.PreFlop;

        // ante
        this._pendingAnte ??= 0;

        // pot
        this._pot = 0;
        this._streetPot = 0;
        // cards
        this._deck = this._deck ?? (!!this._shuffleKey && this._options.isEncryptedShuffling) ? encryptedShuffle(createDeck(),this._shuffleKey!) :  shuffle(createDeck());
        this._cards = [];

        this._bbBeted = false;

        this._pot = floor4(this._pot + this._pendingAnte);
        this._streetPot = floor4(this._streetPot + this._pendingAnte);

        this._minBet = 0;
        this._turn = this._seatOfDealer!;
        this.nextTurn();

        // small blind
        if (this._seatOfSmallBlind !== undefined) {
            this.bet(this._seatOfSmallBlind, this._smallBlind!, 'sb');
            this._turn = this._seatOfSmallBlind;
            this.nextTurn();
        }

        // big blind
        if (this._seatOfBigBlind !== undefined ) {
            this.bet(this._seatOfBigBlind, this._bigBlind!, 'bb');
            this._turn = this._seatOfBigBlind;
            this.nextTurn();
        }

        this._minBet = this._bigBlind!;
        this._legalRaise = 0;
        this.setMinBet();

        this._numberOfPlayers = this.getPlayingSeats().length;
        if(this._gameType === 'nlh')
            this._numberOfHoleCards = 2;
        else if(this._gameType === 'plo' || this._gameType === 'nlh4')
            this._numberOfHoleCards = 4;
        else if(this._gameType === 'plo5')
            this._numberOfHoleCards = 5;
        else if(this._gameType === 'plo6')
            this._numberOfHoleCards = 6;

        this._pfCount = this._numberOfHoleCards! * this._numberOfPlayers;
        for (let i = 0; i < this._pfCount; i++) {
            this._preFlopArray.push(this._deck.pop()!);
        }

        this._preFlopArray = shuffle(this._preFlopArray);

    }

    public dealPlayerCardByIndex(seatIndex: number) {
        const seat = this._seats[seatIndex];
        this._deck = this._deck ?? shuffle(createDeck());

        this.dealPlayerCard(seat);
    }

    public dealPlayerDeadCardByIndex(seatIndex: number)
    {
        const seat = this._seats[seatIndex];
        const deck = shuffle(createDeck());
        if(this._gameType === 'nlh')
            seat.cards = [deck!.pop()!, deck!.pop()!];
        else if(this._gameType === 'plo' || this._gameType === 'nlh4')
            seat.cards = [deck!.pop()!, deck!.pop()!, deck!.pop()!, deck!.pop()!];
        else if(this._gameType === 'plo5')
            seat.cards = [deck!.pop()!, deck!.pop()!, deck!.pop()!,deck!.pop()!, deck!.pop()!];
        else if(this._gameType === 'plo6')
            seat.cards = [deck!.pop()!, deck!.pop()!, deck!.pop()!, deck!.pop()!, deck!.pop()!, deck!.pop()!];
    }

   

    private dealPlayerCard(seat: Seat) {
         seat.cards = this._preFlopArray.splice(0, this._numberOfHoleCards);
    }

    public dealPlayerCards() {
        [...this.getPlayingSeats()].forEach(seat => {
            this.dealPlayerCard(seat);
            seat.bet ??= 0;
            seat.ante ??= 0;
            seat.lastBet ??= 0;
        });
    }

    public checkPreflopOnePlayerRemaining() {
        if (this.checkOnePlayerRemaining() && this._state === RoundState.PreFlop)
            return true;

        return false;
    }

    public checkState(): RoundState | undefined {
        if (this._state === RoundState.None) {
            return this._state;
        }
        else if (this.checkOnePlayerRemaining()) {
            this.roundShowdown();
            return this._state;
        }
        else if (this.checkAllPlayersBet() || this.checkAllPlayersAllIn()) {
            if (this._state === RoundState.PreFlop) {
                this.roundFlop();
            }
            else if (this._state === RoundState.Flop) {
                this.roundTurn();
            }
            else if (this._state === RoundState.Turn) {
                this.roundRiver();
            }
            else if (this._state === RoundState.River) {
                this.roundShowdown();
            }

            if (this.checkAllPlayersAllIn())
                this._turn = undefined;

            return this._state;
        }
    }

    public nextTurn() {
        let turn = this._turn!;
        this._turn = undefined;

        for (let i = 1; i < this._seats.length; ++i) {
            turn = (turn + 1) % this._seats.length;
            if (!this.isSeatPlaying(turn))
                continue;
            const seat = this._seats[turn];
            if (!(seat.fold ?? false) && seat.lastAction !== 'allin') {
                this._turn = turn;
                break;
            }
        }
    }

    public getActions(): { actions: Action[]; call: number; raise?: [number, number]; } {
        const seat = this._seats[this.turn!];

        let canRaise = true, minRaise: number | undefined, maxRaise: number | undefined;
        let call = floor4(this._minBet! - seat.bet!);

        if (!this._bbBeted && call < this._bigBlind!)
            call = this._bigBlind!

        if (call === 0) {
            minRaise = this._bigBlind!;
        }
        else {
            if (call >= seat.money!) {
                call = seat.money!;
                canRaise = false;
            }
            else if (this.turn! === this._seatOfRaisedBySmall || !this._bbBeted) {
                canRaise = false;
            }
            else {
                minRaise = call + Math.max(this._legalRaise ?? 0, this._bigBlind!);
            }
        }

        if (canRaise) {
            if(this._gameType === 'plo' || this._gameType === 'plo5' || this._gameType === 'plo6') {
                maxRaise = this._pot + 2 * call;
            }
            else {
                maxRaise = seat.money!;
            }

            if (minRaise! > seat.money!) {
                minRaise = seat.money!;
                maxRaise = seat.money!;
            }
             
            minRaise = floor4(minRaise!);
            maxRaise = floor4(maxRaise!);
        }

        const actions: Action[] = [];
        if (call === 0)
            actions.push('check');

        else
            actions.push('call');

        if (canRaise)
            actions.push('raise');

        return {
            actions,
            call,
            raise: canRaise ? [minRaise!, maxRaise!] : undefined,
        };
    }

    public addAnte(index: number, amount: number, isAllinAnte: boolean) {
        const seat = this._seats[index];

        amount = floor4(amount);
        seat.ante = floor4((seat.ante ?? 0) + amount);
        seat.lastAction = "ante";
        if (isAllinAnte) {
            seat.lastAction = 'allin';
        }
    }

    public removeAnteAction(){
        this._seats.forEach(seat => {
            seat.lastAction = undefined;
        });
    }

    public bet(index: number, amount: number, action?: Action) {
        const seat = this._seats[index];
        if (!isPlayingSeat(seat))
            return false;

        amount = floor4(amount);      

        if (amount >= this._bigBlind!) this._bbBeted = true;

        const call = floor4((this._minBet ?? 0) - (seat.bet ?? 0));
         
        if (floor4(seat.money!) < call && amount < floor4(seat.money!)) { // insufficient call, not allin
            return false;
        }

        if (!action) {
            if (amount === 0)
                action = 'check';
            else if (amount <= call)
                action = 'call';
            else if (amount > call)
                action = 'raise';
        }
          
        if (amount >= floor4(seat.money!)) {
            action = 'allin';
            amount = seat.money!;

            const minRaise = call + Math.max(this._legalRaise ?? 0, this._bigBlind!);
            if (amount < minRaise) {
                this._seatOfRaisedBySmall = this._prevRaisedSeat;
            }
        }

        if (action === 'raise') {

            if (amount <= call)
                return false;

            const legalRaise = Math.max(this._legalRaise ?? 0, this._bigBlind!);

            if (floor4(amount - call) < legalRaise && amount <  floor4(seat.money!)) { // insufficient raise, not allin
                return false;
            }

            this._prevRaisedSeat = this._turn;

            this._seatOfRaisedBySmall = undefined;
        }

        if (this._turn === this._seatOfRaisedBySmall) {
            this._seatOfRaisedBySmall = undefined;
        }

        const raise = floor4(amount - call);
        this._legalRaise = Math.max(this._legalRaise ?? 0, this._bigBlind!, raise);

        seat.lastAction = action;
        seat.lastActionState = this.state;
        seat.lastBet = floor4((seat.lastBet ?? 0) + amount);

        seat.bet = floor4((seat.bet ?? 0) + amount);
        seat.money = floor4(seat.money! - amount);
        
        this._minBet = Math.max(this._minBet ?? 0, seat.bet);
        this._pot = floor4(this._pot! + amount);
        this._streetPot = floor4(this._streetPot! + amount);
        this.setMinBet();

        return true;
    }

    protected setMinBet(){        
        var playersMaxBet = Math.max(...this.getPlayingSeats().map(player=> player.bet!));
        if(this.state === RoundState.PreFlop && this.isAllPlayersAllIn() && this._seats[this.seatOfBigBlind!]?.bet! <  this._seats[this.seatOfSmallBlind!]?.bet! && playersMaxBet < this._minBet!)
		   {
				console.log(`if all player do allIn less than minBet then update minBet to max bet players`);
				this._minBet = playersMaxBet;
		   }
    }

    public fold(index: number) {
        const seat = this._seats[index];
        if (!isPlayingSeat(seat))
            return;

        seat.fold = true;
        seat.lastAction = 'fold';

        this.setMinBet();

    }

    public dealExtraCards(state: number) {
        if(this._cards!.length > 4)
            return true;
        
        switch(state) {
            case RoundState.Flop:
                this.dealCards(3); break;
            case RoundState.Turn:
                this.dealCards(1); break;
            case RoundState.River:
                this.dealCards(1); break;
            default: break;
        }
    }

    private roundFlop() {
        this.setState(RoundState.Flop);
        this.dealCards(3);
    }

    private roundTurn() {
        this.setState(RoundState.Turn);
        this.dealCards(1);
    }

    private roundRiver() {
        this.setState(RoundState.River);
        this.dealCards(1);
    }

    private roundShowdown() {
        this.setState(RoundState.Showdown);
        this._turn = undefined;
        this._prevRaisedSeat = undefined;
    }

    private setState(state: RoundState) {
        this._prevState = this._state;
        this._state = state;

        this._legalRaise = 0;
        this.getPlayingSeats().forEach(seat => {
            if (seat.lastAction === 'allin') // don't clear all-in state
                return;

            if (state !== RoundState.Showdown && seat.lastAction !== 'fold') {
                seat.lastAction = undefined;
                seat.lastBet = 0;
            }
        });

        this._turn = this._seatOfDealer!;
        this.nextTurn();
    }

    private dealCards(numberOfCards: number) {

        if(!this._shuffleKey)
        {
            if (this._options.randomDeal)
                this._deck = shuffle(this._deck!); // randomise rest cards in fly on
            if (this._options.burnCard)
                this._deck!.pop(); //Burn a card
        }

        for (let i = 0; i < numberOfCards; ++i) {
            this._cards!.push(this._deck!.pop()!);
        }
    }

    public checkOnePlayerRemaining() {
        return this.getPlayingSeats().filter(seat => !(seat.fold ?? false)).length <= 1;
    }

    public getOnePlayerRemainingSeat() {
        if (this.checkOnePlayerRemaining()) {
            const players = this.getPlayingSeats().filter(seat => !(seat.fold ?? false));

            return players.length === 0 ? undefined : players[0].index;
        }
        return;
    }

    public checkAllPlayersBet() {
        return this.getPlayingSeats().every(seat => seat.lastAction === 'allin' ||
            (seat.fold ?? false) ||
            (equal(seat.bet, this._minBet) && (seat.lastAction === 'check' || seat.lastAction === 'call' || seat.lastAction === 'raise')));
    }

    public checkAllPlayersAllIn() {
        if (this.checkOnePlayerRemaining()) {
            return false;
        }

        const seats = this.getPlayingSeats();
        let allins = 0, bets = 0;
        seats.forEach(seat => {
            if (seat.lastAction === 'allin' || (seat.fold ?? false))
                ++allins;
            else if (equal(seat.bet, this._minBet))
                ++bets;
        });
        return seats.length === allins || (bets === 1 && (allins + bets === seats.length));
    }

    public isAllPlayersAllIn(){

        if (this.checkOnePlayerRemaining()) {
            return false;
        }

        const seats = this.getPlayingSeats();
        let allins = 0;
        seats.forEach(seat => {
            if (seat.lastAction === 'allin' || (seat.fold ?? false))
                ++allins;
        });

        return seats.length === allins + 1;
    }

    public checkAllPlayersFold() {
        return this.getPlayingSeats().every(seat => (seat.fold ?? false));
    }

    public calculatePots(returnedSidebet: boolean) {
        let ante = this._pendingAnte!;

        const players = this.getPlayingSeats()
            .map(seat => ({
                seat,
                bet: seat.bet!,
                ante: seat.ante!,
                allin: seat.lastAction === 'allin',
                fold: seat.fold ?? false,
            }));

        const allinAntes = players
            .filter(player => player.allin && !(player.bet > 0))
            .map(player => player.ante)
            .sort((a, b)=> a - b );

        const allinBets = players
            .filter(player => player.allin && player.bet > 0)
            .map(player => player.bet)
            .sort((a, b)=> a - b );

        const pots: { amount: number; seats: Seat[]; }[] = [];

        for (let j = 0; j < allinAntes.length; ++j) {
            const allin = allinAntes[j];
            const pot = { amount: 0, seats: [] as Seat[] };
            players.forEach(player => {
                if (!player.ante)
                    return;
                const t0 = Math.min(allin, player.ante);
                player.ante -= t0;
                ante -= t0;
                pot.amount += t0;
                if (!player.fold)
                    pot.seats.push(player.seat);
            });
            if (pot.amount > 0) {
                pots.push(pot);
            }
            for (let i = j + 1; i < allinAntes.length; ++i)
                allinAntes[i] -= allin;
        }

        for (let j = 0; j < allinBets.length; ++j) {
            const allin = allinBets[j];
            const pot = { amount: 0, seats: [] as Seat[] };
            players.forEach(player => {
                if (!player.bet)
                    return;
                const t0 = Math.min(allin, player.bet);
                player.bet -= t0;
                pot.amount += t0;
                if (!player.fold)
                    pot.seats.push(player.seat);
            });
            if (pot.amount > 0) {
                pot.amount = floor4(pot.amount + ante);
                pots.push(pot);
                ante = 0;
            }
            for (let i = j + 1; i < allinBets.length; ++i)
                allinBets[i] -= allin;
        }

        const pot = { amount: 0, seats: [] as Seat[] };
        players.forEach(player => {
            if (!player.bet)
                return;
            pot.amount += player.bet;
            if (!player.fold)
                pot.seats.push(player.seat);
        });
        if (pot.amount > 0) {
            pot.amount = floor4(pot.amount + ante);
            pots.push(pot);
            ante = 0;
        }

        this._pot! = 0;
        pots.forEach(pot => {
            this._pot! += pot.amount;
        });
        
        const lastPot = pots[pots.length - 1];

        if (returnedSidebet) {
            pots.pop();
            this._pot! -= lastPot.amount;
        }
        
        return { pots, shouldReturn: lastPot.seats.length === 1 && (allinAntes.length > 0 || allinBets.length > 0) };
    }

    getReturnBet(pots: any, shouldReturn: boolean) {
        let returnSeatIndex = undefined;
        let returnBet = undefined;
        if (pots.length > 1) {
            const lastPot = pots.pop();
            if (shouldReturn) {
                returnSeatIndex = lastPot?.seats[0].index;
                returnBet = lastPot?.amount;
            }
            else {
                pots.push(lastPot!);
            }
        }

        this._pot! -= (returnBet ?? 0);

        return {
            returnSeatIndex,
            returnBet
        };
    }
}
