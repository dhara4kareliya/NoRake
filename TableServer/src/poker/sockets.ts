import { Server, Socket } from 'socket.io';
import { PlayerInfo } from '../services/game';
import { Room } from './room';
import { Player, PlayerState, AutoTopUpCase, playerPosition, UserMode, SideBetState } from './player';
import { RoundState, Action } from './round';
import { SideBetOptions, SideBetResult, Table, TableSeat, TableSeatState } from './table';
import winston from 'winston';
import { HandRankName } from './card';
import { decrypt, delay, encrypt, generateRandomString,generateHashAndServerString,generateJSONAndShuffleKey,verifyAllUserHashes } from '../services/utils';
import { update } from 'lodash';
import moment , { relativeTimeThreshold } from 'moment';
import { evaluateSideBet } from './sidebet';
import { dealMe, hit } from './sideGame';
import { floor4 } from "./math";
import { Card } from './card';
import { getErrorMessage } from '../messages';


export class SocketLobby {
    private contexts: Map<string, SocketRoomContext> = new Map();

    constructor(private readonly io: Server, private readonly logger: winston.Logger) {
    }

    private log(message?: any, ...optionalParams: any[]) {
        this.logger.debug(`SocketLobby: ${message}`, ...optionalParams);
    }

    public register(room: Room) {
        this.contexts.set(room.id, new SocketRoomContext(room, this.logger));
    }

    public getContext(id: string) {
        return this.contexts.get(id);
    }

    public find(id: string) {
        return this.getContext(id)?.room;
    }

    public start() {
        this.io.on('connection', socket => {
            this.log(`New client connected: socket: ${socket.id}`);
            this.logger.notice(`New client connected: socket: ${socket.id}`);
            socket.on('REQ_PLAYER_ENTER', (data, ack) => this.onPlayerEnter(socket, data, ack));
            socket.on('REQ_PLAYER_ENTER_ENCRYPT', (data, ack) => this.onPlayerEnterMT(socket, data, ack));
        });
    }

    private async onPlayerEnterMT(socket: Socket, arg: { user_encrypted: string, table_token: string, mode: string }, ack?: (status: boolean) => void) {
        const tableToken = String(arg.table_token);
        const userEncypted = String(arg.user_encrypted);

        this.log(`Player is trying to enter. user token: ${userEncypted}, table token: ${tableToken}`);

        const context = this.getContext(tableToken);
        if (!context) {
            this.log(`Room not found for token: ${tableToken}. Discarding this player.`);
            return ack?.(false);
        }

        const result = await context.join(socket, UserMode[arg.mode as keyof typeof UserMode], undefined, userEncypted);
        ack?.(result !== undefined);
    }

    private async onPlayerEnter(socket: Socket, arg: { user_token: string, table_token: string, mode: string }, ack?: (status: boolean) => void) {
        const userToken = String(arg.user_token);
        const tableToken = String(arg.table_token);
        this.log(`Player is trying to enter. user token: ${userToken}, table token: ${tableToken}`);

        const context = this.getContext(tableToken);
        if (!context) {
            this.log(`Room not found for token: ${tableToken}. Discarding this player.`);
            return ack?.(false);
        }

        const result = await context.join(socket, UserMode[arg.mode as keyof typeof UserMode], userToken);
        ack?.(result !== undefined);
    }
}

class SocketRoomContext {
    private players: Map<string, SocketPlayer> = new Map();
    public get table() { return this.room.table; }

    constructor(public readonly room: Room, private readonly logger: winston.Logger) {
    }

    private log(message?: any, ...optionalParams: any[]) {
        this.logger.debug(`Room(Table#${this.room.table.id})): ${message}`, ...optionalParams);
    }

    public async join(socket: Socket, mode: UserMode, thread?: string, userEncrypted?: string) {
        this.log(`Player enter. thread token: ${thread ?? userEncrypted}, socket: ${socket.id}`);

        let player : SocketPlayer | undefined;
        if (!!thread) {
            player = this.players.get(thread);
        }

        if (!player) {
            player = await this.addPlayer(mode, thread, userEncrypted);
        }

        if (!player)
            return;

        if (this.table.isClosed === true) {
            socket.emit('REQ_MESSAGE', { status: false, msg: getErrorMessage("closeTable")});
            //return; 
        }

        if(this.table.options.isRandomTable && this.table.leavePlayers.includes(player.id))
            socket.emit('REQ_PLAYER_LEAVE', { type: "double_browser_leave", msg:  getErrorMessage("RejoinGame") });


        this.log(`Player accepted. token: ${player.id}, player: ${player.name}.`);

        player.connect(socket, !thread && !!userEncrypted);

        return player;
    }

    public async addPlayerByApi(playerinfo: any) {
        let info : any;
        info = {...playerinfo, mode: UserMode.Player};

        let player = this.players.get(info.t);
        if (!player) {
            this.log(`New player(${info.name}) is joining by API`);

            player = new SocketPlayer(this.logger, info.t, info);
            this.players.set(player.thread!, player);

            player.on('leaveroom', () => {
                this.players.delete(player!.thread!);
            });

            this.room.join(player);
        }
        else {
            this.log(`Player(${info.name}) is re-joining.`);
        }

        return player;
    }

    private async addPlayer(mode: UserMode, thread?: string, userEncrypted?: string) {
        let info : any;

        if (!!thread)
            info = await this.room.game.getUser(thread, this.room.id, false);
        else if (!!userEncrypted) {
            const { name, avatar, country, token, tables, created_at,rating } = JSON.parse(decrypt(userEncrypted));
            const table = tables.find((table: any) => table.table_token === this.room.id);

            info = {
                name,
                avatar,
                country,
                token,
                main_balance: table.main_balance,
                chips: table.chips,
                joiningDate:  created_at,
                rating:rating ?? '0'
            }
        }
        if (!info)
            return;

        info = {...info, mode: mode};

        let player = this.players.get(info.token);
        if (!player) {
            this.log(`New player(${info.name}) is joining.`);

            player = new SocketPlayer(this.logger, thread, info);
            this.players.set(player.thread!, player);

            player.on('leaveroom', () => {
                this.players.delete(player!.thread!);
            });

            this.room.join(player);
        }
        else {
            this.log(`Player(${info.name}) is re-joining.`);
        }

        return player;
    }
}

class SocketPlayer extends Player {
    private _sockets: Map<string, Socket> = new Map();
    private _pendingLeaveTable: Boolean = false;
    private _playerSetting:any = {};

    constructor(logger: winston.Logger, thread?: string, info?: any) {
        super(logger);

        this._thread = thread;
        if (!!info)
            this.setInfo(info);
    }

    private socketLog(message?: any, ...optionalParams: any[]) {
        if(process.env.SOCKET_LOG !== "true")
            return;
        this.logger.notice(`${this.name}: ${message}`, ...optionalParams);
    }

    private async updateInfo() {
        if (!this._thread)
            return false;

        const info = await this.room!.game.getUser(this._thread, this.room!.id, false);
        if (!info)
            return false;

        this.setInfo(info);

        return true;
    }

