import { last } from "lodash";
import { Card, createDeck, shuffleCards } from "./card";
import { round2 } from "./math";
import { shuffle } from "./random";


export type Action = 'fold' | 'sb' | 'bb' | 'check' | 'call' | 'raise' | 'allin';

export type Seat = {
    index: number;
    money?: number;

    // cards?: [Card, Card];
    cards?: Card[];
    fold?: boolean;
    bet?: number;
    ante?: number;
    lastAction?: Action;
    lastBet?: number;
};

function isPlayingSeat(seat: Seat) {
    return seat.money !== undefined;
}

export enum RoundState {
    None,
    HoleCards,
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
};

export class Round {
    private _seats: Seat[];
    public get numberOfPlayers() { return this.getPlayingSeats().length; }
    public get canPlay() { return this.numberOfPlayers >= 2; }

    private _state: RoundState = RoundState.None;
    public get state() { return this._state; }
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
    private _lastBet?: number;
    public get lastBet() { return this._lastBet!; }
    public set lastBet(bet: number) { this._lastBet = bet;}
    private _legalRaise?: number;
    public get legalRaise() { return this._legalRaise; }
    private _seatOfRaisedBySmall?: number;
    public get seatOfRaisedBySmall() { return this._seatOfRaisedBySmall; }
    private _bbBeted?: boolean;

