const { nanoid } = require('nanoid')

module.exports = () => {
    const threads = new Map()
    const tableToThreadMap = new Map()
    const threadToUserMap = new Map()

    function find(token) {
        return threads.get(token);
    }

    function findByTable(token) {
        return tableToThreadMap.get(token)
    }

    function create(token) {
        token = token || nanoid()
        const thread = {
            token
        }
        threads.set(token, thread)

        return thread
    }

    function set(token, table) {
        const thread = find(token)
        if (!thread)
            return

        thread.table = table
        tableToThreadMap.set(table.token, thread)
        return thread
    }

    function setThreadToUser(token, userToken) {
        threadToUserMap.set(token, userToken)
    }

    function getUserToken(threadToken) {
        return threadToUserMap.get(threadToken)
    }

    function getTablesByUserToken(token) {
        const threadTokens = [...threadToUserMap.entries()]
                        .filter(({ 1: v }) => v === token)
                        .map(([k]) => k)
        // const tables = threadTokens
        //             .map(token => find(token))
        //             .map(thread => thread.table)
        // ${process.env.GAME_SERVER}/game/play?t=${token}
        const singleClientUrls = threadTokens
            .map(token => {
                const thread = find(token)
                return {
                    url: `http://localhost/NRpoker-game/?t=${token}`,
                    table_token: thread.table.token
                }
            })
        
        return singleClientUrls
    }

    function findTableByThread(t) {
        const thread = find(t)
        if (!thread)
            return
        
        return thread.table
    }

    function destroy(token) {
        if (token.startsWith('test_'))
            return
            
        const thread = find(token)
        if (!thread)
            return

        if (!!thread.table) {
            tableToThreadMap.delete(thread.table.token)
        }
        threads.delete(token)
    }

    (function init() {
        // create test thread
        create('test_thread')
        set('test_thread', {
            server: 'http://localhost:11000',
            token: 'test_server',
            gameType: 'plo'
        })
    }())

    return {
        find,
        findByTable,
        create,
        set,
        destroy,
        findTableByThread,
        setThreadToUser,
        getUserToken,
        getTablesByUserToken
    }
}