    private setInfo(info: any) {
        this._name = info.name;
        this._avatar = info.avatar;
        this._country = info.country;
        this._cash = info.cash;
        this._chips = info.chips;
        this._id = info.token;
        this._mode = info.mode;
        this._joiningDate = info.joiningDate;
        this._rating = info.rating;
        this._freeBalance = (info.free_balance !== undefined) ? info.free_balance : info.cash;
        this._migratePlayer = info.isMigratePlayer;
        this._isWaitingPlayer = info.isWaitingPlayer;
        this._globalBalance = info.cash;
        
        if(info.tableBalance !== undefined && info.tableBalance > 0)
            this._tableBalance = info.tableBalance;
    }

    protected onStart() {
        this.listenTable();

        if (this.room?.options.mode !== 'tournament') {
            this.updateInfo();
        }
    }

    protected async onLeave() {
        await delay(1000);
        await this.sendPlayerLeaveReq();

        this.removeAllSockets();
        this.unlistenTable();
    }

    private async sendPlayerLeaveReq() {
        if (this.room?.options.mode === 'tournament' && this.exitReason.type !== 'migrate') {
            if(this.exitReason.type === 'observation_leave')
                return this.send('REQ_PLAYER_LEAVE',  {type: "double_browser_leave", msg: getErrorMessage("userRegister")});
            
            if(this.table?.isWaitingEndroundRes)
            {
                    await new Promise((resolve, reject) => {
                        this.room?.on('end_round_finished', resolve);
                    });
            }
  
            const {status, hasWin, prize, rank, isRegister,register_amount} = await this.room.game.getTournamentResult(this.room.options.tournament_id!, this._id);

            if(status) {
                
                this.send('REQ_PLAYER_LEAVE', {type: 'tournament_leave', rank,id:this._id, prize, hasWin, isRegister,register_amount, tournament_id: this.room.options.tournament_id!});
                return;
            }
        }

        this.send('REQ_PLAYER_LEAVE', this.exitReason ?? {});
    }

    private listenTable() {
        this.table!
            .on('leave', this.onTableLeave)
            .on('sitdown', this.onTableSitDown)
            .on('buyin', this.onTableBuyIn)
            .on('start', this.onRoundStart)
            .on('turn', this.onRoundNewTurn)
            .on('updateturn', this.onRoundUpdateTurn)
            .on('action', this.onRoundAction)
            .on('result', this.onRoundResult)
            .on('showcards', this.onRoundShowCards)
            .on('showcardsbtn', this.onRoundShowCardsBtn)
            .on('foldanybet', this.onTableFoldAnyBet)
            .on('muckcards', this.onRoundMuckCards)
            .on('end', this.onRoundEnd)
            .on('message', this.onMessage)
            .on('cancel_bet', this.onCancelBet)
            .on('serverdisconn', this.onServerDisconnected)
            .on('errorreport',this.onErrorReport)
            .on('reconnectfailed', this.onServerReconnectFailed)
            .on('animation', this.onAnimation)
            .on('closeTable', this.onCloseTable)
            .on('levelchange', this.onTournamentLevelChanged)
            .on('waitlist', this.onCashWaitList)
            .on('waitforbb', this.onWaitForBB)
            .on('log', this.onLog)
            .on('chat', this.onTableChat)
			.on('showadminmessage', this.onShowAdminMessage)
            .on('tip', this.onTipToDealer)
            .on('showCancelTime',this.onShowTournamentCancelTime)
            .on('missedsidebet', this.onSidebetCheckPending);
    }

    protected _onInsurance = (data: { status: boolean, seatIndex: number, data: any }) => {
        if (data.status == false) {
            this.send('REQ_INSURANC', data);
        } else if (data.seatIndex == this.seat?.index) {
             this.sendSidePots();
             this.sendTableStatus();
            this.send('REQ_INSURANC', { status: data.status, data: data.data });
        }
    }

    private onMessage = (seat: TableSeat, status: boolean, msg: string, ) => {
        if(seat.index == this.seat?.index) {
            this.send('REQ_MESSAGE', {status: status, msg: msg});
        }
    };
    private onCancelBet = (seat: TableSeat) => {
        if(seat.index == this.seat?.index) {
            this.send('REQ_CANCEL_BET');
        }
    };

    private onServerDisconnected = () => {
        this.send('REQ_MESSAGE', {status: false, msg:  getErrorMessage("reconnect")});
    }

    private onErrorReport = () => {
        this.send('REQ_MESSAGE', {status: false, msg:  getErrorMessage("errorReport")});
    }

    private onServerReconnectFailed = () => {
        this.send('REQ_MESSAGE', {status: false, msg:  getErrorMessage("serverReconnectError")});
    }

    private onAnimation = (data:any) => {
        this.send('REQ_Animation', data);
    };

    private onCloseTable = (deleteTable:boolean) => {
        const msg = this.room?.options.mode === "cash" ?  getErrorMessage("closeTable") :  getErrorMessage("closeTournament");
        if(deleteTable == true)
            this.send('REQ_PLAYER_LEAVE',  {type: "double_browser_leave", msg:msg});
        else
            this.send('REQ_MESSAGE', { status: false, msg: msg });
       
        this.sendTableSettings();
        this.sendTableStatus();
        //this.sendTurn();
    };

    public sendMessage(status: boolean, msg: string,data?:any) {
        this.send('REQ_MESSAGE', {status: status, msg: msg,data: data});
    }

    public onTourneyInfo(data: playerPosition,averageStack:string,biggestStack:string) {

        this.send('REQ_TOURNEY_INFO', {position: data.position, number: data.number,averageStack:averageStack,biggestStack:biggestStack})
        this.socketLog(`REQ_TOURNEY_INFO :  ${JSON.stringify(data).toString()}`);
    }

    public setBuyInPanelVisible(minBuyIn: number) {
        this.send('REQ_TABLE_BUYIN', minBuyIn);
    }

    private onShowTournamentCancelTime = () => {  
        if(this.room?.options.mode === "cash")
            return;
	    
        this.send('REQ_Tournament_Cancel_Time', {status:!this.table?.roundEnabled,cancelWaitingTime:this.table?.getTournamentCancelTime()});
    }

    public onGenerateHashAndRandomString = () => {        
        if(this.seat?.state !== TableSeatState.Playing || !this.table?.options.isEncryptedShuffling)
            return;

            this.send('REQ_PLAYER_GENERATE_HASH_AND_RANDOM_STRING');
    }

    public onGetPlayerRandomString = () => {        
        this.send('REQ_PLAYER_RANDOM_STRING');
    };

    protected _onSendAllHashesToPlayers = (hashes:string) => {
        this.send('REQ_ALL_Hashes',hashes);
    };

    protected _onVerifyJsonString = (data:{jsonString:string,seed:string,pfCount:number,commonCards:Card[]}) => {
        const jsonString = JSON.parse(data.jsonString);
        const index = this.seat?.index;        
        if(!!jsonString['randomStrings'][index!] && !!jsonString['hashes'][index!])
            this.send('REQ_VERIFY_JSON_STRING',data);
    };

