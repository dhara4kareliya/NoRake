const axios = require('axios');

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
        const userToken = String(data.user_token);
        console.log(`Player is trying to enter. user token: ${userToken}`);

        const _socket = this.getSocket(userToken);
        if (!!_socket) {
            _socket.disconnect();    
        }

        this.sockets.set(userToken, socket)
        
        ack(true)

        // const clients = await this.getTSLists(userToken);

        // for (let i = 0; i < clients.length; ++i) {
        //     const client = clients[i];
        //     socket.emit('REQ_MT_CLIENT_ADD', client);
        //     await delay_500();
        //     // clients.map(client => { socket.emit('REQ_MT_CLIENT_ADD', client) })
        // }
    }

    getSocket(user_token) {
        return this.sockets.get(user_token)
    }

    async getTSLists(user_token) {
        const res = await axios.get(`${process.env.GAME_SERVER}/api.php?api=get_mt_user&user_token=${user_token}`)
        console.log(`${process.env.GAME_SERVER}/api.php?api=get_mt_user&user_token=${user_token}`);
        const urls = res.data.tables.map(table => table.url)
        console.log(res.data);
        const table_tokens = res.data.tables.map(table => table.table_token)
        
        this.userTokenToTableTokens.set(user_token, table_tokens)
        
        return res.data.tables
    }

    sendTurn(user_token, table_token) {
        console.log(`get turn : ${user_token} -- ${table_token}`)
        
        const socket = this.getSocket(user_token)

        if (!!socket) {
            socket.emit('REQ_MT_TURN', table_token)
        }
    }

    addOneTable(client, user_token) {
        const socket = this.sockets.get(user_token);

        if (!!socket) 
            socket.emit('REQ_MT_CLIENT_ADD', client);
    }
}

module.exports = (io) => {
    const socketLobby = new SocketLobby(io)

    return ({
        socketLobby: socketLobby
    })
}