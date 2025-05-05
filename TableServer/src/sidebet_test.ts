import { Card, createDeck } from "./poker/card";
import { SideBetState } from "./poker/player";
import { randomChoice, shuffle } from "./poker/random";
import { dealMe, hit } from "./poker/sideGame";
import { evaluateSideBet, howIsCardSuits, howIsCardValues, sideBetOptions } from "./poker/sidebet";
import fs from 'fs';

interface SideBetCase {
    betName: string,
    handCards: string,
    tableCards: string
}

function createLog(filename:string,text:string){

    fs.appendFileSync(`./logs/${filename}.txt`, `${new Date().toISOString()} : ${text} \n`);

}

function dump(street: string, testCases: SideBetCase[]) {

    console.table(testCases.map(value => {
        const data: any = {
            betName: value.betName,
            handCards: value.handCards,
            tableCards: value.tableCards
        };
        
        const isWin = evaluateSideBet(street, value.betName, value.handCards.split(',') as Card[], value.tableCards.split(',') as Card[]);

        isWin ? data.result = 'win' : data.result = 'lose';
        
        return data;
    }));
    
}

function testTexasSideBetOnPreCards() {
    console.log(`************* Texas Pre Cards *************`);

    const preCardsCases = [
        {
            betName: 'pair',
            handCards: '2S,2C',
            tableCards: '',
        },
        {
            betName: 'suited',
            handCards: '2S,3S',
            tableCards: '',
        },
        {
            betName: 'suited',
            handCards: '2S,4S',
            tableCards: '',
        },
        {
            betName: 'connectors',
            handCards: '2S,3D',
            tableCards: '',
        },
        {
            betName: 'connectors',
            handCards: '2S,3S',
            tableCards: '',
        },
        {
            betName: 'suited connectors',
            handCards: '2S,3S',
            tableCards: '',
        },
        {
            betName: 'suited connectors',
            handCards: '4S,6S',
            tableCards: '',
        },
        {
            betName: 'Duce Seven',
            handCards: '2S,7H',
            tableCards: '',
        },
        {
            betName: 'Duces',
            handCards: '2S,2H',
            tableCards: '',
        },
        {
            betName: 'Black Aces',
            handCards: 'AS,AC',
            tableCards: '',
        },
    ];

    dump('PreCards', preCardsCases);

    console.log('\n');
}

function testTexasSideBetOnPreFlop() {
    console.log(`************* Texas Pre Flop *************`);

    const preFlopCases = [
        {
            betName: 'Flash Draw',
            handCards: '2S,3S',
            tableCards: '5S,6S,AD',
        },
        {
            betName: 'Flash Draw',
            handCards: '2S,3S',
            tableCards: '4S,5S,AS',
        },
        {
            betName: 'Flash',
            handCards: '2S,3S',
            tableCards: '4S,5S,AS',
        },
        {
            betName: 'Flash',
            handCards: '2S,3S',
            tableCards: '4S,5S,6D',
        },
        {
            betName: 'Stright',
            handCards: '2S,3S',
            tableCards: '4S,5S,6S',
        },
        {
            betName: 'Stright',
            handCards: '2S,3D',
            tableCards: '4D,5D,7D',
        },
        {
            betName: 'Set',
            handCards: '2S,2D',
            tableCards: '2H,4C,5C',
        },
        {
            betName: 'Set',
            handCards: '2S,2H',
            tableCards: '3S,3H,3D',
        },
        {
            betName: '2 pairs',
            handCards: 'AS,KS',
            tableCards: 'AD,KD,QH',
        },
        {
            betName: '2 pairs',
            handCards: 'AS,KS',
            tableCards: 'AD,QD,QH',
        },
        {
            betName: 'Rainbow',
            handCards: 'AS,5S',
            tableCards: '2D,3H,4C',
        },
        {
            betName: 'Rainbow',
            handCards: 'AC,AD',
            tableCards: '2S,3S,4D',
        },
        {
            betName: 'Ace',
            handCards: 'AS,5S',
            tableCards: 'AS,5S,7S',
        },
        {
            betName: 'Ace',
            handCards: 'AS,AD',
            tableCards: '2S,3S,4D',
        },
        {
            betName: 'Pair',
            handCards: 'AS,2C',
            tableCards: '2S,3S,2D',
        },
        {
            betName: 'Pair',
            handCards: 'AS,AD',
            tableCards: '2S,2H,2C',
        },
        {
            betName: 'high card is 7',
            handCards: 'AS,2C',
            tableCards: '2D,3H,4C',
        },
        {
            betName: 'high card is 7',
            handCards: '2S,2H',
            tableCards: '4S,5S,AS',
        },
        {
            betName: 'One Suit',
            handCards: 'AS,2C',
            tableCards: '4S,5S,6S',
        },
        {
            betName: 'One Suit',
            handCards: '2S,2H',
            tableCards: '2D,2H,2C',
        },
        {
            betName: 'Three',
            handCards: 'AS,2C',
            tableCards: '2S,2H,2D',
        },
        {
            betName: 'Three',
            handCards: '2S,2H',
            tableCards: 'AD,QD,QH',
        },
        {
            betName: '3 Red Cards',
            handCards: 'AS,2C',
            tableCards: '2H,3H,2D',
        },
        {
            betName: '3 Red Cards',
            handCards: '2S,2H',
            tableCards: 'AD,QS,QH',
        },
        {
            betName: '3 Black Cards',
            handCards: 'AS,2C',
            tableCards: '2S,2C,3C',
        },
        {
            betName: '3 Black Cards',
            handCards: '2S,2H',
            tableCards: 'AD,QS,QH',
        },
        {
            betName: '777',
            handCards: 'AS,2C',
            tableCards: '7S,7C,7D',
        },
        {
            betName: '777',
            handCards: '2S,2H',
            tableCards: '7D,7S,QH',
        },
    ];

    dump('PreFlop', preFlopCases);

    console.log('\n');
}