    public connect(socket: Socket, shouldMTMode: boolean) {
        if (!this.addSocket(socket, shouldMTMode))
            return;

        this.log(`Player(${this._name}) is connected using socket(${socket.id}).`);

        this.sendInfo();
        this.sendGameSetting();
        this.sendTableSettings();
        this.sendTableStatus();
        this.sendTurn();
        this.sendSidePots();
        this.sendPlayerState();
        this.updateFreeBalance(this._freeBalance);
        this.onShowTournamentCancelTime();

        if (this.state === PlayerState.SitOut)
            this.sitIn();

        if (this._sockets.size === 1) {
            this.log(`Player(${this._name}) is now online.`);
            this.online();
        }
    }

    private addSocket(socket: Socket, shouldMTMode: boolean) {
        const currentSocket = this._sockets.get(this._id);
        if (currentSocket !== undefined) {
            if (currentSocket.id === socket.id)
                return;

            this.log(`closed old socket ${currentSocket.id}`);
            currentSocket.emit('REQ_PLAYER_LEAVE', shouldMTMode ? {} : {type: "double_browser_leave", msg:  getErrorMessage("anotherBrowserConnection")});

            currentSocket
                .removeAllListeners('disconnect')
                .removeAllListeners('REQ_PLAYER_LEAVE')
                .removeAllListeners('REQ_PLAYER_LEAVEGAME')
                .removeAllListeners('REQ_PLAYER_INFO')
                .removeAllListeners('REQ_PLAYER_SITDOWN')
                .removeAllListeners('REQ_PLAYER_BUYIN')
                .removeAllListeners('REQ_PLAYER_ACTION')
                .removeAllListeners('REQ_PLAYER_SHOWCARDS')
                .removeAllListeners('REQ_PLAYER_WAITFORBB')
                .removeAllListeners('REQ_PLAYER_SITOUTNEXTHAND')
                .removeAllListeners('REQ_PLAYER_SITOUT')
                .removeAllListeners('REQ_PLAYER_SITIN')
                .removeAllListeners('REQ_PLAYER_JOINWAITLIST')
                .removeAllListeners('REQ_PLAYER_SIDEBET')
                .removeAllListeners('REQ_PLAYER_ACCEPT_INSURANCE')
                .removeAllListeners('REQ_PRE_FLOP_AUTO_FOLD')
                .removeAllListeners('REQ_SHARE_HAND')
                .removeAllListeners('REQ_TIP_DEALER')
                .removeAllListeners('REQ_PLAYER_SUBMIT_REPORT')
                .removeAllListeners('REQ_PLAYER_HASH')
                .removeAllListeners('REQ_PLAYER_RANDOM_STRING')
                .removeAllListeners('REQ_PRE_VERIFY_SHUFFLING')
                .removeAllListeners('REQ_PLAYER_GAME_SETTING')
                .removeAllListeners('REQ_PLAYER_SIDE_GAME_RANDOM_STRING')
                .removeAllListeners('REQ_PLAYER_CHAT');

            // currentSocket.disconnect();
            this._sockets.delete(this._id);
            this.table?.setSeatFoldAtTurn(this.seat)
        }

        socket
            .on('disconnect', () => this.onSocketDisconnect(socket))
            .on('REQ_PLAYER_LEAVE', () => this.onRequestLeave())
            .on('REQ_PLAYER_LEAVE_MT', () => this.onRequestLeaveMT())
            .on('REQ_PLAYER_LEAVEGAME', () => this.onRequestLeaveGame())
            .on('REQ_PLAYER_INFO', (ack) => this.onRequestInfo(ack))
            .on('REQ_PLAYER_SITDOWN', (data, ack) => this.onRequestSitDown(data, ack))
            .on('REQ_PLAYER_BUYIN', (data, ack) => this.onRequestBuyIn(data, ack))
            .on('REQ_PLAYER_TRANSFER', (data, ack) => this.onRequestTransfer(data, ack))
            .on('REQ_PLAYER_ACTION', (data, ack) => this.onRequestAction(data, ack))
            .on('REQ_PLAYER_SHOWCARDS', () => this.onRequestShowCards())
            .on('REQ_PLAYER_WAITFORBB', (data, ack) => this.onRequestWaitForBB(data, ack))
            .on('REQ_PLAYER_SITOUTNEXTHAND', (data, ack) => this.onRequestSitOutNextHand(data, ack))
            .on('REQ_PLAYER_SITOUT', (ack) => this.onRequestSitOut(ack))
            .on('REQ_PLAYER_SITIN', (ack) => this.onRequestSitIn(ack))
            .on('REQ_PLAYER_JOINWAITLIST', (ack) => this.onRequestJoinWaitlist(ack))
            .on('REQ_PLAYER_HITGAME01', (data, ack) => this.onRequestHitGame01(data, ack))
            .on('REQ_PLAYER_DEALGAME02', (data, ack) => this.onRequestDealGame02(data, ack))
            .on('REQ_PLAYER_SIDEBET', (data, ack) => this.onRequestSidebet(data, ack))
            .on('REQ_PLAYER_ACCEPT_INSURANCE', (data, ack) => this.onRequestInsurance(data, ack))
            .on('REQ_PRE_FLOP_AUTO_FOLD', (data, ack) => this.onRequestPreFlopAutoFold(data, ack))
            .on('REQ_TIP_DEALER', (data, ack) => this.onTipDealer(data, ack))
            .on('REQ_SHARE_HAND', (data, ack) => this.onRequestShareHand(data, ack))
            .on('REQ_PLAYER_SUBMIT_REPORT', (data, ack) => this.onRequestSubmitReport(data, ack))
            .on('REQ_PLAYER_HASH',(data)=> this.onPlayerHash(data))
            .on('REQ_PLAYER_RANDOM_STRING',(data)=> this.onPlayerRandomstring(data))
            .on('REQ_PRE_VERIFY_SHUFFLING',(data)=> this.onPlayerVerifyshuffling(data))
            .on('REQ_PLAYER_GAME_SETTING',(data)=>this.onPlayerGameSetting(data))
            .on('REQ_PLAYER_SIDE_GAME_RANDOM_STRING',(data)=>this.onPlayerSideGameRandomstring(data))
            .on('REQ_PLAYER_CHAT', (data, ack) => this.onRequestChat(data, ack));

        this._sockets.set(this._id, socket);

        return true;
    }

    protected onState() {
        this.sendPlayerState();
    }

    private sendInfo() {
        const info = {
            name: this._name,
            avatar: this._avatar,
            country: this._country,
            globalBalance: this._globalBalance,
            tableBalance: this._tableBalance,
            chips: this._chips,
            joiningDate: this._joiningDate,
            rating:this._rating
        };

        this.send('REQ_PLAYER_INFO', info);
        this.socketLog(`REQ_PLAYER_INFO :  ${JSON.stringify(info).toString()}`);
    }

    private sendGameSetting(){
        this.send('REQ_PLAYER_GAME_SETTING', this._playerSetting);
    }

