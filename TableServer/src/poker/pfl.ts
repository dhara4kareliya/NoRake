export class GameTable {
    public static MAX_TABLE_SIZE: number = 9;
    public _table: Array<Sit> = new Array<Sit>();
    constructor() {
        for (
        let i: number = 0; i < GameTable.MAX_TABLE_SIZE; i++) this._table.push(new Sit(i));
    }
    public numOfOldPlaying() : number {
        let cnt: number = 0;
        for (
        let s_index_ = 0, s_source_ = this._table; s_index_ < s_source_.length; s_index_++) {
            let s = s_source_[s_index_];
            if (s.hasPlayer && !s.sitOut && !s.IsNewPlayer && !s.backFormSitOut) cnt++;
        }
        return cnt;
    }
    public numOfPlaying() : number {
        let cnt: number = 0;
        for (
        let s_index_ = 0, s_source_ = this._table; s_index_ < s_source_.length; s_index_++) {
            let s = s_source_[s_index_];
            if (s.hasPlayer && !s.sitOut) cnt++;
        }
        return cnt;
    }
    public numOfPlayingOrJustLeft() : number {
        let cnt: number = 0;
        for (
        let s_index_ = 0, s_source_ = this._table; s_index_ < s_source_.length; s_index_++) {
            let s = s_source_[s_index_];
            if (s.hasPlayer && !s.sitOut || s.justLeft) cnt++;
        }
        return cnt;
    }
    public nextPlayerOrJustLeft(indx: number) //Next player includes player that just left .: number
    {
        let j: number = indx;
        for (
        let i: number = 0; i < GameTable.MAX_TABLE_SIZE; i++) {
            j = (j + 1) % GameTable.MAX_TABLE_SIZE;
            if (this._table[<number>j].justLeft || (this._table[<number>j].hasPlayer && !this._table[<number>j].sitOut))
            return j;
        }
        return -1; //No other Players
    }
    public prevPlayerOrJustLeft(indx: number) //Next player includes player that just left .: number
    {
        let j: number = indx;
        for (
        let i: number = 0; i < GameTable.MAX_TABLE_SIZE - 1; i++) {
            j = (j - 1);
            if (j < 0) j = GameTable.MAX_TABLE_SIZE - 1;
            if (this._table[<number>j].justLeft || (this._table[<number>j].hasPlayer && !this._table[<number>j].sitOut))
            return j;
        }
        return -1; //No other Players
    }
    public prevPlayingPlayer(indx: number) : number {
        let j: number = indx;
        for (
        let i: number = 0; i < GameTable.MAX_TABLE_SIZE - 1; i++) {
            j = (j - 1);
            if (j < 0) j = GameTable.MAX_TABLE_SIZE - 1;
            if ((this._table[<number>j].hasPlayer && !this._table[<number>j].sitOut))
            return j;
        }
        return -1; //No other Players
    }
    public nextOccupiedSeat(indx: number) //Next seat with playing player: number
    {
        let j: number = indx;
        for (
        let i: number = 0; i < GameTable.MAX_TABLE_SIZE - 1; i++) {
            j = (j + 1) % GameTable.MAX_TABLE_SIZE;
            if (this._table[<number>j].hasPlayer && !this._table[<number>j].sitOut)
            return j;
        }
        return -1; //No other players
    }
    public nextSitJustLeft(indx: number) : number {
        let j: number = indx;
        for (
        let i: number = 0; i < GameTable.MAX_TABLE_SIZE - 1; i++) {
            j = (j + 1) % GameTable.MAX_TABLE_SIZE;
            if (this._table[<number>j].justLeft)
            return j;
            else
            if (this._table[<number>j].hasPlayer)
            return -1;
        }
        return -1;
    }
    public currentD() //Return Dealer Button Index: number
    {
        for (
        let i: number = 0; i < GameTable.MAX_TABLE_SIZE; i++) {
            if (this._table[<number>i].isD)
            return i;
        }
        return -1;
    }
    public currentSB() //Return SB Button Index: number
    {
        for (
        let i: number = 0; i < GameTable.MAX_TABLE_SIZE; i++) {
            if (this._table[<number>i].isSB)
            return i;
        }
        return -1;
    }
    public currentBB() //Return BB Button Index: number
    {
        for (
        let i: number = 0; i < GameTable.MAX_TABLE_SIZE; i++) {
            if (this._table[<number>i].isBB)
            return i;
        }
        return -1;
    }
    public allNew() : boolean {
        for (
        let s_index_ = 0, s_source_ = this._table; s_index_ < s_source_.length; s_index_++) {
            let s = s_source_[s_index_];
            if (s.hasPlayer && !s.sitOut && s.IsNewPlayer == false)
            return false;
        }
        return true;
    }
    public clearNotes() : void {
        for (
        let s_index_ = 0, s_source_ = this._table; s_index_ < s_source_.length; s_index_++) {
            let s = s_source_[s_index_];
            s.isBB = false;
            s.isSB = false;
            s.isD = false;
        }
    }
}
export class PFLogic {
    _gameTable: GameTable = new GameTable();
    public findDInex(SB: number) : number {
        let i: number = this._gameTable.prevPlayerOrJustLeft(SB);
        let lim: number = i;
        let cnt: number = 0;
        while (this._gameTable._table[<number>i].IsNewPlayer || this._gameTable._table[<number>i].backFormSitOut) {
            i = this._gameTable.prevPlayerOrJustLeft(i);
            if (i == lim || cnt >= GameTable.MAX_TABLE_SIZE)
            break;
            cnt += 1;
        }
        return i;
    }
    public findSBIndex(BB: number, prvSB: number) : number {
        let sbIndx: number = this._gameTable.nextPlayerOrJustLeft(prvSB);
        if (this._gameTable.nextOccupiedSeat(sbIndx) != BB) sbIndx = this._gameTable.prevPlayingPlayer(BB);
        return sbIndx;
    }
    public findBBIndex(curB: number) : number {
        return this._gameTable.nextOccupiedSeat(curB); //BB always moves one sit to a playing player
    }
    public addPlayer(indx: number, Tmode: boolean) //add new player,  before calling must checked if can join: void
    {
        if (this._gameTable._table[<number>indx].hasPlayer && this._gameTable._table[<number>indx].sitOut && !Tmode) this.joinFromSitOut(indx);
        else this._gameTable._table[<number>indx].SetNewPlayer();
    }
    private joinFromSitOut(indx: number) //player back from sitout, return his blinds amount: void
    {
        this._gameTable._table[<number>indx].sitOut = false;
        this._gameTable._table[<number>indx].backFormSitOut = true;
    }
    public canjoinNow(sitIndex: number, waitForBB: boolean, Tmode: boolean) //Whatever a new player can be play this round: boolean
    {
        let lastD: number = this._gameTable.currentD();
        if (lastD < 0 || this._gameTable.numOfPlaying() < 2)
        return true;
        if ((waitForBB && !Tmode) || this._gameTable.numOfPlaying() == 2) {
            let cloneSit: Sit = this._gameTable._table[<number>sitIndex].clone(); //Get a copy of this sit
            //Set it like a playing player
            this._gameTable._table[<number>sitIndex].sitOut = false;
            this._gameTable._table[<number>sitIndex].hasPlayer = true;
            this._gameTable._table[<number>sitIndex].IsNewPlayer = true;
            let next_bb: number = this.findBBIndex(this._gameTable.currentBB());
            this._gameTable._table[<number>sitIndex] = cloneSit; //retrive changes
            return next_bb == sitIndex; //You are BB next hand, you can join
        } else {
            let d: number = 0,
            bb = 0,
            sb = 0;
            bb = this.findBBIndex(this._gameTable.currentBB());
            sb = this.findSBIndex(bb, this._gameTable.currentSB());
            if (this._gameTable.numOfOldPlaying() == 2) d = lastD; // dealer not move when new player join
            else d = this.findDInex(sb);
            if ((d < sb && sitIndex >= d && sitIndex < sb) || (d > sb && (sitIndex >= d || sitIndex < sb)))
            return false;
            else
            return true;
        }
    }
    public playerSitOut(sitIndex: number, Tmode: boolean) : void {
        if (Tmode)
        return;
        this._gameTable._table[<number>sitIndex].sitOut = true;
        this._gameTable._table[<number>sitIndex].justLeft = true;
        if (this._gameTable.numOfPlaying() == 1)
        for (
        let s_index_ = 0, s_source_ = this._gameTable._table; s_index_ < s_source_.length; s_index_++) {
            let s = s_source_[s_index_];
            if (s.hasPlayer) s.IsNewPlayer = true;
        }
    }
    public playerLeaves(sitIndex: number) : void {
        this._gameTable._table[<number>sitIndex].hasPlayer = false;
        this._gameTable._table[<number>sitIndex].justLeft = true;
        if (this._gameTable.numOfPlaying() == 1)
        for (
        let s_index_ = 0, s_source_ = this._gameTable._table; s_index_ < s_source_.length; s_index_++) {
            let s = s_source_[s_index_];
            if (s.hasPlayer) s.IsNewPlayer = true;
        }
    }
    public run(bbSize: number, sbSize: number, Tmode: boolean) //Run one round and return the status of each sit.: Array<Result> | null
    {
        let r: Array<Result> = new Array<Result>();
        if (this._gameTable.numOfPlaying() < 2)
        return r;
        let prvBB: number = 0,
        prvSB = 0;
        let d: number = 0,
        sb = 0,
        bb = 0;
        let newGame: boolean = this._gameTable.allNew(); //we just started a new game
        prvBB = this._gameTable.currentBB();
        prvSB = this._gameTable.currentSB();
        if (newGame) {
            d = this._gameTable.nextOccupiedSeat(0);
            if (this._gameTable.numOfPlaying() == 2) {
                bb = this._gameTable.nextOccupiedSeat(d);
                sb = d;
            } else {
                sb = this._gameTable.nextOccupiedSeat(d);
                bb = this._gameTable.nextOccupiedSeat(sb);
            }
        } else {
            bb = this.findBBIndex(this._gameTable.currentBB());
            sb = this.findSBIndex(bb, this._gameTable.currentSB());
            if (this._gameTable.numOfPlayingOrJustLeft() == 2) d = sb;
            else d = this.findDInex(sb);
        }
        this._gameTable.clearNotes(); //clear notations
        this._gameTable._table[<number>d].isD = true; //Set D
        this._gameTable._table[<number>sb].isSB = true;
        this._gameTable._table[<number>bb].isBB = true;
        let noBig: boolean = false; //In a case of SB paying also BB, there is no BB on this round. (to avoid double BB)
        let nextSitJustLeftIndx: number = -1;
        for (
        let s_index_ = 0, s_source_ = this._gameTable._table; s_index_ < s_source_.length; s_index_++) {
            let s = s_source_[s_index_];
            let rs: Result = new Result(s.sitIndex);
            rs.isBB = bb == s.sitIndex && s.hasPlayer && !s.sitOut;
            rs.isSB = sb == s.sitIndex && s.hasPlayer && !s.sitOut;
            rs.isD = d == s.sitIndex;
            if (!s.hasPlayer || s.sitOut) {
                if (s.justLeft && nextSitJustLeftIndx == -1 && this._gameTable.numOfPlaying() > 2) nextSitJustLeftIndx = this._gameTable.nextSitJustLeft(s.sitIndex);
                if (s.sitIndex != nextSitJustLeftIndx) s.justLeft = false;
            }
            if (!s.hasPlayer) {
                rs.emptySit = true;
                r.push(rs);
            }
            if (s.hasPlayer && s.sitOut && (s.missedButton(prvBB, bb) || bb == s.sitIndex)) s.missingBig = true;
            if (s.hasPlayer && s.sitOut && (s.missedButton(prvSB, sb) || sb == s.sitIndex)) s.missingSmall = true;
            if (s.hasPlayer && s.sitOut) {
                rs.sitOut = true;
                rs.missBB = s.missingBig;
                rs.missSB = s.missingSmall;
                r.push(rs);
            }
            if (s.hasPlayer && !s.sitOut) {
                if (newGame) {
                    s.missingBig = false; //no missing blinds on start of the game
                    s.missingSmall = false;
                }
                if (rs.isBB) {
                    rs.sum += bbSize;
                    s.missingBig = false;
                } else
                if (rs.isSB) {
                    rs.sum += sbSize;
                    if (s.missingBig) {
                        rs.sum += bbSize;
                        s.missingBig = false;
                        noBig = true;
                    }
                    s.missingSmall = false;
                } else {
                    if (s.missingBig) rs.sum += bbSize;
                    if (s.missingSmall) {
                        rs.sum += sbSize;
                        rs.sbAnte = true;
                    }
                    s.missingBig = false;
                    s.missingSmall = false;
                }
                r.push(rs);
                s.IsNewPlayer = false;
            }
            s.backFormSitOut = false;
        }
        if (noBig)
        
        for (
        let rslt_index_ = 0, rslt_source_ = r; rslt_index_ < rslt_source_.length; rslt_index_++) {
            let rslt = rslt_source_[rslt_index_];            
            if (rslt.isBB) {
                rslt.isBB = false;
                rslt.sum = 0;                
                rslt.noBB=true;
            }
        }
        if (Tmode)
        for (
        let rslt_index_ = 0, rslt_source_ = r; rslt_index_ < rslt_source_.length; rslt_index_++) {
            let rslt = rslt_source_[rslt_index_];
            rslt.missBB = false;
            rslt.missSB = false;
            rslt.sbAnte = false;
            rslt.sitOut = false;
            if (rslt.isBB) rslt.sum = bbSize;
            else
            if (rslt.isSB) rslt.sum = sbSize;
            else rslt.sum = 0;
        }
       
        return r;
    }
}
export class Result {
    public sitIndex: number = 0;
    public sum: number = 0;
    public sbAnte: boolean = false;
    public isD: boolean = false;
    public isSB: boolean = false;
    public isBB: boolean = false;
    public noBB:  boolean = false;
    public emptySit: boolean = false;
    public sitOut: boolean = false;
    public missBB: boolean = false;
    public missSB: boolean = false;
    constructor(sitIndex: number) {
        this.sitIndex = sitIndex;
    }
}
export class Sit {
    public sitIndex: number = 0;
    public hasPlayer: boolean = false;
    public justLeft: boolean = false;
    public sitOut: boolean = false;
    public IsNewPlayer: boolean = false;
    public isD: boolean = false;
    public isSB: boolean = false;
    public isBB: boolean = false;
    public backFormSitOut: boolean = false;
    public missingBig: boolean = false;
    public missingSmall: boolean = false;
    constructor(sitIndex: number) {
        this.sitIndex = sitIndex;
    }
    public clone() //return a clone of this Sit: Sit | null
    {
        let s: Sit = new Sit(this.sitIndex);
        s.hasPlayer = this.hasPlayer;
        s.justLeft = this.justLeft;
        s.sitOut = this.sitOut;
        s.IsNewPlayer = this.IsNewPlayer;
        s.isD = this.isD;
        s.isSB = this.isSB;
        s.isBB = this.isBB;
        s.backFormSitOut = this.backFormSitOut;
        s.missingBig = this.missingBig;
        s.missingSmall = this.missingSmall;
        return s;
    }
    public SetNewPlayer() : void {
        this.hasPlayer = true;
        this.sitOut = false;
        this.justLeft = false;
        this.IsNewPlayer = true;
        this.isD = false;
        this.isSB = false;
        this.isBB = false;
        this.backFormSitOut = false;
        this.missingBig = true;
        this.missingSmall = true;
    }
    public missedButton(prv: number, cur: number) //return true if sit index is between prv and cur: boolean
    {
        return ((cur > prv && this.sitIndex > prv && this.sitIndex < cur) || (cur < prv && (this.sitIndex > prv || this.sitIndex < cur)));
    }
}