function testTexasSideBetOnFlop() {
    console.log(`************* Texas Flop *************`);

    const flopCases = [
        {
            betName: 'Next Is Ace',
            handCards: '2S,3S',
            tableCards: '5S,6S,3D,AC',
        },
        {
            betName: 'Next Is Ace',
            handCards: '2S,3S',
            tableCards: '4S,5S,AS,AD',
        },
        {
            betName: 'Next Is Ace',
            handCards: '2S,AS',
            tableCards: '4S,5S,3C,AS',
        },
        {
            betName: 'Next Is Ace',
            handCards: '2S,3S',
            tableCards: '4S,5S,6D,AD',
        },
        {
            betName: 'Board will pair',
            handCards: '2S,3S',
            tableCards: '4S,5S,6S,AS',
        },
        {
            betName: 'Board will pair',
            handCards: '2S,3D',
            tableCards: '4D,5D,7D,7C',
        },
        {
            betName: 'Three on the board',
            handCards: '2S,2D',
            tableCards: '2H,4C,2C,2D',
        },
        {
            betName: 'Three on the board',
            handCards: '2S,2H',
            tableCards: '3S,3H,3D,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AS,KS',
            tableCards: 'AC,KC,QH,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AS,KS',
            tableCards: 'AD,QC,QH,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AC,KC',
            tableCards: 'AC,KC,QH,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AS,KC',
            tableCards: 'AD,QC,QH,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AS,KC',
            tableCards: 'AC,KC,QH,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AC,KC',
            tableCards: 'AD,QC,QH,2C',
        },
    ];

    dump('Flop', flopCases);

    console.log('\n');
}

function testOmahaSideBetOnPreCards() {
    console.log(`************* Omaha Pre Cards *************`);

    const preCardsCases = [
        {
            betName: 'Aces',
            handCards: 'AS,AC,AH,3H',
            tableCards: '',
        },
        {
            betName: 'Aces',
            handCards: 'AS,3C,2H,3H',
            tableCards: '',
        },
        {
            betName: '2 pairs',
            handCards: 'AS,AH,2S,3H',
            tableCards: '',
        },
        {
            betName: '2 pairs',
            handCards: '2S,2H,2D,2C',
            tableCards: '',
        },
        {
            betName: '2 pairs',
            handCards: '2S,3S,4H,5C',
            tableCards: '',
        },
        {
            betName: 'Low cards',
            handCards: '7S,3S,AH,2S',
            tableCards: '',
        },
        {
            betName: 'Low cards',
            handCards: '8S,3S,AH,2S',
            tableCards: '',
        },
        {
            betName: 'High cards',
            handCards: 'TS,TH,AH,KH',
            tableCards: '',
        },
        {
            betName: 'High cards',
            handCards: 'TS,TH,AH,2H',
            tableCards: '',
        },
        {
            betName: 'Rainbow',
            handCards: 'AS,2H,3D,AC',
            tableCards: '',
        },
        {
            betName: 'Rainbow',
            handCards: 'AS,2D,3D,AC',
            tableCards: '',
        },
        {
            betName: 'Ace X suited',
            handCards: 'AS,TC,2S,AH',
            tableCards: '',
        },
        {
            betName: 'Ace X suited',
            handCards: 'AS,TC,KH,2D',
            tableCards: '',
        },
        {
            betName: '3 of a kind',
            handCards: 'AS,AC,2S,AH',
            tableCards: '',
        },
        {
            betName: '3 of a kind',
            handCards: 'AS,AC,KH,2D',
            tableCards: '',
        },
        {
            betName: 'double suited',
            handCards: 'AS,2C,2S,3C',
            tableCards: '',
        },
        {
            betName: 'double suited',
            handCards: 'AS,AC,KH,2C',
            tableCards: '',
        }
    ];

    dump('PreCards', preCardsCases);

    console.log('\n');
}