    private sendPlayerState() {
        this.send('REQ_PLAYER_STATE', { state: PlayerState[this.state] });
        this.socketLog(`REQ_PLAYER_STATE : ${JSON.stringify({ state: PlayerState[this.state] }).toString()}`);
    }

    private sendTableSettings() {
        this.send('REQ_TABLE_SETTINGS', this.table!.getSettings());
        this.socketLog(`REQ_TABLE_SETTINGS : ${JSON.stringify(this.table!.getSettings()).toString()}`);
    }

    public updateFreeBalance(balance: number) {
        super.updateFreeBalance(balance);
        
        this.send('REQ_TABLE_FREE_BALANCE', balance);
        this.socketLog(`REQ_TABLE_FREE_BALANCE : ${balance}`);
    }

    protected onSideBetOptions(street?: SideBetState, options?: ({betName: string, ratio: number, note: string} | null)[]) {

        if(!this.table?.options.sideBetEnabled)
            return;
        
        if (!street && !options) {
            this.send('REQ_SIDEBET_OPTIONS', {});
            return;
        }

        this.send('REQ_SIDEBET_OPTIONS', {street: street, streetText: SideBetState[street!], options});
        this.socketLog(`REQ_SIDEBET_OPTIONS : ${JSON.stringify({street: SideBetState[street!], options}).toString()}`);
    }

    protected onTableSideBetEvaluate(reward: number, historyLists: SideBetResult[], results: SideBetResult[]) {
        this.send('REQ_SIDEBET_HISTORY', { totalReward: reward, historyLists: historyLists, results, unclaimed: this.sidebetUnclaimed });
    }

    private onRequestShareHand = (data: any, ack: any) => {
        var todayDate = moment(new Date()).format("YYYY/MM/DD");
        const round_id = this.room!.id + '_' + this.table!.round
        let encryptText = encrypt(generateRandomString() + `user_id=${this._id}&date=${todayDate}&round_id=${round_id}`);
        if (encryptText) {
            return ack?.(JSON.stringify({ encryptText: encryptText }));
        }
    }
    private onRequestSubmitReport = async (arg: {type: string, description:string, seat:number}, ack: any) => {
        const seat = this.table!.getSeatAt(arg.seat);

        const { status, msg } = await this.room!.game.submitReport(this.room!.id, this._id, arg.type, arg.description, this.table!.round, (seat!.player as Player).id);

        return ack?.(JSON.stringify({ status: status, msg:msg }));
    }

    private onPlayerHash(hash:string){
      this.table?.setPlayerHash(this.seat!,hash);
      this.emit('get_player_hash');
    }

    private onPlayerRandomstring(randomstring:string){
        this.table?.setPlayerRandomString(this.seat!,randomstring);
        this.emit('get_player_random_string');
    }

    private onPlayerSideGameRandomstring(arg:{value:string}){
       
        this.emit('get_player_side_game_random_string',arg.value);
    }

    private onPlayerVerifyshuffling(data:{value:string})
    {
       this.log(data.value);
    }

    private onPlayerGameSetting(data:{setting:string,value:boolean})
    {
        this._playerSetting[data.setting] = data.value;
    }

    private async onTipDealer(arg: { amount: number }, ack: any) {

        const bigBlind = (this.table?.bigBlind || 0);
        const amount = (arg.amount || 0) * bigBlind;

        
        if(Number(this.seat!.money) < amount || this.seat?.state != TableSeatState.Playing)
        {
            this.send('REQ_MESSAGE', { status: false, msg: `Player(${this._name}) insufficient cash for tip` });
            return ack?.(JSON.stringify({ status: false }));
        }

        const { status } = await this.room!.game.SubmitTipDealer(this.room!.id, this._id, amount, this.table!.round);
        if (status == true) {
            this.table!.logTipDealer(this.seat?.index!,this._id, amount);
            this.seat!.context.money = floor4(Number(this.seat!.context.money) - amount);
            this.seat!.money = floor4(Number(this.seat!.money) - amount);
           // this.sendTableStatus();
            this.emit('tip', {msg: `Thank You ${this.seat?.player?.name} for ${arg.amount} BB Tips`,seat:this.seat?.index!});
            return ack?.(JSON.stringify({ status: status, name: this.seat?.player?.name}));
        } else {
            this.send('REQ_MESSAGE', { status: status, msg:  getErrorMessage("tipsError") });
        }
		return ack?.(JSON.stringify({ status: false }));
    }

    private async onRequestHitGame01(arg: {bbRatio:number,hash?:string}, ack: any) {
        if (!this.table?.options.sideGameEnabled) {
            this.send('REQ_MESSAGE', { status: false, msg:  getErrorMessage("hideSidegame") });
            return ack?.(JSON.stringify({ status: false }));
        }
        var ratio = arg.bbRatio;
        var shuffleKey = undefined;
        var jsonString = undefined;

        if(this.table.options.isEncryptedShuffling)
        {
            if(!arg.hash) {
                this.send('REQ_MESSAGE', { status: false, msg: 'player not send hash' });
                return ack?.(JSON.stringify({ status: false }));
            } 
            var allHashes:any ={};
            var allRandomStrings:any = {};
            var playerRandomStrings:any = {};
            var playerHashes:any = {};

            const {randomString,hash} = generateHashAndServerString();
            const botHashAndServerString = generateHashAndServerString();
            const seatIndex = String(this.seat?.index);
            allHashes = {"server":hash,"bot":botHashAndServerString.hash};
            allRandomStrings = {server:randomString,bot:botHashAndServerString.randomString,seatIndex:""};
            playerRandomStrings = {bot:botHashAndServerString.randomString}
            playerHashes = {bot:botHashAndServerString.hash};

            allHashes[seatIndex] = arg.hash;
            this.send('REQ_ALL_Hashes',allHashes);
            // Each user sends their random string to the server

            const randomstringStatus = await new Promise((resolve, reject) => {
                const setTimeoutId = setTimeout(() => {
                    this.send('REQ_MESSAGE', { status: false, msg:  getErrorMessage("timeout") });
                    resolve(false);
                }, 2000);
                    
                const player = (this.seat!.player as Player);
                player.on('get_player_side_game_random_string', (randomstring?:string) => {
                    if(!!setTimeoutId)
                        clearTimeout(setTimeoutId);
                    
                    resolve(randomstring);
                });
                this.send('REQ_PLAYER_SIDE_GAME_RANDOM_STRING',{});
            });
            if(!randomstringStatus) return;

            allRandomStrings[seatIndex] = randomstringStatus;
            playerRandomStrings[seatIndex] = randomstringStatus;
          
            playerHashes[seatIndex] = arg.hash;
            const { status, message,players } = verifyAllUserHashes(playerRandomStrings,playerHashes);           
            if(!status)
            {
                for (let index = 0; index < players.length; index++) {
                const player = players[index];
                if(player === "bot" || player === "server")
                    continue;
                
                    this.send('REQ_MESSAGE', { status: false, msg:  getErrorMessage("wronghashError") });
                    this.table.emit('reportplayer',this.seat,'mismatch_side_gamehash');
                    
                }
                return;
            }   
                        // Server generates JSON string and shuffle key     
            const generateKey = generateJSONAndShuffleKey(allRandomStrings,allHashes);
            this.log(`side game : shuffleKey :${generateKey.shuffleKey}, jsonString : ${generateKey.jsonString}`);
            jsonString = generateKey.jsonString;
            shuffleKey = generateKey.shuffleKey;            

        }
        
        let data = {} as any;
        
        let bigBlind = (this.table?.bigBlind || 0);
        if(this.room?.options.mode === "tournament")
        {
            bigBlind = 1;
            ratio = ratio * 1;
        }

        const {status, betId, freeBalance} = await this.room!.game.submitSideGame(this.room!.id, this._id, ratio * bigBlind, 'game01',this.room?.options.mode,this.room?.options.tournament_id);
        data = { freeBalance };

        if (!status) {
            this.send('REQ_MESSAGE', { status: false, msg:  getErrorMessage("insufficientBalance")});
            return ack?.(JSON.stringify({ status: false }));
        }

        this.updateFreeBalance(freeBalance);

        const hitResult = hit(shuffleKey);
        data = {
            ...data,
            status: true,
            ...hitResult,
            winningRatioBB: hitResult.winningOdd * ratio
        };

        if (data.winningRatioBB > 0) {
            const {status, freeBalance} = await this.room!.game.submitSideGameResult(this.room!.id, this._id, betId, data.winningRatioBB * bigBlind, this.table!.round,this.room?.options.mode,this.room?.options.tournament_id);
            data = { ...data, freeBalance };
        }
        if(this.table.options.isEncryptedShuffling && !!shuffleKey)
        this._onVerifyJsonString({jsonString:jsonString!,seed:shuffleKey,pfCount:2 * 2,commonCards:data.tableCards});

        return ack?.(JSON.stringify(data));
    }

