import moment from 'moment';
import { BreakOptions, LevelOptions } from './poker/tournament';
import { createServer, ServerOptions } from './server';

// const startTime = moment().add(5, 's').format('YYYY-MM-DD HH:mm:ss');

const options: ServerOptions = {
    port: 11001,

    token: 'test_server',
    gameType: 'nlh',
    id: 1,
    name: 'TexasHoldem',
    numberOfSeats: 9,
    smallBlind: 1,
    bigBlind: 2,
    ante: 1,
    timeToReact: 40,
    timebankMax: 20,
    timebankBonus: 2,
    rake: 5,
    rakeCap: 50,
    rakePreFlop: false,
    rakeSplitPot: false,
    rakeRound: false,

    lostTimeout: 30,
    sitoutTimeout: 0,
    observerTimeout: 0,

    botCount: 7,
    botAddInterval: 0,
    botAddCount: 0,

    mode: 'tournament',
    tournament_id: '123223442',

    startTime: "2023-03-13 06:32:00",
    levels: [
        <LevelOptions>{ time_to_start: "2023-03-13 10:43:00", type: 'level', level: 1, smallBlind: 5, bigBlind: 10, ante: 0 },
        <LevelOptions>{ time_to_start: "2023-03-13 10:44:00", type: 'level', level: 2, smallBlind: 6, bigBlind: 11, ante: 1 },
        <LevelOptions>{ time_to_start: "2023-03-13 10:45:00", type: 'level', level: 3, smallBlind: 7, bigBlind: 12, ante: 2 },
        // <BreakOptions>{ time_to_start: "2023-03-13 09:37:00", type: 'break'},
        // <LevelOptions>{ time_to_start: "2023-03-13 09:39:00", type: 'level', level: 4, smallBlind: 8, bigBlind: 13, ante: 3 },
        // <LevelOptions>{ time_to_start: "2023-03-13 09:41:00", type: 'level', level: 5, smallBlind: 9, bigBlind: 14, ante: 4 },
    ]
};

createServer(options)
.then(() => {
    console.log(`Tournament Game Table server initialized:`, options);
});