function testOmahaSideBetOnPreFlop() {
    console.log(`************* Omaha Pre Flop *************`);

    const preFlopCases = [
        {
            betName: 'Rainbow',
            handCards: 'AS,5S,2H,4S',
            tableCards: '2D,3H,4C',
        },
        {
            betName: 'Rainbow',
            handCards: 'AS,5S,2H,4S',
            tableCards: '2S,3S,4D',
        },
        {
            betName: 'Ace',
            handCards: 'AS,5S,2H,4S',
            tableCards: 'AS,5S,7S',
        },
        {
            betName: 'Ace',
            handCards: 'AS,5S,2H,4S',
            tableCards: '2S,3S,4D',
        },
        {
            betName: 'Pair',
            handCards: 'AS,5S,2H,4S',
            tableCards: '2S,3S,2D',
        },
        {
            betName: 'Pair',
            handCards: 'AS,5S,2H,4S',
            tableCards: '2S,2H,2C',
        },
        {
            betName: 'high card is 7',
            handCards: 'AS,5S,2H,4S',
            tableCards: '2D,3H,4C',
        },
        {
            betName: 'high card is 7',
            handCards: 'AS,5S,2H,4S',
            tableCards: '4S,5S,AS',
        },
        {
            betName: 'One Suit',
            handCards: 'AS,5S,2H,4S',
            tableCards: '4S,5S,6S',
        },
        {
            betName: 'One Suit',
            handCards: 'AS,5S,2H,4S',
            tableCards: '2D,2H,2C',
        },
        {
            betName: 'Three',
            handCards: 'AS,5S,2H,4S',
            tableCards: '2S,2H,2D',
        },
        {
            betName: 'Three',
            handCards: 'AS,5S,2H,4S',
            tableCards: 'AD,QD,QH',
        },
        {
            betName: '3 Red Cards',
            handCards: 'AS,5S,2H,4S',
            tableCards: '2H,3H,2D',
        },
        {
            betName: '3 Red Cards',
            handCards: 'AS,5S,2H,4S',
            tableCards: 'AD,QS,QH',
        },
        {
            betName: '3 Black Cards',
            handCards: 'AS,5S,2H,4S',
            tableCards: '2S,2C,3C',
        },
        {
            betName: '3 Black Cards',
            handCards: 'AS,5S,2H,4S',
            tableCards: 'AD,QS,QH',
        },
    ];

    dump('PreFlop', preFlopCases);

    console.log('\n');
}

function testOmahaSideBetOnFlop() {
    console.log(`************* Omaha Flop *************`);

    const flopCases = [
        {
            betName: 'Next Is Ace',
            handCards: '2S,3S,2H,4H',
            tableCards: '5S,6S,3D,AC',
        },
        {
            betName: 'Next Is Ace',
            handCards: '2S,3S,4H,5H',
            tableCards: '4S,5S,AS,AD',
        },
        {
            betName: 'Next Is Ace',
            handCards: '2S,AS,2H,3S',
            tableCards: '4S,5S,3C,AS',
        },
        {
            betName: 'Next Is Ace',
            handCards: '2S,3S,AH,3H',
            tableCards: '4S,5S,6D,AD',
        },
        {
            betName: 'Board will pair',
            handCards: '2S,3S,2H,3H',
            tableCards: '4S,5S,6S,AS',
        },
        {
            betName: 'Board will pair',
            handCards: '2S,3D,2H,3H',
            tableCards: '4D,5D,7D,7C',
        },
        {
            betName: 'Three on the board',
            handCards: '2S,3D,4H,5D',
            tableCards: '2H,4C,2C,2D',
        },
        {
            betName: 'Three on the board',
            handCards: '2S,3D,4H,5D',
            tableCards: '3S,3H,3D,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AS,KS,QS,3H',
            tableCards: 'AC,KC,QH,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AS,KS,QS,3H',
            tableCards: 'AD,QC,QH,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AC,KC,9H,8H',
            tableCards: 'AC,KC,QH,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AS,KC,9H,8H',
            tableCards: 'AD,QC,QH,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AS,KC,2H,3H',
            tableCards: 'AC,KC,QH,2C',
        },
        {
            betName: 'Next is Club',
            handCards: 'AC,KC,2H,3H',
            tableCards: 'AD,QC,QH,2C',
        },
    ];

    dump('Flop', flopCases);

    console.log('\n');
}

