const { nanoid } = require('nanoid');

module.exports = () => {
    const users = []
    const usernameToTokenMap = new Map()
    const tokenToUserMap = new Map()
    const threadTokenToUserMap = new Map()

    function getOrCreateUser(username, token) {
        let user = users.find(i=>i.name == username)
        if (!user) {
            user = {
                name: username,
                avatar: "https://nrpoker.net/assets/img/user.png",
                cash: 10000,
                chips: 500,
                token: token,
            }
            addUser(token, user)
        }
        return user
    }

    function setUserToThread(threadToken, user) {
        threadTokenToUserMap.set(threadToken, user)
    }

    function addUser(token, user) {
        
        token = token || nanoid()
        user.token = token
        users.push(user)
        usernameToTokenMap.set(user.name, token)
        tokenToUserMap.set(token, user)
        console.log('add user : ', token)
    }

    function authenticate(username, password) {
        return new Promise(resolve => {
            if (usernameToTokenMap.has(username))
                return resolve(usernameToTokenMap.get(username))

            getOrCreateUser(username)
            const token = usernameToTokenMap.get(username)

            console.log(`User authenticated. username:${username}, token:${token}`)

            resolve(token)
        })
    }

    function logout(token) {
        return getInfo(token).then(user => {
            usernameToTokenMap.delete(user.name)
            tokenToUserMap.delete(token)
        })
    }

    function getBot(token) {
        if (!token.startsWith('BOT'))
            return
        
        const username = token
        let user = users.find(i=>i.name == username)
        if (!user) {
            user = {
                name: username,
                avatar: "https://nrpoker.net/assets/img/user.png",
                cash: 10000,
                chips: 500,
                token: token,
            }
            addUser(token, user)
            setUserToThread(token, user)
        }
        user.cash = 10000
        return user
    }

    function getUserForTestToken(token) {
        if (token.startsWith('BOT') || !token.startsWith('!'))
            return
        
        const username = token.substr(1)
        return getOrCreateUser(username, token)
    }

    async function getInfo(token) {
        return new Promise((resolve, reject) => {
            let user = getUserForTestToken(token)
            if (!user) {
                user = getBot(token)
            }
            if (!user) {
                if (!tokenToUserMap.has(token))
                    return reject(new Error(`User not found with token: ${token}`))

                user = tokenToUserMap.get(token)
            }

            resolve(user)
        })
    }

    async function getUserWithThread(token) {
        return new Promise((resolve, reject) => {
            let user = getBot(token)
            if (!user) {
                if (!threadTokenToUserMap.has(token))
                    return reject(new Error(`User not found with token: ${token}`))
                user = threadTokenToUserMap.get(token)
            }

            resolve(user)
        })
    }

    return {
        authenticate,
        logout,
        getInfo,
        setUserToThread,
        getUserWithThread
    }
}
