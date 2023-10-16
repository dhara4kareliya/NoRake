import { EventEmitter } from 'events';
import winston from 'winston';
import { GameService } from '../services/game';
import { delay } from '../services/utils';
import { BotManager } from './bot';
import { Player, PlayerState, UserMode } from './player';
import { SocketLobby } from './sockets';
import { Table, TableSeat, TableSeatState } from "./table";
import { TournamentGameController } from './tournament';
import { round2 } from './math';

export interface RoomOptions {
    id: string;
    maxPlayers?: number;
    lostTimeout?: number;
    observerTimeout?: number;
    mode?: 'cash' | 'tournament';
    tournament_id?: string;
    minBuyIn?: number;
    maxBuyIn?: number;
}

type PlayerContext = {
    player: Player;

    lostTimeout?: NodeJS.Timeout;
    observerTimeout?: NodeJS.Timeout;
}

export class Room extends EventEmitter {
    public get id() { return this.options.id; }

    private _table!: Table;
    public get table() { return this._table; }

    private _isWaitingEndroundRes = false;
    public get isWaitingEndroundRes() { return this._isWaitingEndroundRes; }

    private contexts: Map<string, PlayerContext> = new Map();

    constructor(public readonly game: GameService, public readonly options: RoomOptions, public readonly logger: winston.Logger) {
        super();

        // default options
        this.options.lostTimeout ??= 30;
        this.options.observerTimeout ??= 40;
    }

    public setTable(table: Table) {
        this.logger.debug(`Room(Table#${table.id}): Starting`);

        this._table = table;

        this._table
            .on('sitdown', (seat) => this.onTableSitDown(seat))
            .on('leave', (seat) => this.onTableLeave(seat))
            .on('remove_tournament', (seat) => this.onTournamentRemove())
            .on('end', () => this.onTableRoundResult())
            .on('turn', (turn) => this.onTableTurn(turn));


        this.options.maxPlayers ??= this._table.options.numberOfSeats * 2;
    }

    public on(ev: 'join', listener: (player: Player) => void): this;
    public on(ev: 'end_round_finished', listener: (value: unknown) => void): this;
    public on(ev: string, listener: (...args: any[]) => void): this {
        return super.on(ev, listener);
    }

