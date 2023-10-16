import { createServer, ServerOptions } from './server';

const options: ServerOptions = {
    port: 11000,

    token: 'test_server',
    
    id: "1",
    name: 'TexasHoldem',
    created_at:"sep 9",
    gameType: 'plo',
    numberOfSeats: 9,
    smallBlind: 10,
    bigBlind: 100,
    timeToReact: 40,
    timebankMax: 20,
    timebankBonus: 2,
    rake: 5,
    rakeCap: 0,
    rakePreFlop: false,
    rakeSplitPot: false,
    rakeRound: false,

    sitoutTimeout: 300,
    observerTimeout: 20,
    lostTimeout: 30,

    botCount: 8,
    botAddInterval: [90, 120],
    botAddCount: 0,

    mode: 'cash',

    minBuyIn: 50,
    maxBuyIn: 300,
};

createServer(options)
.then(() => {
    console.log(`Cash Game Table server initialized:`, options);
});