    private async onRequestDealGame02(arg: {bbRatio:number,hash?:string}, ack: any) {
        if (!this.table?.options.sideGameEnabled) {
            this.send('REQ_MESSAGE', { status: false, msg:  getErrorMessage("hideSidegame") });
            return ack?.(JSON.stringify({ status: false }));
        }

        var ratio = arg.bbRatio;
        var shuffleKey = undefined;
        var jsonString = undefined;

        if(this.table.options.isEncryptedShuffling)
        {
            if(!arg.hash) {
                this.send('REQ_MESSAGE', { status: false, msg: 'player not send hash' });
                return ack?.(JSON.stringify({ status: false }));
            } 

            var allHashes:any ={};
            var allRandomStrings:any = {};
            var playerRandomStrings:any = {};
            var playerHashes:any = {};

            const {randomString,hash} = generateHashAndServerString();
            const seatIndex = String(this.seat?.index);
            allHashes = {"server":hash};
            allRandomStrings = {server:randomString};
            allHashes[seatIndex] = arg.hash;
            this.send('REQ_ALL_Hashes',allHashes);

            
            // Each user sends their random string to the server

            const randomstringStatus = await new Promise((resolve, reject) => {
                const setTimeoutId = setTimeout(() => {
                    this.send('REQ_MESSAGE', { status: false, msg: getErrorMessage("timeout") });
                    resolve(false);
                }, 2000);
                    
                const player = (this.seat!.player as Player);
                player.on('get_player_side_game_random_string', (randomstring?:string) => {
                    if(!!setTimeoutId)
                        clearTimeout(setTimeoutId);
                    
                    resolve(randomstring);
                });
                this.send('REQ_PLAYER_SIDE_GAME_RANDOM_STRING',{});
            });
            if(!randomstringStatus) return;

            allRandomStrings[seatIndex] = randomstringStatus;
            playerRandomStrings[seatIndex] = randomstringStatus;
            playerHashes[seatIndex] = arg.hash;
            const { status, message,players } = verifyAllUserHashes(playerRandomStrings,playerHashes);           
            if(!status)
            {
                for (let index = 0; index < players.length; index++) {
                const player = players[index];
                if(player === "server")
                    continue;
                
                this.send('REQ_MESSAGE', { status: false, msg:  getErrorMessage("wronghashError") });
                this.table.emit('reportplayer',this.seat,'mismatch_side_gamehash');
                    
                }
                return;
            }   
                        // Server generates JSON string and shuffle key     
            const generateKey = generateJSONAndShuffleKey(allRandomStrings,allHashes);
            this.log(`side game : shuffleKey :${generateKey.shuffleKey}, jsonString : ${generateKey.jsonString}`);
            jsonString = generateKey.jsonString;
            shuffleKey = generateKey.shuffleKey;            

        }

        let data = {} as any;
        let bigBlind = (this.table?.bigBlind || 0);
        if(this.room?.options.mode === "tournament")
        {
            bigBlind = 1;
            ratio = ratio * 1;
        }

        const {status, betId, freeBalance} = await this.room!.game.submitSideGame(this.room!.id, this._id, ratio * bigBlind, 'game02',this.room?.options.mode,this.room?.options.tournament_id);
        data = { freeBalance };

        if (!status) {
            this.send('REQ_MESSAGE', { status: false, msg:  getErrorMessage("insufficientBalance")});
            return ack?.(JSON.stringify({ status: false }));
        }
        this.updateFreeBalance(freeBalance);
        
        const dealResult = dealMe(shuffleKey);

        data = {
            ...data,
            status: true,
            ...dealResult,
            winningRatioBB: dealResult.winningOdd * ratio / 2
        };

        if (data.winningRatioBB > 0) {
            const {status, freeBalance} = await this.room!.game.submitSideGameResult(this.room!.id, this._id, betId, data.winningRatioBB * bigBlind, this.table!.round,this.room?.options.mode,this.room?.options.tournament_id);
            data = { ...data, freeBalance };
        }
        if(this.table.options.isEncryptedShuffling && !!shuffleKey)
            this._onVerifyJsonString({jsonString:jsonString!,seed:shuffleKey,pfCount:1*2,commonCards:data.tableCards});

        return ack?.(JSON.stringify(data));
    }

    private onTournamentLevelChanged = () => {
        this.sendTableSettings();
    }

    private onCashWaitList = (players: Player[]) => {
        this.send('REQ_TABLE_WAITLIST', players.map(player => player.name));
    }

    private onWaitForBB = (seat: TableSeat, waitForBB: boolean) => {
        if(seat.index == this.seat?.index) {
            this.send('REQ_TABLE_WAITFORBB', waitForBB);
        }
    }

    private onSidebetCheckPending = (state: SideBetState) => {
        if (!this.hasSidebet(state)) return;

        if (this.hasSidebet(SideBetState.PreCards) && state === SideBetState.PreCards) {
            const handCards = this.table?.getSeatCards(this.seat?.index!);
            this.send('REQ_PLAYER_CARD', handCards);
        }
        else {
            const status = this.table?.getStatus();
            this.send('REQ_TABLE_CARD', status?.cards);
        }
    }
    
