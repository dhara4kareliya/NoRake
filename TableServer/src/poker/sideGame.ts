import { GameService } from "../services/game";
import { HandRank,HandRankName, HandResult, createDeck, solve_nlh, winners,encryptedShuffle } from "./card";
import { shuffle } from "./random";

export function hit(shuffleKey?:string) {
    const deck = (!!shuffleKey) ? encryptedShuffle(createDeck(),shuffleKey) : shuffle(createDeck());
   
    const dealerCards = [deck.pop()!, deck.pop()!];
    const playerCards = [deck.pop()!, deck.pop()!];
    const tableCards = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];

    const dealerHand = solve_nlh([...dealerCards, ...tableCards]);
    const playerHand = solve_nlh([...playerCards, ...tableCards]);

    const winnersHand = winners([dealerHand, playerHand]);
    const isPlayerWin = winnersHand.includes(playerHand);
    const isDealerWin = winnersHand.includes(dealerHand);

    return {
        tableCards,
        dealerCards,
        playerCards,
        winnersHand,
        winnerRank: HandRankName[winnersHand[0].rank],
        winningOdd: (isPlayerWin && !isDealerWin) ? 2 : 0
    }
}

const ratios = [2, 3, 0, 0, 4, 5, 10, 15, 100, 300, 1000];
const royalCheckSum = ['A', 'K', 'Q', 'J', 'T']
    .reduce((initialSum: number, current: any) => initialSum + current.charCodeAt(), 0);

export function dealMe(shuffleKey?:string) {
    const deck = (!!shuffleKey) ? encryptedShuffle(createDeck(),shuffleKey) : shuffle(createDeck());
    const playerCards = [deck.pop()!, deck.pop()!];
    const tableCards = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];
   

    const playerHand = solve_nlh([...playerCards, ...tableCards]);
    const winnersHand = winners([playerHand]);

    let ratio = ratios[playerHand.rank];
    if (playerHand.rank === HandRank.StraightFlush) {
        const checkSum = playerHand.cards
            .reduce((initialSum: number, current: any) => initialSum + current.charAt(0).charCodeAt(), 0);

        if (checkSum === royalCheckSum) {
            ratio = ratios[HandRank.StraightFlush + 1];
        }
    }

    return {
        tableCards,
        playerCards,
        winnersHand,
        winnerRank: HandRankName[winnersHand[0].rank],
        winningOdd: ratio
    }
}