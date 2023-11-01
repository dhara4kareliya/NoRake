import axios, { AxiosInstance } from 'axios'
import winston from 'winston';
import { Console } from 'winston/lib/winston/transports';
import fs from 'fs';
import path from 'path';
import { UserMode } from '../poker/player';
import * as https from "https";
import { Table } from '../poker/table';
import { CashTable } from '../poker/cash';
import { TournamentTable } from '../poker/tournament';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

export type GameServiceOptions = Partial<{
    baseURL: string;
    tsURL: string;
}>;

export interface PlayerInfo {
    name: string;
    avatar: string;
    cash: number;
    chips: number;
    token: string;
    mode: UserMode | undefined;
    created_at: string;
}

function addProtocol (searchString: string) {
    if (searchString.indexOf('http://') == -1 && searchString.indexOf('https://') == -1) {
        return 'https://' + searchString;
    }

    if (searchString.indexOf('http://') != -1) {
        return 'https://' + searchString.slice(7, searchString.length - 1)
    }

    return searchString;
}

export class GameService {
    private client: AxiosInstance;
    private tsURL: string;
    private table!: Table;

    constructor({ baseURL, tsURL }: GameServiceOptions, private readonly logger: winston.Logger) {
        this.client = axios.create({ baseURL, timeout: 5000 });
        this.tsURL = tsURL!;
    }

    public setTable(t: Table) {
        this.table = t;
    }

    public async getUser(thread_token: string, table_token: string, is_bot: boolean) {
        while(true) {
            try {
                const url = `/api.php?api=get_user&t=${thread_token}&table_id=${table_token}&is_bot=${is_bot}`;
                this.logger.debug(`GameService: GetUser: ${url}`);
                const res = await this.client.get(url);

                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: GetUser: Failed.`);
                    return;
                }

                const info: PlayerInfo = {
                    name: String(res.data.nick_name ?? ''),
                    avatar: String(res.data.avatar ?? ''),
                    cash: Number(res.data.main_balance ?? 0),
                    chips: Number(res.data.chips ?? 0), // TODO: add chips into get_user API
                    token: String(res.data.user_id ?? ''),
                    mode: is_bot ? UserMode.Player : undefined,
                    created_at: String(res.data.created_at ?? '')
                };

                const log_info = {
                    name: String(res.data.nick_name ?? ''),
                    avatar: String(res.data.avatar ?? ''),
                    main_balance: Number(res.data.main_balance ?? 0),
                    chips: Number(res.data.chips ?? 0), // TODO: add chips into get_user API
                    token: String(res.data.user_id ?? ''),
                    created_at: String(res.data.created_at ?? '')
                };
                this.logger.debug(`GameService: GetUser: Success. info: ${JSON.stringify(log_info).toString()}`);
                
                // await this.downloadAvatar(info.avatar, 'download');

                return info;
            }
            catch (err: any) {
                this.logger.debug(`GameService: GetUser: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
            }
        }
    }

    public async deposit(table: string, token: string, amount: number, round_id: number) {
        while(true) {
            try {
                const url = `/api.php?api=deposit&user=${token}&table_id=${table}&deposit=${amount}`;
                this.logger.debug(`GameService: Deposit: ${url}`);
                const res = await this.client.get(url);

                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: Deposit: Failed.`);
                    return;
                }

                const cash = Number(res.data.cash ?? 0);
                this.logger.debug(`GameService: Deposit: Success. cash: ${cash}`);
                return cash;
            }
            catch (err: any) {
                this.logger.debug(`GameService: Deposit: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
            }
        }
    }