    private onLog = (data:{log: string,isNewRound?:boolean,seat?:number}) => {
        this.send('REQ_TABLE_LOG', data);
    }

    private onTableChat = (data: {playerName:string,msg:string,seat:number}) => {
        this.send('REQ_TABLE_CHAT', data);
    }
    private onTipToDealer = (data:any) => {
        if(data.seat === this.seat?.index)
            data.money = this.seat?.money;
        
        this.send('REQ_TABLE_TIP', data);
    }
    private onShowAdminMessage = (message:string) => {
        this.send('REQ_MESSAGE', { status: false, msg: message, data:{ labelText:"Message"} });
    }

    private onSocketDisconnect(socket: Socket) {
        this.log(`Player(${this._name}) is disconnected from socket(${socket.id}).`);
        this.socketLog(`Player(${this._name}) is disconnected from socket(${socket.id}).`);
        this._sockets.delete(this._id);

        if (this._sockets.size === 0) {
            this.log(`Player(${this._name}) is now offline.`);

            this.offline();
        }
    }

    private onRequestLeave() {
        if(this.room?.options.mode === "tournament")
            return false;
        
        this.socketLog('Client to TS : REQ_PLAYER_LEAVE');
        this.leave({ type: 'self' });
    }

    private onRequestLeaveMT() {
        this.socketLog('Client to TS : REQ_PLAYER_LEAVE_MT');
        this.room?.game.notifyLeaveMT(this._id, this.room.id);
    }
    
    private onRequestLeaveGame() {
        this.socketLog('Client to TS : REQ_PLAYER_LEAVEGAME');

        if(this.room?.options.mode === "tournament")
            return false;

        this.table?.addSelfOutPlayer(this.seat);

        if (this.table?.getOnePlayerRemainingSeat() !== this.seat?.index) {
            this.leave();
        }
        else
            this._pendingLeaveTable = true;
    }

    private onTableLeave = (seat: TableSeat) => {
        this.sendTableStatus();
        this.sendTurn();
        this.sendSidePots();
    };

    private removeAllSockets() {
        this._sockets.forEach(socket => {
            socket
                .removeAllListeners('disconnect')
                .removeAllListeners('REQ_PLAYER_LEAVE')
                .removeAllListeners('REQ_PLAYER_LEAVE_MT')
                .removeAllListeners('REQ_PLAYER_LEAVEGAME')
                .removeAllListeners('REQ_PLAYER_INFO')
                .removeAllListeners('REQ_PLAYER_SITDOWN')
                .removeAllListeners('REQ_PLAYER_BUYIN')
                .removeAllListeners('REQ_PLAYER_ACTION')
                .removeAllListeners('REQ_PLAYER_SHOWCARDS')
                .removeAllListeners('REQ_PLAYER_WAITFORBB')
                .removeAllListeners('REQ_PLAYER_SITOUTNEXTHAND')
                .removeAllListeners('REQ_PLAYER_SITOUT')
                .removeAllListeners('REQ_PLAYER_SITIN')
                .removeAllListeners('REQ_PLAYER_JOINWAITLIST')
                .removeAllListeners('REQ_PLAYER_CHAT')
                .removeAllListeners('REQ_PLAYER_HASH')
                .removeAllListeners('REQ_PLAYER_RANDOM_STRING')
                .removeAllListeners('REQ_PRE_VERIFY_SHUFFLING')
                .removeAllListeners('REQ_PLAYER_GAME_SETTING')
                .removeAllListeners('REQ_PLAYER_SIDE_GAME_RANDOM_STRING')
                .removeAllListeners('REQ_PLAYER_ACCEPT_INSURANCE')
                .removeAllListeners('REQ_PRE_FLOP_AUTO_FOLD')
                .removeAllListeners('REQ_SHARE_HAND')
                .removeAllListeners('REQ_TIP_DEALER')
                .removeAllListeners('REQ_PLAYER_SUBMIT_REPORT')
                .removeAllListeners('REQ_PLAYER_SIDEBET');
        });
        this._sockets.clear();
    }

    private unlistenTable() {
        this.table!
            .off('leave', this.onTableLeave)
            .off('sitdown', this.onTableSitDown)
            .off('buyin', this.onTableBuyIn)
            .off('start', this.onRoundStart)
            .off('turn', this.onRoundNewTurn)
            .off('action', this.onRoundAction)
            .off('result', this.onRoundResult)
            .off('showcards', this.onRoundShowCards)
            .off('showcardsbtn', this.onRoundShowCardsBtn)
            .off('foldanybet', this.onTableFoldAnyBet)
            .off('muckcards', this.onRoundMuckCards)
            .off('end', this.onRoundEnd)
            .off('serverdisconn', this.onServerDisconnected)
            .off('reconnectfailed', this.onServerReconnectFailed)
            .off('errorreport',this.onErrorReport)
            .off('message', this.onMessage)
            .off('waitlist', this.onCashWaitList)
            .off('waitforbb', this.onWaitForBB)
            .off('animation', this.onAnimation)
            .off('closeTable', this.onCloseTable)
            .off('levelchange', this.onTournamentLevelChanged)
			.off('showadminmessage', this.onShowAdminMessage)
            .off('tip', this.onTipToDealer)
            .off('showCancelTime',this.onShowTournamentCancelTime)
	    .off('cancel_bet', this.onCancelBet)
            .off('missedsidebet', this.onSidebetCheckPending);
    }

    private async onRequestInfo(ack?: (status: boolean) => void) {
        this.socketLog('Client to TS : REQ_PLAYER_INFO');
        const result = await this.updateInfo();
        if (result)
            this.sendInfo();
        ack?.(result);
    }

    private async onRequestSitDown(arg: { seat: number; }, ack?: (status: boolean) => void) {
        if(this.table?.options.isRandomTable)
            return false;
        
        const seatIndex = Number(arg.seat);
        if (this.table!.isClosed === true) {
            this.send('REQ_MESSAGE', { status: false, msg:  getErrorMessage("closeTable")});
            return false;
        }

        const {status, globalBalance} = await this.room!.game.getGlobalBalance(this._id);
        this._globalBalance = globalBalance;
        this.sendInfo();
        this.socketLog(`Client to TS : REQ_PLAYER_SITDOWN ${JSON.stringify({ seat: seatIndex}).toString()}`);
        this.sitDown(seatIndex);
        ack?.(this.seat !== undefined);
        this.log(`***Socket*** Player(${this._name}) sit down on Seat (${seatIndex}) and ${this.seat !== undefined}`);
    }

    private onTableSitDown = (seat: TableSeat) => {
        this.sendTableStatus();
        this.sendTurn();
        this.sendSidePots();
    };