function testSideGame01() {
    console.log('**********Side Game: Hit The Dealer**********\n');
    
    const bigBlind = 1;
    const betSize = 1;

    let userFreeBalance = 0;
    console.log(`Initial Free Balance: ${userFreeBalance}`);
    
    const testCount = 100000;
    let totalWins = 0;
    let totalBets = 0;
    let winningNum = 0;
    let losingNum = 0;
    for (let i = 0; i < testCount; ++i) {
        userFreeBalance -= betSize * bigBlind;
        totalBets += betSize * bigBlind;
        const hitResult = hit();
        const winningAmount = betSize * bigBlind * hitResult.winningOdd;
        if (winningAmount > 0) winningNum++;
        else losingNum++;
        userFreeBalance += winningAmount;
        totalWins += winningAmount;
    }
    console.log(`Number of winnings: ${winningNum}`);
    console.log(`Number of losings: ${losingNum}`);
    console.log(`Total Bets: ${totalBets}`);
    console.log(`Total Wins: ${totalWins}`);
    console.log(`Free Balance After Test: ${userFreeBalance}\n\n`);
}

function testSideGame02() {
    console.log('**********Side Game: New Deal**********\n');

    const bigBlind = 1;
    const betSize = 1;

    let userFreeBalance = 0;
    console.log(`Initial Free Balance: ${userFreeBalance}`);

    const testCount = 100000;
    let totalWins = 0;
    let totalBets = 0;
    let winningNum = 0;
    let losingNum = 0;
    for (let i = 0; i < testCount; ++i) {
        userFreeBalance -= betSize * bigBlind;
        totalBets += betSize * bigBlind;
        const dealResult = dealMe();
        const winningAmount = betSize * bigBlind * dealResult.winningOdd / 2;
        if (winningAmount > 0) winningNum++;
        else losingNum++;
        userFreeBalance += winningAmount;
        totalWins += winningAmount;
    }

    console.log(`Number of winnings: ${winningNum}`);
    console.log(`Number of losings: ${losingNum}`);
    console.log(`Total Bets: ${totalBets}`);
    console.log(`Total Wins: ${totalWins}`);
    console.log(`Free Balance After Test: ${userFreeBalance}`);
}