    public join(player: Player) {
        if (this.contexts.size > this.options.maxPlayers!) {
            this.logger.debug(`Room(Table#${this._table.id}): Max players limit reached. Discarding this player(${player.name}).`);
            return false;
        }

        if (this.contexts.get(player.id) !== undefined) {
            this.logger.debug(`Room(Table#${this._table.id}): Player is existed. Discarding this player(${player.name}).`);
            return false;
        }

        const context: PlayerContext = {
            player
        };
        this.contexts.set(player.id, context);

        player.start(this);
        player
            .on('leaveroom', () => this.onPlayerLeave(player))
            .on('state', (state) => this.onPlayerState(player, state))
            .on('online', () => this.onPlayerOnline(player))
            .on('offline', () => this.onPlayerOffline(player));

        this.emit('join', player);

        if (this.options.mode === 'tournament')
            return true;

        this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}) has joined.`);

        if (player.mode === UserMode.Player)
            this.startObserverTimeout(context);

        player.on('joinwaitlist', () => this.onPlayerJoinWaitlist(player));

        return true;
    }

    private onPlayerJoinWaitlist(player: Player) {
        const context = this.contexts.get(player.id);
        if (!context)
            return;

        this.clearLostTimeout(context);
        this.clearObserverTimeout(context);
    }

    private onPlayerLeave(player: Player) {
        const context = this.contexts.get(player.id);
        if (!context)
            return;

        this.clearLostTimeout(context);
        this.clearObserverTimeout(context);

        this.contexts.delete(player.id);

        this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}) has left.`);
    }

    private onPlayerState(player: Player, state: PlayerState) {
        const context = this.contexts.get(player.id);
        if (!context)
            return;

        if (!player.name.startsWith("BOT"))
            console.log(`onPlayerState shows player (${player.name}) -- ${state}`);
        if (state === PlayerState.Observing)
            this.startObserverTimeout(context);
        else
            this.clearObserverTimeout(context);
    }

    private startObserverTimeout(context: PlayerContext) {
        const player = context.player;
        if (!context.observerTimeout && this.options.observerTimeout) {
            this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Starting observer timeout.`);

            context.observerTimeout = setTimeout(() => {
                this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Observer timeout. Leaving now.`);
                player.leave({ type: 'timeout' });
            }, this.options.observerTimeout! * 1000);
        }
    }

    private clearObserverTimeout(context: PlayerContext) {
        if (!!context.observerTimeout) {
            const player = context.player;
            this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Observer timeout clear.`);
            clearTimeout(context.observerTimeout);
            context.observerTimeout = undefined;
        }
    }

    private onPlayerOnline(player: Player) {
        const context = this.contexts.get(player.id);
        if (!context)
            return;

        this.clearLostTimeout(context);
    }

    private onPlayerOffline(player: Player) {
        const context = this.contexts.get(player.id);
        if (!context)
            return;

        this.table.checkOfflinePlayerAndFold(player);

        if (this.options.mode === 'tournament') {
            return;
        }

        this.startLostTimeout(context);
    }

    private onTableTurn(turn: number) {
        const seat = this.table.getPlayingSeats().find(seat => seat.index === turn);

        // if (!!seat)
        //     this.game.updateTurn(this.id, (seat.player as Player).id);
    }

    private startLostTimeout(context: PlayerContext) {
        this.clearLostTimeout(context);

        const player = context.player;
        this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Starting lost timeout.`);

        context.lostTimeout = setTimeout(() => {
            this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Lost timeout. Leaving now.`);
            player.leave({ type: 'offline' });
        }, this.options.lostTimeout! * 1000);
    }

    private clearLostTimeout(context: PlayerContext) {
        if (!!context.lostTimeout) {
            const player = context.player;
            this.logger.debug(`Room(Table#${this._table.id}): Player(${player.name}): Lost timeout clear.`);
            clearTimeout(context.lostTimeout);
            context.lostTimeout = undefined;
        }
    }

    private onTableSitDown(seat: TableSeat) {
        const player = seat.player as Player;

        if (this.options.mode === 'tournament')
            return;

        this.game.sit(this.id, player.id, seat.index);

        this.game.notifyPlayerSitdown(this.id, player.id);
    }

    private onTableLeave(seat: TableSeat) {
        const player = seat.player as Player;

        setTimeout(() => {
            if (!player.leavePending) {
                this.game.leave(this.id, player.id, player.chips + player.tableBalance, this.table.round);
                player.completeLeavePending();
            }
        }, 100);

        if (player.exitReason !== undefined) {
            if (player.exitReason.type == 'migrate')
                this.game.moveToOtherTable(player.exitReason.server, player.exitReason.info)
        }
    }

    private onTournamentRemove() {
        this.game.tournament_remove(this.id);
    }

    private async onTableRoundResult() {
        this.getPlayers()
            .filter(player => player.leavePending === true)
            .map(player => {
                this.game.leave(this.id, player.id, player.chips + player.tableBalance, this.table.round);
                player.completeLeavePending();
            });

        const players = this.table.getSeats()
            .filter(seat => seat.state !== TableSeatState.Empty)
            .map(seat => ({
                token: (seat.player as Player).id,
                seat: seat.index,
                money: seat.money!,
            }));

        if (players.length === 0) return;

        this.table.roundLog.settings.table_id = this.id;
        this.table.roundLog.settings.mode = this.options.mode;
        this.table.roundLog.settings.max_players = this._table.options.numberOfSeats;
        this.table.roundLog.settings.min_buy_in = this.options.minBuyIn;
        this.table.roundLog.settings.max_buy_in = this.options.maxBuyIn;
        this.table.roundLog.settings.tournament_id = this.options.tournament_id;

        this.table.roundLog.LeavePlayers = this.table.roundLog.LeavePlayers ?? [];
        this.table.roundLog.StayPlayers = this.table.getStayPlayers();

        this._isWaitingEndroundRes = true;
        const { status, tables } = await this.game.endRound(this.id, this.table.round, this.table.roundRake, players, this.table.roundLog, this.options.tournament_id);

        if (status === 3) {
            setTimeout(() => {
                // process.exit();
                for (const player of this.getPlayers()) {
                    player.leave({ type: 'kick' });
                }

                this.game.deleteTournamentTables(this.options.tournament_id!);
            }, 2000)
        }

        console.log(`next_table --------------------for table ${this.id}`, tables);
        if (tables !== undefined) {
            let infos: any = [];

            tables.map((table: any) => {
                table.players.map((player: any) => {
                    infos.push({ server: table.server, token: table.table_token, user_id: player.user_token });
                })
            })

            for (let i = 0; i < infos.length; ++i) {
                const info = infos[i];
                const player = this.getPlayer(info.user_id);
                if (!!player && info.token !== this.id) {
                    console.log('migrate player', info.user_id);
                    const { server, token } = info;

                    const currentChips = this.table.getSeats()
                        .find(seat => (seat.player as Player)?.id === player.id)?.money;

                    const playerInfo = {
                        name: player.name,
                        avatar: player.avatar,
                        main_balance: player.cash,
                        chips: currentChips ?? player.chips,
                        token: player.id,
                        mode: player.mode,
                        t: player.thread || '',
                        is_bot: player.name.startsWith("BOT") ? "1" : "0"
                    };

                    const targetTablePlayers = await this.game.getPlayers(server);
                    if (targetTablePlayers.length >= this._table.options.numberOfSeats) {
                        this.logger.debug(`Abort migration. Target table: (${server}) full`);
                        await this.game.migrationResponse(token, this.table.round, this.options.tournament_id!, false, 'Table overflow');
                        continue;
                    }

                    if (player.seat === undefined) {
                        this.game.moveToOtherTable(server, playerInfo);
                        TournamentGameController.removePendingPlayer(player);
                    }
                    else {
                        player!.leave({
                            type: 'migrate',
                            server,
                            token,
                            info: playerInfo
                        });
                    }
                }
            }
        }

        this.emit('end_round_finished');
        this._isWaitingEndroundRes = false;
        if (this.options.mode === "cash") {
            const InsurancePlayers = this.table.getInsurancePlayers;

            for (const player of InsurancePlayers) {
                if (player.is_win == true) {
                    const { status } = await this.game.winInsurance(this.id, player.user_id, String(player.insuranceWinAmount));

                    if (status == true && player.index !== undefined) {
                        const seat = this.table.getSeatAt(player.index);
                        console.log(`seat.money(${seat.money}) + player.insuranceWinAmount(${player.insuranceWinAmount}) = ${round2(seat.money! + player.insuranceWinAmount)}`)
                        seat.money = round2(seat.money! + player.insuranceWinAmount);
                    }
                }
            }
        }
        this.table.scheduleNewRound();
        // console.log(JSON.stringify(this.table.roundLog));
    }

    public getPlayers() {
        return [...this.contexts.values()].map(context => context.player);
    }

    public getPlayer(id: string) {
        return this.contexts.get(id)?.player;
    }
    public async setCurrencyRate() {
        const setUsdRate = await this.game.getCurrencyRate();
        this._table.setUsdRate(setUsdRate);
    }
}
