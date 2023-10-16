import { shuffle } from "./random";
import { Hand } from "pokersolver";

export type Card =
    'AS' | 'KS' | 'QS' | 'JS' | 'TS' | '9S' | '8S' | '7S' | '6S' | '5S' | '4S' | '3S' | '2S' |
    'AH' | 'KH' | 'QH' | 'JH' | 'TH' | '9H' | '8H' | '7H' | '6H' | '5H' | '4H' | '3H' | '2H' |
    'AD' | 'KD' | 'QD' | 'JD' | 'TD' | '9D' | '8D' | '7D' | '6D' | '5D' | '4D' | '3D' | '2D' |
    'AC' | 'KC' | 'QC' | 'JC' | 'TC' | '9C' | '8C' | '7C' | '6C' | '5C' | '4C' | '3C' | '2C';

export type CardSuit = 'S' | 'H' | 'D' | 'C';

export type CardFace = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export function createDeck(): Card[] {
    return [
        'AS', 'KS', 'QS', 'JS', 'TS', '9S', '8S', '7S', '6S', '5S', '4S', '3S', '2S',
        'AH', 'KH', 'QH', 'JH', 'TH', '9H', '8H', '7H', '6H', '5H', '4H', '3H', '2H',
        'AD', 'KD', 'QD', 'JD', 'TD', '9D', '8D', '7D', '6D', '5D', '4D', '3D', '2D',
        'AC', 'KC', 'QC', 'JC', 'TC', '9C', '8C', '7C', '6C', '5C', '4C', '3C', '2C'
    ];
}

export function shuffleCards(cards: Card[]): Card[] {
    return shuffle(cards);
}

export enum HandRank {
    None, // 0
    HighCard, // 1
    Pair, // 2
    TwoPair, // 3
    ThreeOfAKind, // 4
    Straight, // 5
    Flush, // 6
    FullHouse, // 7
    FourOfAKind, // 8
    StraightFlush, // 9
}

const NameToRank = new Map<string, HandRank>([
    ['Straight Flush', HandRank.StraightFlush],
    ['Four of a Kind', HandRank.FourOfAKind],
    ['Full House', HandRank.FullHouse],
    ['Flush', HandRank.Flush],
    ['Straight', HandRank.Straight],
    ['Three of a Kind', HandRank.ThreeOfAKind],
    ['Two Pair', HandRank.TwoPair],
    ['Pair', HandRank.Pair],
    ['High Card', HandRank.HighCard],
]);

export class HandResult {
    rank: HandRank;
    cards: Card[];

    public constructor(public readonly hand: Hand) {
        this.rank = NameToRank.get(hand.name) ?? HandRank.None;
        this.cards = hand.cards.map(card => `${card.wildValue}${card.suit}`.toUpperCase()) as Card[];
    }
}

export function solve_nlh(cards: Card[]): HandResult {
    const hand = Hand.solve(cards);
    return new HandResult(hand);
}

export function solve_plo(hand_cards: Card[], table_cards: Card[]): HandResult {
    const hand_two_cards = combinations(hand_cards).filter(card => card.length === 2);
    const table_three_cards = combinations(table_cards).filter(card => card.length === 3);

    let handResults : HandResult[] = [];
    
    hand_two_cards.forEach((o_card, i, o_cards) => {
        table_three_cards.forEach((e_card, i, e_cards) => {
            const hand_result = Hand.solve([...o_card, ...e_card]);
            handResults.push(new HandResult(hand_result));
        });
    });

    const top_hands = Hand.winners(handResults.map(result => result.hand));

    return top_hands.map(hand => handResults.find(result => result.hand === hand)!)[0];
    
}

export function winners(results: HandResult[]): HandResult[] {
    const winners = Hand.winners(results.map(result => result.hand));
    return winners.map(hand => results.find(result => result.hand === hand)!);
}

function combinations(array : Card[]) {
	const results : [Card[]] = [[]];
	for (const value of array) {
		const copy = [...results];
		for (const prefix of copy) {
			results.push(prefix.concat(value));
		}
	}
	return results;
};
  