    public async getBalance(token: string) {
        while(true) {
            try {
                const url = `/api.php?api=get_balance&user=${token}`;
                this.logger.debug(`GameService: GetBalance: ${url}`);
                const res = await this.client.get(url);

                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: GetBalance: Failed.`);
                    return;
                }

                const balance = Number(res.data.balance ?? 0);
                this.logger.debug(`GameService: GetBalance: Success. balance: ${balance}`);
                return balance;
            }
            catch (err: any) {
                this.logger.debug(`GameService: GetBalance: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    continue;
                }
            }
        }
    }

    public async sit(table: string, token: string, seat: number) {
        while(true) {
            try {
                const url = `/api.php?api=seat&user=${token}&table_id=${table}&seat=${seat}`;
                this.logger.debug(`GameService: Sit: ${url}`);
                const res = await this.client.get(url);
                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: Sit: Failed.`);
                    return false;
                }

                this.logger.debug(`GameService: Sit: Success.`);
                return true;
            }
            catch (err: any) {
                this.logger.debug(`GameService: Sit: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    continue;
                }
            }
        }
    }

    public async leave(table: string, token: string, leftMoney: number, round_id: number) {
        while(true) {
            try {
                const url = `/api.php?api=leave&user=${token}&table_id=${table}&left_balance=${leftMoney}`;
                this.logger.debug(`GameService: Leave: ${url}`);
                const res = await this.client.get(url);
                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: Leave: Failed.`);
                    return false;
                }

                this.logger.debug(`GameService: Leave: Success.`);
                return true;
            }
            catch (err: any) {
                this.logger.debug(`GameService: Leave: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
            }
        }
    }

    public async tournament_leave(table: string, token: string) {
        while(true) {
            try {
                const url = `api.php?api=tournoment_player_lost&table_id=${table}&user_id=${token}`;
                this.logger.debug(`GameService: Tournament Leave: ${url}`);
                const res = await this.client.get(url);
                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: Tournament Leave: Failed.`);
                    return false;
                }

                this.logger.debug(`GameService: Tournament Leave: Success.`);
                
                return true;
            }
            catch (err: any) {
                this.logger.debug(`GameService: Tournament Leave: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
            }
        }
    }


    public async moveToOtherTable(tsUrl: string, userInfo: any) {
        try {
            const fixedUrl = addProtocol(tsUrl);
            const url = `${fixedUrl}/api/players/add`
            this.logger.debug(`GameService: Tournament Move to Table: ${url}`);

            const params = {
                data: [userInfo]
            }

            const res = await axios.post(url, params, { httpsAgent });
            if (!Boolean(res.data.status ?? false)) {
                this.logger.debug(`GameService: Tournament Move to Table: Failed.`);
                return false;
            }

            this.logger.debug(`GameService: Tournament Move to Table: Success.`);
            
            return true;
        }
        catch (err: any) {
            this.logger.debug(`GameService: Tournament Move to Table: `, err);
        }

    }

    public async getPlayers(tsUrl: string) {
        try {
            const fixedUrl = addProtocol(tsUrl);
            const url = `${fixedUrl}/api/players`
            this.logger.debug(`GameService: Tournament Move Get target table players: ${url}`);

            const res = await axios.get(url, { httpsAgent });

            return res.data;
        }
        catch (err: any) {
            this.logger.debug(`Get Table Players: `, err);
        }
    }

    public async migrationResponse(table: string, round_id: number, tournament_id: string, status: boolean, message: string) {
        while(true) {
            try {
                const url = `api.php?api=migration_response&table_id=${table}&round_id=${round_id}&tournament_id=${tournament_id}&status=${status}&message=${message}`;
                this.logger.debug(`GameService: Tournament migration response: ${url}`);
                const res = await this.client.get(url);
                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: Tournament migration response: Failed.`);
                    return false;
                }

                this.logger.debug(`GameService: Tournament migration response: Success.`);
                
                return true;
            }
            catch (err: any) {
                this.logger.debug(`GameService: Tournament migration response: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
            }
        }
    }

    public async updateTurn(table: string, user_token: string) {
        try {
            const url = `${process.env.MT_SERVER}/api/turn?user_token=${user_token}&table_token=${table}`;
            this.logger.debug(`Multi Table Service: Update Turn: ${url}`);

            const res = await axios.get(url);

            return res.data;
        }
        catch (err: any) {
            this.logger.debug(`Update Turn to MT server: `, err);
        }
    }

    public async deleteTournamentTables(tournamentId: string) {
        try {
            const url = `${process.env.MS_SERVER}/api/tables/tournament/${tournamentId}`;
            this.logger.debug(`Table Manager Service: Delete tournament tables: ${url}`);

            const res = await axios.delete(url, { httpsAgent });

            return res.data.status;
        }
        catch (err: any) {
            this.logger.debug(`Table Manager Service: Delete tournament tables`, err);
        }
    }

    public async getTourneyPos(table: string, token: string, round_id: number) {
        while(true) {
            try {
                const url = `api.php?api=get_tournaments_user_chip&token=${table}`;
                this.logger.debug(`GameService: Get Tournament Tourney Position: ${url}`);
                const res = await this.client.get(url);
                if (!Boolean(res.status ?? false)) {
                    this.logger.debug(`GameService: Get Tournament Tourney Position: Failed.`);
                    return;
                }

                this.logger.debug(`GameService: Get Tournament Tourney Position: Success.`);
                const info_array = res.data as any[];
                const tourey_info = info_array.map(info => {
                    return {
                        token: String(info.player_id ?? ''),
                        position: Number(info.position ?? 0),
                        number: Number(info.number ?? 0)
                    };
                });
                console.log("tournament postion info");
                console.log(tourey_info);
                return tourey_info;
            }
            catch (err: any) {
                this.logger.debug(`GameService: Get Tournament Tourney Position: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
            }
        }
    }

    public async tournament_remove(table: string) {
        while(true) {
            try {
                const url = `api.php?api=tournoment_remove&table_id=${table}`;
                this.logger.debug(`GameService: Tournament Remove: ${url}`);
                const res = await this.client.get(url);
                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: Tournament Remove: Failed.`);
                    return false;
                }

                this.logger.debug(`GameService: Tournament Remove: Success.`);
                
                return true;
            }
            catch (err: any) {
                this.logger.debug(`GameService: Tournament Remove: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
            }
        }
    }
	
	public async getCurrencyRate() {
        while(true) {
            try {
                const url = `/api.php?api=get_currency_rate&to=XRP&from=USD`;
                this.logger.debug(`GameService: Get currency rate: ${url}`);
                const res = await this.client.get(url);
                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: Get currency rate: Failed.`);
                    return false;
                }

                this.logger.debug(`GameService: Get currency rate: Success.`);
                
                return res.data.amount;
            }
            catch (err: any) {
                this.logger.debug(`GameService: Get currency rate: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
            }
        }
    }	
	
	

    public async endRound(table: string, round: number, rake: number, players: { token: string, seat: number, money: number }[], roundLog : any, tournament_id?: string) {
        while(true) {
            try {
                const balances = JSON.stringify(players.map(player => ({
                    user: player.token,
                    seat: player.seat,
                    balance: player.money,
                })));

                const url = `/api.php`;

                const params = new URLSearchParams();
                params.append('api', "end_round");
                params.append('table_id', table);
                params.append('round_id', round.toString());
                params.append('rake', rake.toString());
                params.append('balances', balances.toString());
                params.append('log', JSON.stringify(roundLog));
                params.append('tournament_id', tournament_id ?? ' ');
                params.append('players_that_leave', JSON.stringify(roundLog.LeavePlayers));
                params.append('players_that_stay', JSON.stringify(roundLog.StayPlayers));
                params.append('type', roundLog.settings.mode);
                params.append('server', this.tsURL);
                
                this.logger.debug(`GameService: EndRound: ${url}`);
                console.log(params)
                
                if(process.env.ROUND_LOG === "true")
                    this.logger.notice(JSON.stringify(roundLog));

                const res = await this.client.post(url, params);
                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: EndRound: Failed. Error Message: ${res.data.message}`);
                    return {
                        status: false
                    };
                }

                this.logger.debug(`GameService: EndRound: Success.`);
                return {
                    status: res.data.status, 
                    tables: res.data.tables,
                    isDeleteTable: Boolean(res.data.delete_table)
                };
            }
            catch (err: any) {
                this.logger.debug(`GameService: EndRound: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn');

                    if (!!tournament_id)
                        this.deleteTournamentTables(tournament_id);
                    
                    continue;
                }
                return {
                    status: false
                };
            }
        }
    }

    public async transferBalance(table: string, token: string, amount: number) {
        while(true) {
            try {
                const url = `api.php?api=user_wallet_to_table_wallet&table_token=${table}&user_token=${token}&amount=${amount}`;
                this.logger.debug(`GameService: Balance transfer from User wallet to Table wallet: ${url}`);
                const res = await this.client.get(url);
                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: Balance transfer from User wallet to Table wallet: Failed.`);
                    return {status: false};
                }

                this.logger.debug(`GameService: Balance transfer from User wallet to Table wallet: Success.`);
                
                return {status: true, transferedAmount: res.data.transfer_amount, updatedGlobalBalance: res.data.update_user_amount};;
            }
            catch (err: any) {
                this.logger.debug(`GameService: Balance transfer from User wallet to Table wallet: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
                return {status: false}
            }
        }
    }

    public async getGlobalBalance(token: string) {
        while(true) {
            try {
                const url = `api.php?api=get_global_balance&user_token=${token}`;
                this.logger.debug(`GameService: Get global balance: ${url}`);
                const res = await this.client.get(url);
                if (!Boolean(res.data.status ?? false)) {
                    this.logger.debug(`GameService: Get global balance: Failed.`);
                    return {status: false};
                }

                this.logger.debug(`GameService: Get global balance: Success. balance: ${res.data.balance}`);
                
                return {status: true, globalBalance: res.data.balance};
            }
            catch (err: any) {
                this.logger.debug(`GameService: Get global balance: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
                return {status: false};
            }
        }
    }

    public async getTournamentResult(tournamentId: string, token: string) {
        while(true) {
            try {
                const url = `api.php?api=get_tournament_winining&tournament_id=${tournamentId}&user_token=${token}`;
                this.logger.debug(`GameService: Get tournament result: ${url}`);
                const res = await this.client.get(url);
                if (!Boolean(res.data.status ?? false)) {
                    return {status: false};
                }

                this.logger.debug(`GameService: Get tournament result: Success.`);
                
                return {status: true, hasWin: res.data.haswin, prize: res.data.winnigString, rank: res.data.finishing_place};
            }
            catch (err: any) {
                this.logger.debug(`GameService: Get tournament result: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
                return {status: false};
            }
        }
    }

    public async notifyPlayerSitdown(table: string, token: string) {
        while(true) {
            try {
                const url = `api.php?api=update_seat&table_token=${table}&user_token=${token}&type=seatin`;
                this.logger.debug(`GameService: Notify player's sitdown status: ${url}`);
                const res = await this.client.get(url);
                if (!Boolean(res.data.status ?? false)) {
                    return {status: false};
                }

                this.logger.debug(`GameService: Notify player's sitdown status: Success.`);
                
                return {status: true};
            }
            catch (err: any) {
                this.logger.debug(`GameService: Notify player's sitdown status: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
                return {status: false};
            }
        }
    }
    
    public async submitSidebet(table: string, token: string, betName: string, betAmount: string, street: string, round_id: number, bigBlind: number, commonCards: string, privateCards: string, isCash: boolean, odd?: number) {
        while(true) {
            try {
                const url = `/api.php`;

                const params = new URLSearchParams();

                params.append('api', "side_bet");
                params.append('table_token', table);
                params.append('user_token', token);
                params.append('cash_game', String(Number(isCash)));
                params.append('round_id', round_id.toString());
                params.append('bet_name', betName);
                params.append('bet_street', street);
                params.append('amount', betAmount.toString());
                params.append('bb', bigBlind.toString());
                params.append('odds', (odd || 0).toString());
                params.append('private_cards', privateCards);
                params.append('common_cards', commonCards);
                
                const res = await this.client.post(url, params);
                console.log(params);
                this.logger.debug(`GameService: Submit Side Bet status: ${url}`);

                if (!Boolean(res.data.status ?? false)) {
                    return {status: false};
                }

                this.logger.debug(`GameService: Submit Side Bet status: Success.`);
                
                return {status: true, betId: res.data.bet_id, freeBalance: res.data.updated_free_balance};
            }
            catch (err: any) {
                this.logger.debug(`GameService: Submit Side Bet status: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
                return {status: false};
            }
        }
    }

    public async submitSidebetResult(table: string, token: string, betId: string, awardAmount: string, round_id: number, commonCards: string, privateCards: string) {
        while(true) {
            try {
                const url = `/api.php`;

                const params = new URLSearchParams();

                params.append('api', "win_bet");
                params.append('table_token', table);
                params.append('user_token', token);
                params.append('bet_id', betId);
                params.append('round_id', round_id.toString());
                params.append('amount', awardAmount.toString());
                params.append('private_cards', privateCards);
                params.append('common_cards', commonCards);
                
                const res = await this.client.post(url, params);
                console.log(params);
                this.logger.debug(`GameService: Submit Side Bet Result: ${url}`);

                if (!Boolean(res.data.status ?? false)) {
                    return {status: false};
                }

                this.logger.debug(`GameService: Submit Side Bet Result: Success.`);
                
                return {status: true, freeBalance: res.data.updated_free_balance};
            }
            catch (err: any) {
                this.logger.debug(`GameService: Submit Side Bet Result: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
                return {status: false};
            }
        }
    }
    
    public async SubmitTipDealer(table: string, token: string, Amount: number, round_id: number) {
        while(true) {
            try {
                const url = `/api.php`;

                const params = new URLSearchParams();

                params.append('api', "user_to_tips");
                params.append('table_token', table);
                params.append('user_token', token);
                params.append('round_id', round_id.toString());
                params.append('amount', Amount.toString());
                
                const res = await this.client.post(url, params);
                this.logger.debug(`GameService: Tip to Dealer status: ${url}`);
                this.logger.debug(`GameService: Tip to Dealer amount: ${params}`);

                if (!Boolean(res.data.status ?? false)) {
                this.logger.debug(`GameService: Tip to Dealer status: failed.`);
                    return {status: false};
                }

                this.logger.debug(`GameService: Tip to Dealer status: Success.`);
                
                return {status: true};
            }
            catch (err: any) {
                this.logger.debug(`GameService: Tip to Dealer status: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
                return {status: false};
            }
        }
    }

    public async submitInsurance(table: string, token: string,insuranceAmount:string,insuranceWinAmount:string,round_id:number) {
        while(true) {
            try {
                const url = `/api.php`;
                const params = new URLSearchParams();

                params.append('api', "insurance");
                params.append('table_token', table);
                params.append('user_token', token);
                params.append('amount', insuranceAmount);
                params.append('winAmount', insuranceWinAmount);
                params.append('round_id', round_id.toString());

                const res = await this.client.post(url, params);
                this.logger.debug(`GameService: Submit Insurance status: ${url}, {${table},${token},${insuranceAmount},${insuranceWinAmount},${round_id.toString()}}`);

                if (!Boolean(res.data.status ?? false)) {
                    return {status: false};
                }

                this.logger.debug(`GameService: Submit Insurance status: Success.`);
                
                return {status: true};
            }
            catch (err: any) {
                this.logger.debug(`GameService: Submit Insurance status: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
                return {status: false};
            }
        }
    }

    public async winInsurance(table: string, token: string,amount:string,round_id:number){
        while(true) {
            try {
                const url = `/api.php`;
                const params = new URLSearchParams();

                params.append('api', "win_insurance");
                params.append('table_token', table);
                params.append('user_token', token);
                params.append('amount', amount);
                params.append('round_id', round_id.toString());

                const res = await this.client.post(url, params);
                this.logger.debug(`GameService: Win Insurance status: ${url}, {${table},${token},${amount},${round_id.toString()}}`);

                if (!Boolean(res.data.status ?? false)) {
                    return {status: false};
                }

                this.logger.debug(`GameService: Win Insurance status: Success.`);
                
                return {status: true};
            }
            catch (err: any) {
                this.logger.debug(`GameService: Win Insurance status: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
                return {status: false};
            }
        } 
    }

    public async getAutoFoldInfo(token: string) {
        while(true) {
            try {
                const url = `/api.php`;
                const params = new URLSearchParams();

                params.append('api', "auto_fold");
                params.append('user_token', token);

                const res = await this.client.post(url, params);
                this.logger.debug(`GameService: Auto Fold Info status: ${url}, {${token}}`);

                if (!Boolean(res.data.status ?? false)) {
                    return {status: false,data:[]};
                }

                this.logger.debug(`GameService: Auto Fold Info status: Success.`);
                
                return {status: true,data:JSON.parse(res.data.data)};
            }
            catch (err: any) {
                this.logger.debug(`GameService: Auto Fold Info status: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
                return {status: false};
            }
        }    
    }

    public async SubmitReport(table: string, token: string,type:string, description:string, round_id: number, reporter:string) {
        while(true) {
            try {
                const url = `/api.php`;

                const params = new URLSearchParams();

                params.append('api', "table_report");
                params.append('user_id', token);
                params.append('table_id', table);
                params.append('type', type);
                params.append('description', description);
                params.append('round_id', round_id.toString());
                params.append('reporter', reporter);
                
                const res = await this.client.post(url, params);
                this.logger.debug(`GameService: Submit Report status: ${url}`);
                this.logger.debug(`GameService: Submit Report status: ${params}`);

                if (!Boolean(res.data.status ?? false)) {
                this.logger.debug(`GameService: Submit Report status: failed.`);
                    return {status: false, msg:res.data.msg};
                }

                this.logger.debug(`GameService: Submit Report status: Success.`);
                
                return {status: true, msg:res.data.msg};
            }
            catch (err: any) {
                this.logger.debug(`GameService: Submit Report status: Error: `, err);
                if (err.code === 'ECONNABORTED') {
                    this.table.emit('serverdisconn')
                    continue;
                }
                return {status: false};
            }
        }
    }
}
