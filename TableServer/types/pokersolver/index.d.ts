declare module 'pokersolver' {
    export class Card {
        value: string;
        suit: string;
        rank: number;
        wildValue: string;
    }

    export class Hand {
        cards: Card[];
        descr: string;
        name: string;
        rank: number;
        static solve(cards: string[], game?: string, canDisqualify?: boolean): Hand;
        static winners(hands: Hand[]): Hand[];
    }
}