    constructor(private _options: RoundOptions) {
        this._options.randomDeal = this._options.randomDeal ?? true;
        this._options.burnCard = this._options.burnCard ?? true;

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
        });

        this._state = RoundState.None;
        this._gameType = undefined;
        this._deck = undefined;
        this._cards = [];
        this._pot = 0;
        this._streetPot = 0;
        this._pendingAnte = undefined;
        this._turn = undefined;
        this._prevRaisedSeat = undefined;
        this._lastBet = undefined;
        this._legalRaise = undefined;
        this._seatOfBigBlind = -1;
        this._noBB=false;
        this._seatOfDealer = -1;
        this._seatOfSmallBlind = -1;
    }

    public resetStreetPot() {
        this._streetPot = 0;
    }

    public add(index: number, money: number) {
        const seat = this._seats[index];
        seat.money = round2((seat.money ?? 0) + money);
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
        this._pendingAnte = round2((this._pendingAnte ?? 0) + amount);
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

        this.roundStart();
    }

    private roundStart() {
        // state
        this._state = RoundState.HoleCards;

        // ante
        this._pendingAnte ??= 0;

        // pot
        this._pot = 0;
        this._streetPot = 0;
        // cards
        this._deck = this._deck ?? shuffle(createDeck());
        this._cards = [];

        this._bbBeted = false;

        this._pot = round2(this._pot + this._pendingAnte);
        this._streetPot = round2(this._streetPot + this._pendingAnte);

        this._lastBet = 0;
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

        this._lastBet = this._bigBlind!;
        this._legalRaise = 0;
    }

    public dealPlayerCards() {
        this.getPlayingSeats().forEach(seat => {
            if(this._gameType === 'nlh')
                seat.cards = [this._deck!.pop()!, this._deck!.pop()!];
            else if(this._gameType === 'plo' || this._gameType === 'nlh4')
                seat.cards = [this._deck!.pop()!, this._deck!.pop()!, this._deck!.pop()!, this._deck!.pop()!];
            else if(this._gameType === 'plo5')
                seat.cards = [this._deck!.pop()!, this._deck!.pop()!, this._deck!.pop()!, this._deck!.pop()!, this._deck!.pop()!];
            seat.bet ??= 0;
            seat.ante ??= 0;
            seat.lastBet ??= 0;
        });
    }

    public checkPreflopOnePlayerRemaining() {
        if (this.checkOnePlayerRemaining() && this._state === RoundState.HoleCards)
            return true;
        
        return false;
    }

    public checkState(): RoundState | undefined {
        if (this._state === RoundState.None) {
            return this._state;
        }
        else if (this._state === RoundState.Showdown) {
            this._state = RoundState.End;
            return this._state;
        }
        else if (this.checkOnePlayerRemaining()) {
            this.roundShowdown();
            return this._state;
        }
        else if (this.checkAllPlayersBet() || this.checkAllPlayersAllIn()) {
            if (this._state === RoundState.HoleCards) {
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
        let call = round2(this._lastBet! - seat.bet!);

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
            if(this._gameType === 'plo' || this._gameType === 'plo5') {
                maxRaise = this._pot;
            }
            else {
                maxRaise = seat.money!;
            }

            if (minRaise! > seat.money!) {
                minRaise = seat.money!;
                maxRaise = seat.money!;
            }

            minRaise = round2(minRaise!);
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

        amount = round2(amount);
        seat.ante = round2((seat.ante ?? 0) + amount);

        if (isAllinAnte) {
            seat.lastAction = 'allin';
        }
    }

    public bet(index: number, amount: number, action?: Action) {
        const seat = this._seats[index];
        if (!isPlayingSeat(seat))
            return false;

        amount = round2(amount);
        
        if (amount >= this._bigBlind!) this._bbBeted = true;

        const call = round2((this._lastBet ?? 0) - (seat.bet ?? 0));
        if (seat.money! < call && amount < seat.money!) { // insufficient call, not allin
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
        
        if (amount >= seat.money!) {
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
            if (amount - call < legalRaise && amount < seat.money!) { // insufficient raise, not allin
                return false;
            }

            this._prevRaisedSeat = this._turn;

            this._seatOfRaisedBySmall = undefined;
        }

        if (this._turn === this._seatOfRaisedBySmall) {
            this._seatOfRaisedBySmall = undefined;
        }
        
        const raise = round2(amount - call);
        this._legalRaise = Math.max(this._legalRaise ?? 0, this._bigBlind!, raise);

        seat.lastAction = action;
        seat.lastBet = round2((seat.lastBet ?? 0) + amount);

        seat.bet = round2((seat.bet ?? 0) + amount);
        seat.money = round2(seat.money! - amount);

        this._lastBet = Math.max(this._lastBet ?? 0, seat.bet);
        this._pot = round2(this._pot! + amount);
        this._streetPot = round2(this._streetPot! + amount);

        return true;
    }

    public fold(index: number) {
        const seat = this._seats[index];
        if (!isPlayingSeat(seat))
            return;

        seat.fold = true;
        seat.lastAction = 'fold';
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
        if (this._options.randomDeal)
            this._deck = shuffle(this._deck!); // randomise rest cards in fly on
        if (this._options.burnCard)
            this._deck!.pop(); //Burn a card

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
            (seat.bet === this._lastBet && (seat.lastAction === 'check' || seat.lastAction === 'call' || seat.lastAction === 'raise')));
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
            else if (seat.bet === this._lastBet)
                ++bets;
        });
        return seats.length === allins || (bets === 1 && (allins + bets === seats.length));
    }

    public checkAllPlayersFold() {
        return this.getPlayingSeats().every(seat => (seat.fold ?? false));
    }

    public calculatePots() {
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
            .filter(player => player.allin)
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
                pot.amount = round2(pot.amount + ante);
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
            pot.amount = round2(pot.amount + ante);
            pots.push(pot);
            ante = 0;
        }

        this._pot! = 0;
        pots.forEach(pot => {
            this._pot! += pot.amount;
        });

        return pots;
    }

    getReturnBet(pots: any) {
        let returnSeatIndex = undefined;
        let returnBet = undefined;
        if (pots.length > 1) {
            const lastPot = pots.pop();
            if (lastPot?.seats.length! == 1) {
                returnSeatIndex = lastPot?.seats[0].index;
                returnBet = lastPot?.amount;
            }
            else {
                pots.push(lastPot!);
            }
        }

        this._pot! -= (returnBet ?? 0);

        // if (!!returnSeatIndex) {
        //     const index = Number(returnSeatIndex);
        //     const returnAmount = Number(returnBet);

        //     const players = this.getPlayingSeats()
        //         .filter(seat => seat.index === index)
        //         .map(seat => seat!.bet! -= returnAmount)
        // }

        return {
            returnSeatIndex,
            returnBet
        };
    }
}
