const axios = require('axios');
const crypto = require('crypto');
const encryptionMethod = 'AES-256-CBC';
const secret = "gffuy7rk6fmu7rkfg7532h6u7cjk09ol"; //must be 32 char length
const iv = secret.substr(0,16);

function decrypt(encryptedStr) {
    const decryptor = crypto.createDecipheriv(encryptionMethod, secret, iv);
    const decypted =  decryptor.update(encryptedStr, 'base64', 'utf8') + decryptor.final('utf8');
    return decypted.substr(20, decypted.length); 
};

const delay_500 = () => new Promise(res => setTimeout(res, 500));

class SocketLobby {
    constructor(io) {
        this.io = io
        this.sockets = new Map();
        this.userTokenToTableTokens = new Map();
    }

    start() {
        this.io.on('connection', socket => {
            console.log(`New client connected: socket: ${socket.id}`);
            socket.on('REQ_USER_ENTER', (data, ack) => this.onUserEnter(socket, data, ack));
        });
    }

    async onUserEnter(socket, data, ack) {
        const encryptedUser = String(data.user)
        const tableUrls = data.tableUrls

        const { name, avatar, token : userToken, tables, created_at,rating } = JSON.parse(decrypt(encryptedUser));
        const tableTokens = tables.map(table => table.table_token);
        
        this.userTokenToTableTokens.set(userToken, tableTokens)

        console.log(`Player is trying to enter. user token: ${userToken}`);
        console.log(`avatar: ${avatar}`);
        console.log(`rating: ${rating}`);
        console.log(`name: ${name}`);

        const _socket = this.getSocket(userToken);
        if (!!_socket) {
            _socket.disconnect();
        }

        this.sockets.set(userToken, socket)

        ack(JSON.stringify({ status: true, name: name, rating: rating }));
    }

    getSocket(user_token) {
        return this.sockets.get(user_token)
    }

    // deprecated
    async getTSLists(user_token) {
        console.log(`${process.env.GAME_SERVER}/api.php?api=get_mt_user&user_token=${user_token}`);
        const res = await axios.get(`${process.env.GAME_SERVER}/api.php?api=get_mt_user&user_token=${user_token}`)
        const urls = res.data.tables.map(table => table.url)
        console.log(res.data);
        const table_tokens = res.data.tables.map(table => table.table_token)
        
        this.userTokenToTableTokens.set(user_token, table_tokens)
        
        return res.data.tables
    }

    async getUserInfo(encryptedUser, tsUrl) {
        console.log(`${tsUrl}/api/get_user`);

        const params = new URLSearchParams();
        params.append('encryptedUser', encryptedUser);

        const res = await axios.post(`${tsUrl}/api/get_user`, params);

        console.log(res.data);
        
        const userToken = res.data.user_token
        const tableTokens = res.data.table_tokens
                
        return {userToken, tableTokens}
    }

    sendTurn(user_token, table_token) {
        console.log(`get turn : ${user_token} -- ${table_token}`)
        
        const socket = this.getSocket(user_token)

        if (!!socket) {
            socket.emit('REQ_MT_TURN', table_token)
        }
    }

    addTable(client, user_token) {
        const socket = this.sockets.get(user_token);

        let tableTokens = this.userTokenToTableTokens.get(user_token);
        
        if (!tableTokens || tableTokens.length == 0 || !socket) {
            return false;
        }

        if (tableTokens.includes(client.table_token)) {
            return false;
        }

        tableTokens.push(client.table_token);
        this.userTokenToTableTokens.set(user_token, tableTokens);
        
        socket.emit('REQ_MT_CLIENT_ADD', client);

        return true;
    }

    leaveMT(tableToken, userToken, threadToken) {
        const socket = this.sockets.get(userToken);

        let tableTokens = this.userTokenToTableTokens.get(userToken);

        if (!!tableTokens) {
            const index = tableTokens.indexOf(tableToken);

            if (index >= 0) {
                tableTokens.splice(index, 1);
                this.userTokenToTableTokens.set(userToken, tableTokens);
                socket.emit('REQ_MT_CLIENT_LEAVE', threadToken);
            }
        }
    }
}

module.exports = (io) => {
    const socketLobby = new SocketLobby(io)

    return ({
        socketLobby: socketLobby
    })
}