export function testSideBetTimes50000(argBetName: string, gameType: string, sideBetState: SideBetState) {
    console.log(`${gameType} ${SideBetState[sideBetState]} - ${argBetName}`);

    const bigBlind = 1;
    const odd = 1;
    const betSize = odd * bigBlind;
    const testCount = 50000;
    
    let userFreeBalance = 100000;
    console.log(`Initial Free Balance: ${userFreeBalance}`);

    let ratio;
    let i = 1;
    let winningNum = 0;
    let losingNum = 0;
    let totalWins = 0;
    let totalBets = 0;
    let totalRatio = 0;

    for (; ;) {
        
        const deck = shuffle(createDeck());
        
        let handCards: Card[] = [];
        switch (gameType) {
            case 'nlh':
                handCards = [deck.pop()!, deck.pop()!];
                break;
            case 'plo':
            case 'nlh4':
                handCards = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];
                break;
            case 'plo5':
                handCards = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];
                break;
            case 'plo6':
                handCards = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];
                break;
        }

        let tableCards: Card[] = [];
        
        switch (sideBetState) {
            case SideBetState.PreCards:  
                break;
            case SideBetState.PreFlop: 
                break;
            case SideBetState.Flop: 
                tableCards = [deck.pop()!, deck.pop()!, deck.pop()!];
                break;
            case SideBetState.Turn: 
                tableCards = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];
                break;
            default: break;
        }

        let betName = argBetName;
        const sideBetOption = sideBetOptions.get(gameType);

        const pointedCardsCount = betName.split('-').length == 2 ? betName.split('-')[1] : undefined;

        if (!!pointedCardsCount) {
            const suit = betName.split('-')[0].split(' ')[2];

            if (suit == 'Ace' && !howIsCardValues('A', handCards, Number(pointedCardsCount), tableCards, 3, 0)) {
                continue;
            }

            if ((suit == 'Club' || suit == 'Clubs') && !howIsCardSuits('C', handCards, Number(pointedCardsCount), tableCards, 3, 2)) {
                continue;
            }

            if ((suit == 'Hart' || suit == 'Harts') && !howIsCardSuits('H', handCards, Number(pointedCardsCount), tableCards, 3, 2)) {
                continue;
            }

            if ((suit == 'Diamond' || suit == 'Diamonds') && !howIsCardSuits('D', handCards, Number(pointedCardsCount), tableCards, 3, 2)) {
                continue;
            }

            if ((suit == 'Spade' || suit == 'Spades') && !howIsCardSuits('S', handCards, Number(pointedCardsCount), tableCards, 3, 2)) {
                continue;
            }

            betName = betName.split('-')[0];
        }

        ratio = sideBetOption![sideBetState - 1].find(option => option.betName === betName)?.odds.
                find(odd => odd.selector(handCards, tableCards))?.value;
        
        if (!ratio) continue;
        if (i > testCount) break;

        userFreeBalance -= betSize;
        totalBets += betSize;

        switch (sideBetState) {
            case SideBetState.PreFlop: 
                tableCards = [deck.pop()!, deck.pop()!, deck.pop()!];
                break;
            case SideBetState.Flop: 
                tableCards.push(deck.pop()!);
                break;
            case SideBetState.Turn: 
                tableCards.push(deck.pop()!);
                break;
            default: break;
        }

        const isWin = evaluateSideBet(SideBetState[sideBetState], betName, handCards, tableCards);

        let winAmount = 0;
        if (isWin) {
            winAmount = ratio! * betSize;
            winningNum++;
            totalWins += winAmount;
            totalRatio += ratio;
        }
        else {
            losingNum++;
        }

        userFreeBalance += winAmount;

        i = i + 1;
    }
  /*  console.log(`Bets size: ${betSize}`);
    console.log(`Return size: ${betSize * ratio}`);
    console.log(`Number of winnings: ${winningNum}`);
    console.log(`Number of losings: ${losingNum}`);
    console.log(`Total Bets: ${totalBets}`);
    console.log(`Total Wins: ${totalWins}`);
    console.log(`Free Balance After Test: ${userFreeBalance}\n\n`);*/
    createLog(gameType,`BetName:${argBetName},betSize: ${betSize},returnSize: ${betSize * ratio},totalRatio :${totalRatio},totalBets:${totalBets},winningNum:${winningNum},losingNum:${losingNum},totalWins:${totalWins},beforeUserFreeBalance:100000,afterUserFreeBalance:${userFreeBalance}`);
    return {betName:argBetName,gameType:gameType,betSize: betSize,returnSize:betSize * ratio,totalRatio:totalRatio,totalBets:totalBets,winningNum:winningNum,losingNum:losingNum,totalWins:totalWins,beforeUserFreeBalance:100000,afterUserFreeBalance:userFreeBalance};

}

