import { Card } from "./poker/card";
import { evaluateSideBet } from "./sidebet";

interface SideBetCase {
    betName: string,
    handCards: string,
    tableCards: string
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

function testSideBetOnPreCards() {
    console.log(`************* Pre Cards *************`);

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

function testSideBetOnPreFlop() {
    console.log(`************* Pre Flop *************`);

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
            handCards: 'AS,AD',
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

function testSideBetOnFlop() {
    console.log(`************* Flop *************`);

    const flopCases = [
        {
            betName: 'Next Is Ace 0',
            handCards: '2S,3S',
            tableCards: '5S,6S,3D,AC',
        },
        {
            betName: 'Next Is Ace 0',
            handCards: '2S,3S',
            tableCards: '4S,5S,AS,AD',
        },
        {
            betName: 'Next Is Ace 1',
            handCards: '2S,AS',
            tableCards: '4S,5S,3C,AS',
        },
        {
            betName: 'Next Is Ace 1',
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
            betName: 'Next is Club 0',
            handCards: 'AS,KS',
            tableCards: 'AC,KC,QH,2C',
        },
        {
            betName: 'Next is Club 0',
            handCards: 'AS,KS',
            tableCards: 'AD,QC,QH,2C',
        },
        {
            betName: 'Next is Club 1',
            handCards: 'AC,KC',
            tableCards: 'AC,KC,QH,2C',
        },
        {
            betName: 'Next is Club 1',
            handCards: 'AS,KC',
            tableCards: 'AD,QC,QH,2C',
        },
        {
            betName: 'Next is Club 2',
            handCards: 'AS,KC',
            tableCards: 'AC,KC,QH,2C',
        },
        {
            betName: 'Next is Club 2',
            handCards: 'AC,KC',
            tableCards: 'AD,QC,QH,2C',
        },
    ];

    dump('Flop', flopCases);

    console.log('\n');
}

(function main() {
    testSideBetOnPreCards();
    testSideBetOnPreFlop();
    testSideBetOnFlop();
}());
