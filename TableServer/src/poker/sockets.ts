import { Server, Socket } from 'socket.io';
import { PlayerInfo } from '../services/game';
import { Room } from './room';
import { Player, PlayerState, AutoTopUpCase, TourneyInfo, UserMode, SideBetState } from './player';
import { RoundState, Action } from './round';
import { TableSeat, TableSeatState } from './table';
import winston from 'winston';
import { HandRank } from './card';
import { decrypt, delay, encrypt, generateRandomString } from '../services/utils';
import { update } from 'lodash';
import moment, { relativeTimeThreshold } from 'moment';
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

        let player: SocketPlayer | undefined;
        if (!!thread) {
            player = this.players.get(thread);
        }

        if (!player) {
            player = await this.addPlayer(mode, thread, userEncrypted);
        }

        if (!player)
            return;

        if (this.table.isClosed === true) {
            socket.emit('REQ_MESSAGE', { status: false, msg: "Table is closed" });
            return;
        }

        this.log(`Player accepted. token: ${player.id}, player: ${player.name}.`);

        player.connect(socket, !thread && !!userEncrypted);

        return player;
    }

    public async addPlayerByApi(playerinfo: any) {
        let info: any;
        info = { ...playerinfo, mode: UserMode.Player };

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
        let info: any;

        if (!!thread)
            info = await this.room.game.getUser(thread, this.room.id, false);
        else if (!!userEncrypted) {
            const { name, avatar, token, tables, created_at } = JSON.parse(decrypt(userEncrypted));
            const table = tables.find((table: any) => table.table_token === this.room.id);

            info = {
                name,
                avatar,
                token,
                main_balance: table.main_balance,
                chips: table.chips,
                created_at:  created_at
            }
        }
        if (!info)
            return;

        info = { ...info, mode: mode };

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

    constructor(logger: winston.Logger, thread?: string, info?: PlayerInfo) {
        super(logger);

        this._thread = thread;
        if (!!info)
            this.setInfo(info);
    }

    private socketLog(message?: any, ...optionalParams: any[]) {
        if (process.env.SOCKET_LOG !== "true")
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

    private setInfo(info: PlayerInfo) {
        this._name = info.name;
        this._avatar = info.avatar;
        this._cash = info.cash;
        this._chips = info.chips;
        this._id = info.token;
        this._mode = info.mode;
        this._created_at = info.created_at
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
            const { status, hasWin, prize, rank } = await this.room.game.getTournamentResult(this.room.options.tournament_id!, this._id);

            if (status) {
                this.send('REQ_PLAYER_LEAVE', { type: 'tournament_leave', rank, prize, hasWin });
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
            .on('state', this.onRoundState)
            .on('turn', this.onRoundNewTurn)
            .on('action', this.onRoundAction)
            .on('result', this.onRoundResult)
            .on('showcards', this.onRoundShowCards)
            .on('showcardsbtn', this.onRoundShowCardsBtn)
            .on('foldanybet', this.onTableFoldAnyBet)
            .on('muckcards', this.onRoundMuckCards)
            .on('end', this.onRoundEnd)
            .on('message', this.onMessage)
            .on('serverdisconn', this.onServerDisconnected)
            .on('animation', this.onAnimation)
            .on('insurance', this.onInsurance)
            .on('closeTable', this.onCloseTable)
            .on('levelchange', this.onTournamentLevelChanged)
            .on('waitlist', this.onCashWaitList)
            .on('log', this.onLog)
            .on('chat', this.onTableChat)
            .on('sidebet', this.onSideBetOptions);
    }

    private onInsurance = (data: { status: boolean, seat: TableSeat, data: any }) => {
        if (data.status == false) {
            this.send('REQ_INSURANC', data);
        } else if (data.seat.index == this.seat?.index) {
            this.send('REQ_INSURANC', { status: data.status, data: data.data });
        }
    }

    private onMessage = (seat: TableSeat, status: boolean, msg: string,) => {
        if (seat.index == this.seat?.index) {
            this.send('REQ_MESSAGE', { status: status, msg: msg });
        }
    };

    private onServerDisconnected = () => {
        this.send('REQ_MESSAGE', { status: false, msg: "Server error, We will reconnect shortly" });
    }

    private onAnimation = (data: any) => {
        this.send('REQ_Animation', data);
    };

    private onCloseTable = () => {
        this.send('REQ_MESSAGE', { status: false, msg: "Table is closed" });
        this.sendTableSettings();
        this.sendTableStatus();
        //this.sendTurn();
    };

    public sendMessage(status: boolean, msg: string, data?: any) {
        this.send('REQ_MESSAGE', { status: status, msg: msg, data: data });
    }

    public onTourneyInfo(data: TourneyInfo) {
        this.send('REQ_TOURNEY_INFO', { position: data.position, number: data.number })
        this.socketLog(`REQ_TOURNEY_INFO :  ${JSON.stringify(data).toString()}`);
    }

    public setBuyInPanelVisible(minBuyIn: number) {
        this.send('REQ_TABLE_BUYIN', minBuyIn);
    }

    public connect(socket: Socket, shouldMTMode: boolean) {
        if (!this.addSocket(socket, shouldMTMode))
            return;

        this.log(`Player(${this._name}) is connected using socket(${socket.id}).`);

        this.sendInfo();
        this.sendTableSettings();
        this.sendTableStatus();
        this.sendTurn();
        this.sendSidePots();
        this.sendPlayerState();

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
            currentSocket.emit('REQ_PLAYER_LEAVE', shouldMTMode ? {} : { type: "double_browser_leave", msg: "Connection from another browser has been detected." });

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
                .removeAllListeners('REQ_AUTO_FOLD')
                .removeAllListeners('REQ_SHARE_HAND')
                .removeAllListeners('REQ_TIP_DEALER')
                .removeAllListeners('REQ_PLAYER_SUBMIT_REPORT')
                .removeAllListeners('REQ_PLAYER_CHAT');

            // currentSocket.disconnect();
            this._sockets.delete(this._id);
            this.table?.setSeatFoldAtTurn(this.seat)
        }

        socket
            .on('disconnect', () => this.onSocketDisconnect(socket))
            .on('REQ_PLAYER_LEAVE', () => this.onRequestLeave())
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
            .on('REQ_PLAYER_SIDEBET', (ack) => this.onRequestSidebet(ack))
            .on('REQ_PLAYER_ACCEPT_INSURANCE', (data, ack) => this.onRequestInsurance(data, ack))
            .on('REQ_AUTO_FOLD', (data, ack) => this.onRequestAutoFold(data, ack))
            .on('REQ_TIP_DEALER', (data, ack) => this.onTipDealer(data, ack))
            .on('REQ_SHARE_HAND', (data, ack) => this.onRequestShareHand(data, ack))
            .on('REQ_PLAYER_SUBMIT_REPORT', (data, ack) => this.onRequestSubmitReport(data, ack))
            .on('REQ_PLAYER_CHAT', (data, ack) => this.onRequestChat(data, ack));

        this._sockets.set(this._id, socket);

        return true;
    }

    protected onState() {
        this.sendPlayerState();
    }

    private sendInfo() {
        const info = {
            id: this._id,
            name: this._name,
            avatar: this._avatar,
            globalBalance: this._globalBalance,
            tableBalance: this._tableBalance,
            chips: this._chips,
            created_at: this._created_at
        };

        this.send('REQ_PLAYER_INFO', info);
        this.socketLog(`REQ_PLAYER_INFO :  ${JSON.stringify(info).toString()}`);
    }

    private sendPlayerState() {
        this.send('REQ_PLAYER_STATE', { state: PlayerState[this.state] });
        this.socketLog(`REQ_PLAYER_STATE : ${JSON.stringify({ state: PlayerState[this.state] }).toString()}`);
    }

    private sendTableSettings() {
        console.log(this.table!.getSettings());
        this.send('REQ_TABLE_SETTINGS', this.table!.getSettings());
        this.socketLog(`REQ_TABLE_SETTINGS : ${JSON.stringify(this.table!.getSettings()).toString()}`);
    }

    public updateFreeBalance(balance: number) {

    }

    private onRequestShareHand = (data: any, ack: any) => {
        var todayDate = moment(new Date()).format("YYYY/MM/DD");
        const round_id = this.room!.id + '_' + this.table!.round
        let encryptText = encrypt(generateRandomString() + `user_id=${this._id}&date=${todayDate}&round_id=${round_id}`);
        if (encryptText) {
            return ack?.(JSON.stringify({ encryptText: encryptText }));
        }
    }
    private onRequestSubmitReport = async (arg: {type: string, description:string, reporter:string}, ack: any) => {
        //  const seat = this.table!.getSeatAt(arg.seatIndex);

        const { status, msg } = await this.room!.game.SubmitReport(this.room!.id, this._id, arg.type, arg.description, this.table!.round, arg.reporter);

        return ack?.(JSON.stringify({ status: status, msg:msg }));
    }

    private async onTipDealer(arg: { amount: number }, ack: any) {
        console.log(`${Number(this.seat!.money)} < ${arg.amount} = ${Number(this.seat!.money) > arg.amount}`);
        if(Number(this.seat!.money) < arg.amount)
        {
            this.send('REQ_MESSAGE', { status: false, msg: `Player(${this._name}) insufficient cash for tip` });
            return ack?.(JSON.stringify({ status: false }));
        }

        const { status } = await this.room!.game.SubmitTipDealer(this.room!.id, this._id, arg.amount, this.table!.round);
        if (status == true) {
            this.seat!.money = Number(this.seat!.money) - arg.amount;
            this.sendTableStatus();
            return ack?.(JSON.stringify({ status: status }));
        } else {
            this.send('REQ_MESSAGE', { status: status, msg: "Tip not send to dealer" });
        }
        return ack?.(JSON.stringify({status: status}));
    }


    private onSideBetOptions = (data: any) => {
        // this.table!.getSideBetOptions(state)
        this.sideBetState = data.street;
        this.send('REQ_SIDEBET_OPTIONS', { street: SideBetState[data.street], options: data.options });
        this.socketLog(`REQ_SIDEBET_OPTIONS : ${JSON.stringify({ street: SideBetState[data.street], options: data.options }).toString()}`);
    }

    private onTournamentLevelChanged = () => {
        this.sendTableSettings();
    }

    private onCashWaitList = (players: Player[]) => {
        this.send('REQ_TABLE_WAITLIST', players.map(player => player.name));
    }

    private onLog = (log: string) => {
        this.send('REQ_TABLE_LOG', log);
    }

    private onTableChat = (data: { playerName: string, msg: string }) => {
        this.send('REQ_TABLE_CHAT', data);
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
        this.socketLog('Client to TS : REQ_PLAYER_LEAVE');
        this.leave({ type: 'self' });
    }

    private onRequestLeaveGame() {
        this.socketLog('Client to TS : REQ_PLAYER_LEAVEGAME');

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
                .removeAllListeners('REQ_PLAYER_ACCEPT_INSURANCE')
                .removeAllListeners('REQ_AUTO_FOLD')
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
            .off('state', this.onRoundState)
            .off('turn', this.onRoundNewTurn)
            .off('action', this.onRoundAction)
            .off('result', this.onRoundResult)
            .off('showcards', this.onRoundShowCards)
            .off('showcardsbtn', this.onRoundShowCardsBtn)
            .off('foldanybet', this.onTableFoldAnyBet)
            .off('muckcards', this.onRoundMuckCards)
            .off('end', this.onRoundEnd)
            .off('serverdisconn', this.onServerDisconnected)
            .off('message', this.onMessage)
            .off('animation', this.onAnimation)
            .off('insurance', this.onInsurance)
            .off('closeTable', this.onCloseTable)
            .off('levelchange', this.onTournamentLevelChanged)
            .off('sidebet', this.onSideBetOptions);
    }

    private async onRequestInfo(ack?: (status: boolean) => void) {
        this.socketLog('Client to TS : REQ_PLAYER_INFO');
        const result = await this.updateInfo();
        if (result)
            this.sendInfo();
        ack?.(result);
    }

    private async onRequestSitDown(arg: { seat: number; }, ack?: (status: boolean) => void) {
        const seatIndex = Number(arg.seat);
        if (this.table!.isClosed === true) {
            const currentSocket = this._sockets.get(this._id);
            currentSocket!.emit('REQ_MESSAGE', { status: false, msg: "Table is closed" });
            return false;
            // this.send('REQ_MESSAGE', {status: false, msg: "Table is closed"});
            // return false;
        }

        const { status, globalBalance } = await this.room!.game.getGlobalBalance(this._id);
        this._globalBalance = globalBalance;
        this.sendInfo();
        this.socketLog(`Client to TS : REQ_PLAYER_SITDOWN ${JSON.stringify({ seat: seatIndex }).toString()}`);
        this.sitDown(seatIndex);
        ack?.(this.seat !== undefined);
        this.log(`***Socket*** Player(${this._name}) sit down on Seat (${seatIndex}) and ${this.seat !== undefined}`);
    }

    private onTableSitDown = (seat: TableSeat) => {
        this.sendTableStatus();
        this.sendTurn();
        this.sendSidePots();
    };

    private async onRequestBuyIn(arg: { amount: number; autoTopUpLess?: boolean; autoTopUpZero?: boolean }, ack?: (jsonStr: string) => void) {
        let amount = Number(arg.amount);

        if (amount === 0) {
            this.table?.leave(this.seat!);
            return;
        }

        this.socketLog(`Client to TS : REQ_PLAYER_BUYIN ${JSON.stringify({ amount: amount, autoTopUpLess: Boolean(arg.autoTopUpLess ?? false), autoTopUpZero: Boolean(arg.autoTopUpZero ?? false) }).toString()}`);
        if (!await this.buyIn(amount)) {
            const message = `Player(${this._name}) has insufficient cash below than buy-in. buyin: ${amount}, cash: ${this._cash}. Discarding buy-in.`;
            this.log(message);
            this.send('REQ_MESSAGE', { status: false, msg: message });

            if (this.seat?.money === 0 || !this.seat?.money) // when add more chips with chips in hands, no kick 
                this.table?.leave(this.seat!);
            return ack?.(JSON.stringify({ status: false, message: message }));
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

        ack?.(JSON.stringify({ status: true, message: "" }));
    }

    private async onRequestTransfer(arg: { amount: number; }, ack?: (jsonStr: string) => void) {
        let amount = Number(arg.amount);

        this.socketLog(`Client to TS : REQ_PLAYER_TRANSFER ${JSON.stringify({ amount: amount }).toString()}`);
        if (this.table!.isClosed === true) {
            const currentSocket = this._sockets.get(this._id);
            currentSocket!.emit('REQ_MESSAGE', { status: false, msg: "Table is closed" });
            return ack?.(JSON.stringify({ status: false, message: "Table is closed" }));
            // this.send('REQ_MESSAGE', {status: false, msg: "Table is closed"});
            // return false;
        }
        const { status, transferedAmount, updatedGlobalBalance } = await this.room!.game.transferBalance(this.room!.id, this._id, amount);

        if (!status) {
            const message = `Player(${this._name}) has insufficient global balance below than trasfer amount. transfer: ${transferedAmount}, global balance: ${updatedGlobalBalance}. Discarding transfer money.`;
            this.log(message);
            this.send('REQ_MESSAGE', { status: false, msg: message });

            return ack?.(JSON.stringify({ status: false, message: message }));
        }

        this.globalBalance = updatedGlobalBalance;
        this.tableBalance = this.tableBalance + transferedAmount;

        this.log(`Player(${this._name}) transfer to table wallet success. transfer: ${transferedAmount}, global balance: ${updatedGlobalBalance}`);

        ack?.(JSON.stringify({ status: true, message: "", updatedTableWalletBalance: this.tableBalance, updatedGlobalBalance }));
    }

    private async onRequestSidebet(arg: { street: number, sidebets: any; }, ack?: (jsonStr: string) => void) {
        let sidebets = arg.sidebets;

        this.socketLog(`Client to TS : REQ_PLAYER_SIDEBET ${JSON.stringify({ bets: sidebets }).toString()}`);

        for (let i = 0; i < sidebets.length; ++i) {
            const sideBetOptions = this.table?.options.sideBetOptions![this.sideBetState];
            const sideBetName = String(sidebets[i]).split('-')[0];
            const ratio = sideBetOptions?.find(option => option.betName === sideBetName)?.ratio;
            const tableCards = this.table?.getTableCards();
            const handCards = this.table?.getSeats()
                .find(seat => seat.index === this.seat?.index)
                ?.context.cards?.join(' ');
            await this.room!.game.submitSidebet(this.room!.id, this._id, sideBetName, String(sidebets[i]).split('-')[1], SideBetState[this.sideBetState], this.table?.round!, this.table?.options.bigBlind!, tableCards!, handCards!, this.room?.options.mode === 'cash', ratio);
        }

        ack?.(JSON.stringify({ status: true }));
    }

    private async onRequestInsurance(arg: { insuranceAmount: string, insuranceWinAmount: string }, ack?: (jsonStr: string) => void) {
        const { status } = await this.room!.game.submitInsurance(this.room!.id, this._id, arg.insuranceAmount, arg.insuranceWinAmount);
        if (status == true) {
            const InsurancePlayers = this.table!.getInsurancePlayers;
            InsurancePlayers.push({
                index: this.seat?.index,
                user_id: this._id,
                insuranceAmount: Number(arg.insuranceAmount),
                insuranceWinAmount: Number(arg.insuranceWinAmount),
                is_win: false
            });
        }
        ack?.(JSON.stringify({ status: status }));
    }

    private async onRequestAutoFold(arg: { value: boolean }, ack?: (jsonStr: string) => void) {
        if (arg.value == true) {
            const { status, data } = await this.room!.game.getAutoFoldInfo(this._id);
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
                player: !seat.player ? undefined : { name: seat.player.name, avatar: seat.player.avatar, created_at:seat.player.created_at, id:seat.player.id },
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

    private onRoundState = (state: RoundState) => {
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

    private sendTurn() {
        this.send('REQ_TABLE_TURN', this.table!.getTurnContext());
        this.socketLog(`REQ_TABLE_TURN : ${JSON.stringify(this.table!.getTurnContext()).toString()}`);
    }

    private async onRequestAction(arg: { action: string; bet?: number; }, ack?: (status: boolean) => void) {
        const action = String(arg.action);
        const bet = Number(arg.bet ?? 0);

        this.socketLog(`Client to TS : REQ_PLAYER_ACTION ${JSON.stringify({ action: action, bet: bet }).toString()}`);
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
                    rank: HandRank[seat.hand.rank],
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
            if (sendInfo.players!.length > 1 && lastPlayers.length == 1 && lastPlayers[0].seat != this.seat.index && seats.indexOf(this.seat.index) != -1)
                this.send('REQ_TABLE_PLAYERSHOWCARDSBTN');
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

        const showcards = {
            seat: seat.context.index,
            cards: seat.context.cards,
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
        this.socketLog(`Client to TS: REQ_PLAYER_WAITFORBB ${JSON.stringify({ value: value }).toString()}`);
        this.emit('waitforbb', value);
        ack?.(true);
    }

    private async onRequestSitOutNextHand(arg: { value?: boolean; }, ack?: (status: boolean) => void) {
        const value = Boolean(arg.value ?? true);
        this.socketLog(`Client to TS: REQ_PLAYER_SITOUTNEXTHAND ${JSON.stringify({ value: value }).toString()}`);
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

    private onRequestChat(arg: { msg: string }, ack?: (status: boolean) => void) {
        this.socketLog(`Client to TS: REQ_PLAYER_CHAT ${arg.msg}`);
        this.emit('chat', arg.msg);
    }

    public send(ev: string, ...args: any[]) {
        this._sockets.forEach(socket => socket.emit(ev, ...args));
    }
}