(function main() {
    testTexasSideBetOnPreCards();
    testTexasSideBetOnPreFlop();
    testTexasSideBetOnFlop();
    
    testOmahaSideBetOnPreCards();
    testOmahaSideBetOnPreFlop();
    testOmahaSideBetOnFlop();
    
    testSideGame01();
    testSideGame02();

    const texasPreCardsBetNames = ['pair', 'suited', 'connectors', 'suited connectors', 'Duce Seven', 'Duces', 'Black Aces'];

    for (let i = 0; i < texasPreCardsBetNames.length; ++i)
        testSideBetTimes50000(texasPreCardsBetNames[i], 'nlh', SideBetState.PreCards);

    const texasPreFlopBetNames = ['Flash Draw', 'Flash', 'Stright', 'Set', '2 pairs', 'Rainbow', 'Ace', 'Pair', 'high card is 7', 'One Suit', 'Three', '3 Red Cards', '3 Black Cards', '777'];

    for (let i = 0; i < texasPreFlopBetNames.length; ++i)
        testSideBetTimes50000(texasPreFlopBetNames[i], 'nlh', SideBetState.PreFlop);

    const texasFlopBetNames = ['Next Is Ace-0', 'Next Is Ace-1', 'Board will pair', 'Three on the board', 'Next is Club-0', 'Next is Club-1', 'Next is Club-2', 'Next is Hart-0','Next is Hart-1','Next is Hart-2', 'Next is Diamond-0', 'Next is Diamond-1', 'Next is Diamond-2', 'Next is Spade-0', 'Next is Spade-1', 'Next is Spade-2'];

    for (let i = 0; i < texasFlopBetNames.length; ++i)
        testSideBetTimes50000(texasFlopBetNames[i], 'nlh', SideBetState.Flop);

    for (let i = 0; i < texasFlopBetNames.length; ++i)
        testSideBetTimes50000(texasFlopBetNames[i], 'nlh', SideBetState.Turn);

    /** Plo */
    const omahaPreCardsBetNames = ['Aces', '2 pairs', 'Low cards', 'High cards', 'Rainbow', 'Ace X suited', '3 of a kind', 'double suited'];

    for (let i = 0; i < omahaPreCardsBetNames.length; ++i)
        testSideBetTimes50000(omahaPreCardsBetNames[i], 'plo', SideBetState.PreCards);

    const omahaPreFlopBetNames = ['Rainbow', 'Pair', 'One Suit', 'Three', '3 Red Cards', '3 Black Cards'];

    for (let i = 0; i < omahaPreFlopBetNames.length; ++i)
        testSideBetTimes50000(omahaPreFlopBetNames[i], 'plo', SideBetState.PreFlop);

    const omahaFlopBetNames = ['Board will pair', 'Three on the board', 'Next is Club-0', 'Next is Club-1', 'Next is Club-2', 'Next is Hart-0','Next is Hart-1','Next is Hart-2', 'Next is Diamond-0', 'Next is Diamond-1', 'Next is Diamond-2', 'Next is Spade-0', 'Next is Spade-1', 'Next is Spade-2'];

    for (let i = 0; i < omahaFlopBetNames.length; ++i)
        testSideBetTimes50000(omahaFlopBetNames[i], 'plo', SideBetState.Flop);

    for (let i = 0; i < omahaFlopBetNames.length; ++i)
        testSideBetTimes50000(omahaFlopBetNames[i], 'plo', SideBetState.Turn);

    /** Plo 5 */
    const plo5PreCardsBetNames = ['Aces', '2 pairs', 'Cards Below 7', 'Cards Below 10', 'Cards Above 5', 'Cards Above 10', '3 of a kind'];

    for (let i = 0; i < plo5PreCardsBetNames.length; ++i)
        testSideBetTimes50000(plo5PreCardsBetNames[i], 'plo5', SideBetState.PreCards);

    const plo5PreFlopBetNames = ['Rainbow', 'Pair', 'One Suit', 'Three', '3 Red Cards', '3 Black Cards'];

    for (let i = 0; i < plo5PreFlopBetNames.length; ++i)
        testSideBetTimes50000(plo5PreFlopBetNames[i], 'plo5', SideBetState.PreFlop);

    const plo5FlopBetNames = ['Board will pair', 'Three on the board', 'Next is Club-0', 'Next is Club-1', 'Next is Club-2', 'Next is Hart-0','Next is Hart-1','Next is Hart-2', 'Next is Diamond-0', 'Next is Diamond-1', 'Next is Diamond-2', 'Next is Spade-0', 'Next is Spade-1', 'Next is Spade-2'];

    for (let i = 0; i < plo5FlopBetNames.length; ++i)
        testSideBetTimes50000(plo5FlopBetNames[i], 'plo5', SideBetState.Flop);

    for (let i = 0; i < plo5FlopBetNames.length; ++i)
        testSideBetTimes50000(plo5FlopBetNames[i], 'plo5', SideBetState.Turn);


    /** Plo 6 */
   
    for (let i = 0; i < plo5PreCardsBetNames.length; ++i)
        testSideBetTimes50000(plo5PreCardsBetNames[i], 'plo6', SideBetState.PreCards);

    for (let i = 0; i < plo5PreFlopBetNames.length; ++i)
        testSideBetTimes50000(plo5PreFlopBetNames[i], 'plo6', SideBetState.PreFlop);

       for (let i = 0; i < plo5FlopBetNames.length; ++i)
        testSideBetTimes50000(plo5FlopBetNames[i], 'plo6', SideBetState.Flop);

    for (let i = 0; i < plo5FlopBetNames.length; ++i)
        testSideBetTimes50000(plo5FlopBetNames[i], 'plo6', SideBetState.Turn);
}());
