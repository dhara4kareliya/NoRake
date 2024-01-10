import { GameService } from "../services/game";
import { HandRank, createDeck, solve_nlh, winners } from "./card";
import { shuffle } from "./random";

export function hit() {
    const deck = shuffle(createDeck());
    const tableCards = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];
    const dealerCards = [deck.pop()!, deck.pop()!];
    const playerCards = [deck.pop()!, deck.pop()!];

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
        winningOdd: (isPlayerWin && !isDealerWin) ? 2 : (isPlayerWin && isDealerWin) ? 1 : 0
    }
}

const ratios = [2, 2, 0, 0, 4, 6, 10, 20, 100, 300, 1000];
const royalCheckSum = ['A', 'K', 'Q', 'J', 'T']
    .reduce((initialSum: number, current: any) => initialSum + current.charCodeAt(), 0);

export function dealMe() {
    const deck = shuffle(createDeck());
    const tableCards = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];
    const playerCards = [deck.pop()!, deck.pop()!];

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
        winningOdd: ratio
    }
}