    private async onRequestBuyIn(arg: { amount: number; autoTopUpLess?: boolean; autoTopUpZero?: boolean}, ack?: (jsonStr: string) => void) {
        let amount = Number(arg.amount);

        if (this.table!.isClosed === true) {
            this.table?.leave(this.seat!);
            var totalPlayers = this.table?.getSeats().filter(seat=> seat.state !== TableSeatState.Empty).length;
            console.log(`onRequestBuyIn totalPlayers : ${totalPlayers}`);
            
            if(totalPlayers != undefined && totalPlayers <= 1)
                this.table?.scheduleNewRound();

            this.send('REQ_MESSAGE', { status: false, msg: getErrorMessage("closeTable")});
            return false;
        }
        
        if (amount === 0) {
            if (this.sidebetUnclaimed) {
                const handCards = this.table?.getSeatCards(this.seat?.index!);
                this.send('REQ_PLAYER_SIDEBETCARD', handCards)
            }
            
            this.table?.leave(this.seat!);

            return;
        }

        this.socketLog(`Client to TS : REQ_PLAYER_BUYIN ${JSON.stringify({ amount: amount, autoTopUpLess: Boolean(arg.autoTopUpLess ?? false), autoTopUpZero: Boolean(arg.autoTopUpZero ?? false)}).toString()}`);
        if (!await this.buyIn(amount)) {
            const message =  `Player (${this._name}) has insufficient cash for buy-in. Required:${amount}, available: ${this._cash}. Buy-in discarded.`;
            this.send('REQ_MESSAGE', {status: false, msg: message});

            if (this.seat?.money === 0 || !this.seat?.money) // when add more chips with chips in hands, no kick 
                this.table?.leave(this.seat!);
            return ack?.(JSON.stringify({status: false, message: message}));
        }

        this.log(`Player(${this._name}) buy-in success. buyin: ${amount}, money: ${this.seat?.money}, cash: ${this._cash}`);

        if (Boolean(arg.autoTopUpLess ?? false) || Boolean(arg.autoTopUpZero ?? false)) {
            this.setTopUp((this.seat?.money ?? 0));
            if (Boolean(arg.autoTopUpLess ?? false))
                this.setTopUpCase(AutoTopUpCase.LessThanBuyIn);
            else if (Boolean(arg.autoTopUpZero ?? false))
                this.setTopUpCase(AutoTopUpCase.OutOfChips);
        }
        else
            this.setTopUp();

        this._isSitIn = true;
        ack?.(JSON.stringify({status: true, message: ""}));
    }

    private async onRequestTransfer(arg: { amount: number;}, ack?: (jsonStr: string) => void) {
        let amount = Number(arg.amount);

        this.socketLog(`Client to TS : REQ_PLAYER_TRANSFER ${JSON.stringify({ amount: amount }).toString()}`);
        if (this.table!.isClosed === true) {
            this.send('REQ_MESSAGE', { status: false, msg: getErrorMessage("closeTable") });
            return ack?.(JSON.stringify({ status: false, message: getErrorMessage("closeTable") }));
        }
        const { status, transferedAmount, updatedGlobalBalance } = await this.room!.game.transferBalance(this.room!.id, this._id, amount);

        if (!status) {
            const message =  `Player (${this._name}) has insufficient global balance for transfer. Transfer amount: ${transferedAmount}, global balance: ${updatedGlobalBalance}. Transfer discarded.`;
            this.log(message);
            this.send('REQ_MESSAGE', {status: false, msg: message});

            return ack?.(JSON.stringify({status: false, message: message}));
        }

        this.globalBalance = updatedGlobalBalance;
        this.tableBalance = this.tableBalance + transferedAmount;

        this.log(`Player(${this._name}) transfer to table wallet success. transfer: ${transferedAmount}, global balance: ${updatedGlobalBalance}`);

        this._isSitIn = true;
        ack?.(JSON.stringify({status: true, message: "", updatedTableWalletBalance: this.tableBalance, updatedGlobalBalance}));
    }

    private async onRequestSidebet(arg: {street: number, sidebets: any,isHolePreCards?:boolean}, ack?: (jsonStr: string) => void) {
        let sidebets = arg.sidebets.map((sidebet: any) => {
            return {betName: String(sidebet).split('-')[0], amount: String(sidebet).split('-')[1]}
        });
        this.socketLog(`Client to TS : REQ_PLAYER_SIDEBET ${JSON.stringify({ bets: sidebets}).toString()}`);
       
        this.table?.setWaitingSideBetRes(this.seat!,true);
        await this.submitSidebet(arg.street, sidebets,arg.isHolePreCards);
        this.table?.setWaitingSideBetRes(this.seat!,false);
        this.emit('side_bet_finished');
        ack?.(JSON.stringify({status: true, sideBet: this._currentSideBets}));
    }

    private async onRequestInsurance(arg: { insuranceAmount: string, insuranceWinAmount: string }, ack?: (jsonStr: string) => void) {

       const status = await this.submitInsurance(Number(arg.insuranceAmount),Number(arg.insuranceWinAmount));
       ack?.(JSON.stringify({ status: status }));
    }

    private async onRequestPreFlopAutoFold(arg: { value: boolean }, ack?: (jsonStr: string) => void) {
        
        if (arg.value == true) {
            const { status, data } = await this.room!.game.getPreFlopAutoFoldInfo(this._id);
            return ack?.(JSON.stringify({ status: status, AutoFoldCards: data }));
        }
        ack?.(JSON.stringify({ status: arg.value, data: [] }));
    }

    public async deposit(amount: number) {
        // const playerBalance = await this.room!.game.getBalance(this._id);
        // if (playerBalance === undefined || playerBalance < amount) {
        //     await this.updateInfo();
        //     this.sendInfo();
        //     return false;
        // }

        const playerCash = await this.room!.game.deposit(this.room!.id, this._id, amount, this.table!.round);
        if (playerCash === undefined)
            return false;

        this.tableBalance -= amount;
        await this.updateInfo();
        this.sendInfo();
        return true;
    }

    private onTableBuyIn = (seat: TableSeat, amount: number) => {
        this.sendTableStatus();
        this.sendTurn();
        this.sendSidePots();
    };

    private sendTableStatus() {
        const status = this.table!.getStatus();

        const showdownSeats = new Set<number>(this.table!.getSeatsToShowCards().map(seat => seat.index));
        if (this.seat !== undefined)
            showdownSeats.add(this.seat.index);

        const statusForPlayer = {
            ...status,
            state: RoundState[status.state],
            seats: status.seats.map((seat, index) => ({
                ...seat,
                state: TableSeatState[seat.state],
                player: !seat.player ? undefined : { name: seat.player.name, avatar: seat.player.avatar, country: seat.player.country,joiningDate:seat.player.joiningDate,rating:seat.player.rating },
                // player should not to know about other's cards
                cards: showdownSeats.has(index) ? seat.cards : seat.cards?.map(() => '?'),
                handRank: showdownSeats.has(index) ? seat.handRank : undefined,
            })),
        };
        this.send('REQ_TABLE_STATUS', statusForPlayer);
        this.socketLog(`REQ_TABLE_STATUS : ${JSON.stringify(statusForPlayer).toString()}`);
    }

    private onRoundStart = (round: number) => {
        this.sendTableSettings();
        this.sendTableStatus();
        // this.sendTurn();
        this.sendSidePots();

        this._pendingLeaveTable = false;
    };

    protected _onTableRoundState = (state: RoundState) => {
        this.sendTableStatus();
        // this.sendTurn();
        this.sendSidePots();
    };

    private onRoundNewTurn = (turn?: number) => {
        this.sendTableStatus();
        this.sendTurn();
        this.sendSidePots();

        if (turn === undefined)
            return;

        if (turn === this.seat?.index && !this._sockets.size) { // offline in turn
            this.action('fold');
        }
    };

    private onRoundUpdateTurn = () => {
        this.send('REQ_TABLE_UPDATE_TURN', this.table!.getTurnContext());
    };

    private sendTurn() {
        this.send('REQ_TABLE_TURN', this.table!.getTurnContext());
        this.socketLog(`REQ_TABLE_TURN : ${JSON.stringify(this.table!.getTurnContext()).toString()}`);
    }

    private async onRequestAction(arg: { action: string; bet?: number; }, ack?: (status: boolean) => void) {
        const action = String(arg.action);
        const bet = Number(arg.bet ?? 0);

        this.socketLog(`Client to TS : REQ_PLAYER_ACTION ${JSON.stringify({ action: action, bet: bet}).toString()}`);
        this.action(action, bet);
        ack?.(true);
    }

    private onRoundAction = (seat: TableSeat, action: Action, bet?: number) => {
        this.sendTableStatus();
        this.sendSidePots();
    };

    private sendSidePots() {
        const pots = this.table!.getSidePots().map(pot => ({
            ...pot,
            seats: pot.seats.map(seat => seat.index)
        }));
        this.send('REQ_TABLE_SIDEPOTS', pots);
        this.socketLog(`REQ_TABLE_SIDEPOTS : ${JSON.stringify(pots).toString()}`);
    }

    private onRoundResult = () => {
        this.sendRoundResult();
    };

    private sendRoundResult() {
        const result = this.table!.getRoundResult();
        const onePlayerSeat = this.table?.getOnePlayerRemainingSeat();
        const sendInfo = {
            players: result?.players.map(seat => ({
                seat: seat.index,
                fold: seat.context.fold ?? false,
                bet: seat.context.bet ?? 0,
                prize: seat.prize ?? 0,
                hand: seat.index !== onePlayerSeat && seat.hand !== undefined ? {
                    cards: seat.hand.cards,
                    rank: HandRankName[seat.hand.rank],
                } : undefined,
            })),
            pots: result?.pots.map(pot => ({
                ...pot,
                winners: pot.winners.map(seat => seat.index),
            })),
        };
        this.send('REQ_TABLE_ROUNDRESULT', sendInfo);
        this.socketLog(`REQ_TABLE_ROUNDRESULT : ${JSON.stringify(sendInfo).toString()}`);

        const lastPlayers = sendInfo.players!.filter(player => {
            return !player.fold;
        });

        const seats = sendInfo.players!.map(player => player.seat);

        if (!!this.seat) {
            if (sendInfo.players!.length > 1 && lastPlayers.length == 1 && lastPlayers[0].seat == this.seat.index && seats.indexOf(this.seat.index) != -1)
                    this.send('REQ_TABLE_PLAYERSHOWCARDSBTN');


            if (this.seat.showcards){
                this.send('REQ_TABLE_PLAYERSHOWCARDSBTN');
                this.seat.showcards = false;
            }


        }

    }

    private onRoundShowCardsBtn(seat: TableSeat) {
        if (this.seat?.index === seat.index)
            this.send('REQ_TABLE_PLAYERSHOWCARDSBTN');
    }

    private onTableFoldAnyBet = (seat: TableSeat) => {
        if (this.seat?.index === seat.index)
            this.send('REQ_TABLE_FOLDANYBET');
    }

    private onRoundEnd = () => {
        if (!!this.seat) {
            if (!this._sockets.size)
                this.sitOut();
        }

        this.sendTableSettings();
        this.sendTableStatus();
        this.sendTurn();

        if (this._pendingLeaveTable) {
            this.leave();
            this._pendingLeaveTable = false;
        }
    };

    private onRequestShowCards() {
        this.socketLog(`Client to TS : REQ_PLAYER_SHOWCARDS`);
        this.showCards();
    }

    private onRoundShowCards = (seat: TableSeat) => {
        this.sendShowCards(seat);
    };

    private sendShowCards(seat: TableSeat) {
        if (!seat) return;

        var handrank = seat.hand?.rank
        const showcards = {
            seat: seat.context.index,
            avatar: seat.player?.avatar,
            cards: seat.context.cards,
            handrank : HandRankName[handrank ? handrank : 0]
        };

        this.send('REQ_TABLE_PLAYERSHOWCARDS', showcards);
        this.socketLog(`REQ_TABLE_PLAYERSHOWCARDS : ${JSON.stringify(showcards).toString()}`);
    }

    private onRoundMuckCards = (seat: TableSeat) => {
        const muckcards = {
            seat: seat.context.index,
        };

        this.send('REQ_TABLE_PLAYERMUCKCARDS', muckcards);
        this.socketLog(`REQ_TABLE_PLAYERMUCKCARDS : ${JSON.stringify(muckcards).toString()}`);

        this.onRoundShowCardsBtn(seat);

    };

    private async onRequestWaitForBB(arg: { value?: boolean; }, ack?: (status: boolean) => void) {
        const value = Boolean(arg.value ?? true);
        this.socketLog(`Client to TS: REQ_PLAYER_WAITFORBB ${JSON.stringify({value: value}).toString()}`);
        this.emit('waitforbb', value);
        ack?.(true);
    }

    private async onRequestSitOutNextHand(arg: { value?: boolean; }, ack?: (status: boolean) => void) {
        const value = Boolean(arg.value ?? true);
        this.socketLog(`Client to TS: REQ_PLAYER_SITOUTNEXTHAND ${JSON.stringify({value: value}).toString()}`);
        this.emit('sitoutnexthand', value);
        ack?.(true);
    }

    private async onRequestSitOut(ack?: (status: boolean) => void) {
        this.socketLog(`Client to TS: REQ_PLAYER_SITOUT`);
        this.sitOut();
        ack?.(true);
    }

    private async onRequestSitIn(ack?: (status: boolean) => void) {
        this.socketLog(`Client to TS: REQ_PLAYER_SITIN`);
        this.sitIn();
        this.sendTableStatus();
        this.sendTurn();
        this.sendSidePots();
        ack?.(true);
    }

    private async onRequestJoinWaitlist(ack?: (status: boolean) => void) {
        this.socketLog(`Client to TS: REQ_PLAYER_JOINWAITLIST`);
        this.emit('joinwaitlist');
        ack?.(true);
    }

    private onRequestChat(arg: {msg: string}, ack?: (status: boolean) => void) {
        this.socketLog(`Client to TS: REQ_PLAYER_CHAT ${arg.msg}`);
        this.playerChatMessage(arg.msg);
    }

    public send(ev: string, ...args: any[]) {
        this._sockets.forEach(socket => socket.emit(ev, ...args));
    }
}
