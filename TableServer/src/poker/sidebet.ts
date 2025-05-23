import { Card, combinations, HandRank } from "./card";
import { SideBetOptions } from "./table";
import { Hand } from "pokersolver";

export const howIsCardSuits = (suit: string, handCards: Card[], allowedHandSuitCount: number, tableCards: Card[], tableCardsCount: number, allowedTableSuitCount: number) => {
    if (handCards!.filter(card => card.charAt(1) === suit).length !== allowedHandSuitCount) {
        return false;
    }

    const flopCards = tableCards!.slice(0, tableCardsCount);
    if (flopCards.filter(card => card.charAt(1) === suit).length !== allowedTableSuitCount) {
        return false;
    }

    return true;
}

export const howIsCardValues = (value: string, handCards: Card[], allowedHandValueCount: number, tableCards: Card[], tableCardsCount: number, allowedTableValueCount: number) => {
    if (handCards!.filter(card => card.charAt(0) === value).length !== allowedHandValueCount) {
        return false;
    }

    const flopCards = tableCards!.slice(0, tableCardsCount);
    if (flopCards.filter(card => card.charAt(0) === value).length !== allowedTableValueCount) {
        return false;
    }

    return true;
}

export const sideBetOptions : Map<String, SideBetOptions[][]> = new Map();

const holdemSideBetOptions = [
    [
        <SideBetOptions>{ betName: "pair", ratio: 16, odds: [{ selector: () => true, value: 16 }], note: "Getting a pair as hold cards" },
        <SideBetOptions>{ betName: "suited", ratio: 4, odds: [{ selector: () => true, value: 4 }], note: "Getting 2 cards with the same suite" },
        <SideBetOptions>{ betName: "connectors", ratio: 6.5, odds: [{ selector: () => true, value: 6.5 }], note: "Getting 2 cards with the same suite" },
        <SideBetOptions>{ betName: "suited connectors", ratio: 25, odds: [{ selector: () => true, value: 25 }], note: "Getting suited connectors cards" },
        <SideBetOptions>{ betName: "Duce Seven", ratio: 75, odds: [{ selector: () => true, value: 75 }], note: "Dealt Seven-Deuce" },
        <SideBetOptions>{ betName: "Duces", ratio: 200, odds: [{ selector: () => true, value: 200 }], note: "Dealt a pair of 2s" },
        <SideBetOptions>{ betName: "Black Aces", ratio: 1200, odds: [{ selector: () => true, value: 1200 }], note: "Dealt two black aces." },
    ],
    [
        <SideBetOptions>{ betName: "Flash Draw", ratio: 8.5, odds: [{ selector: (handCards: Card[]) => handCards![0].charAt(1) === handCards![1].charAt(1), value: 8.5 }], note: "Hitting a four-card flush draw on the flop using two hole cards, excluding a completed flush." },
        <SideBetOptions>{ betName: "Flash", ratio: 100, odds: [{ selector: (handCards: Card[]) => handCards![0].charAt(1) === handCards![1].charAt(1), value: 100 }], note: "Hitting a flash" },
        <SideBetOptions>{ betName: "Stright", ratio: 70, odds: [{ selector: (handCards: Card[]) => Math.abs(cardValues.indexOf(handCards![0].charAt(0)) - cardValues.indexOf(handCards![1].charAt(0))) === 1, value: 70 }], note: "Hitting a stright" },
        <SideBetOptions>{ betName: "Set", ratio: 8, odds: [{ selector: (handCards: Card[]) => handCards![0].charAt(0) === handCards![1].charAt(0), value: 8 }], note: "Hitting a set using two hole cards (including higher hands)" },
        <SideBetOptions>{ betName: "2 pairs", ratio: 45, odds: [{ selector: (handCards: Card[]) => handCards![0].charAt(0) !== handCards![1].charAt(0), value: 45 }], note: "Hitting 2 pairs using two hole cards (including higher hands)" },
        <SideBetOptions>{ betName: "Rainbow", ratio: 2, odds: [{ selector: () => true, value: 2 }], note: "Raibow Flop (3 different colors)" },
        <SideBetOptions>{ betName: "Ace", ratio: 4.5, odds: [{ selector: () => true, value: 4.5 }], note: "There will be an Ace on the flop." },
        <SideBetOptions>{ betName: "Pair", ratio: 5.5, odds: [{ selector: () => true, value: 5.5 }], note: "The flop will contain a pair, (Excluding three of a kind)" },
        <SideBetOptions>{ betName: "high card is 7", ratio: 9, odds: [{ selector: () => true, value: 9 }], note: "The highest card on the flop will be a 7." },
        <SideBetOptions>{ betName: "One Suit", ratio: 18, odds: [{ selector: () => true, value: 18 }], note: "All the cards in the flop will be of the same suit." },
        <SideBetOptions>{ betName: "Three", ratio: 350, odds: [{ selector: () => true, value: 350 }], note: "All the cards on the flop will have the same value" },
        <SideBetOptions>{ betName: "3 Red Cards", ratio: 8, odds: [{ selector: () => true, value: 8 }], note: "All the cards on the flop will be red (Diamonds or Hearts)." },
        <SideBetOptions>{ betName: "3 Black Cards", ratio: 8, odds: [{ selector: () => true, value: 8 }], note: "All the cards on the flop will be Black (Spades or Clubs)." },
        <SideBetOptions>{ betName: "777", ratio: 4500, odds: [{ selector: (handCards: Card[]) => handCards![0].charAt(0) !== '7' && handCards![1].charAt(0) !== '7', value: 4500 }], note: "Flop comes 777" },
    ],
    [
        <SideBetOptions>{
            betName: "Next Is Ace",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardValues('A', handCards, 0, tableCards, 3, 0);
                    },
                    value: 11,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardValues('A', handCards, 2, tableCards, 3, 0) || howIsCardValues('A', handCards, 1, tableCards, 3, 0);
                    },
                    value: 14.5,
                }
            ],
            note: "Turn card is Ace"
        },
        <SideBetOptions>{
            betName: "Board will pair",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const flopCards = tableCards!.slice(0, 3);
                        const flopHand = Hand.solve(flopCards).rank;
                        if (flopHand === HandRank.ThreeOfAKind) {
                            return false;
                        }

                        if (flopHand === HandRank.Pair) {
                            return false;
                        }

                        return true;
                    },
                    value: 5,
                }
            ],
            note: "Turn will pair the board"
        },
        <SideBetOptions>{
            betName: "Three on the board",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const flopCards = tableCards!.slice(0, 3);
                        const flopHand = Hand.solve(flopCards).rank;
                        if (flopHand === HandRank.Pair) {
                            return true;
                        }

                        return false;
                    },
                    value: 22,
                }
            ],
            note: "Turn will give a three on the board"
        },
        <SideBetOptions>{
            betName: "Next is Club",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 0, tableCards, 3, 2);
                    },
                    value: 4,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 2, tableCards, 3, 2);
                    },
                    value: 5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
            ],
            note: "Turn will give 3rd Club on the board"
        },
        <SideBetOptions>{
            betName: "Next is Hart",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 0, tableCards, 3, 2);
                    },
                    value: 4,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 2, tableCards, 3, 2);
                    },
                    value: 5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
            ],
            note: "Turn will give 3rd Hart on the board"
        },
        <SideBetOptions>{
            betName: "Next is Diamond",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 0, tableCards, 3, 2);
                    },
                    value: 4,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 2, tableCards, 3, 2);
                    },
                    value: 5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
            ],
            note: "Turn will give 3rd Diamond on the board"
        },
        <SideBetOptions>{
            betName: "Next is Spade",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 0, tableCards, 3, 2);
                    },
                    value: 4,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 2, tableCards, 3, 2);
                    },
                    value: 5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
            ],
            note: "Turn will give 3rd Spade on the board"
        },
    ],
    [
        <SideBetOptions>{
            betName: "Next Is Ace",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardValues('A', handCards, 0, tableCards, 4, 0);
                    },
                    value: 11,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardValues('A', handCards, 2, tableCards, 4, 0) || howIsCardValues('A', handCards, 1, tableCards, 4, 0);
                    },
                    value: 14.5,
                }
            ],
            note: "River card is Ace"
        },
        <SideBetOptions>{
            betName: "Board will pair",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const flopCards = tableCards!.slice(0, 4);
                        const flopHand = Hand.solve(flopCards).rank;
                        if (flopHand === HandRank.ThreeOfAKind) {
                            return false;
                        }

                        if (flopHand === HandRank.Pair) {
                            return false;
                        }

                        return true;
                    },
                    value: 3.5,
                }
            ],
            note: "River will pair the board"
        },
        <SideBetOptions>{
            betName: "Three on the board",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const flopCards = tableCards!.slice(0, 4);
                        const flopHand = Hand.solve(flopCards).rank;
                        if (flopHand === HandRank.Pair) {
                            return true;
                        }

                        return false;
                    },
                    value: 22,
                }
            ],
            note: "River will give a three on the board"
        },
        <SideBetOptions>{
            betName: "Next is Club",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 0, tableCards, 4, 2);
                    },
                    value: 4,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 2, tableCards, 4, 2);
                    },
                    value: 5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4,
                },
            ],
            note: "River will give 3rd Club on the board"
        },
        <SideBetOptions>{
            betName: "Next is Hart",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 0, tableCards, 4, 2);
                    },
                    value: 4,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 2, tableCards, 4, 2);
                    },
                    value: 5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4.5,
                },
            ],
            note: "River will give 3rd Hart on the board"
        },
        <SideBetOptions>{
            betName: "Next is Diamond",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 0, tableCards, 4, 2);
                    },
                    value: 4,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 2, tableCards, 4, 2);
                    },
                    value: 5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4,
                },
            ],
            note: "River will give 3rd Diamond on the board"
        },
        <SideBetOptions>{
            betName: "Next is Spade",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 0, tableCards, 4, 2);
                    },
                    value: 4,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 2, tableCards, 4, 2);
                    },
                    value: 5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4.5,
                },
            ],
            note: "River will give 3rd Spade on the board"
        },
    ],
];

const nlh4SideBetOptions = [
    [
        <SideBetOptions>{ betName: "Aces", ratio: 16, odds: [{ selector: () => true, value: 35 }], note: "At least 2 aces." },
        <SideBetOptions>{ betName: "2 pairs", ratio: 4, odds: [{ selector: () => true, value: 85 }], note: "2 different pairs." },
        <SideBetOptions>{ betName: "Low cards", ratio: 6.5, odds: [{ selector: () => true, value: 12 }], note: "All card values are less than or equal to 7 (including ace)" },
        <SideBetOptions>{ betName: "High cards", ratio: 25, odds: [{ selector: () => true, value: 50 }], note: "All card values are greater than or equal to T (including ace)" },
        <SideBetOptions>{ betName: "Rainbow", ratio: 75, odds: [{ selector: () => true, value: 9 }], note: "4 different suits." },
        <SideBetOptions>{ betName: "Ace X suited", ratio: 200, odds: [{ selector: () => true, value: 5.5 }], note: "Ace and another card of the same suit." },
        <SideBetOptions>{ betName: "3 of a kind", ratio: 1000, odds: [{ selector: () => true, value: 100 }], note: "3 cards with the same value." },
        <SideBetOptions>{ betName: "double suited", ratio: 2000, odds: [{ selector: () => true, value: 7 }], note: "Two cards of one suit and another two cards of another suit." },
    ],
    [
        <SideBetOptions>{ betName: "Rainbow", ratio: 2.4, odds: [{ selector: () => true, value: 2.4 }], note: "Raibow Flop (3 different suites)" },
        <SideBetOptions>{ betName: "Pair", ratio: 5.5, odds: [{ selector: () => true, value: 5.5 }], note: "The flop will contain a pair, (Excluding three of a kind on the flop)" },
        <SideBetOptions>{ betName: "One Suit", ratio: 18, odds: [{ selector: () => true, value: 18 }], note: "All the cards in the flop will be of the same suit." },
        <SideBetOptions>{ betName: "Three", ratio: 370, odds: [{ selector: () => true, value: 370 }], note: "All the cards on the flop will have the same value" },
        <SideBetOptions>{ betName: "3 Red Cards", ratio: 8, odds: [{ selector: () => true, value: 8 }], note: "All the cards on the flop will be red (Diamonds or Hearts)." },
        <SideBetOptions>{ betName: "3 Black Cards", ratio: 8, odds: [{ selector: () => true, value: 8 }], note: "All the cards on the flop will be Black (Spades or Clubs)." },
    ],
    [
        <SideBetOptions>{
            betName: "Board will pair",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const flopCards = tableCards!.slice(0, 3);
                        const flopHand = Hand.solve(flopCards).rank;
                        if (flopHand === HandRank.ThreeOfAKind) {
                            return false;
                        }

                        if (flopHand === HandRank.Pair) {
                            return false;
                        }

                        return true;
                    },
                    value: 4.5,
                }
            ],
            note: "Turn will pair the board"
        },
        <SideBetOptions>{
            betName: "Three on the board",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const flopCards = tableCards!.slice(0, 3);
                        const flopHand = Hand.solve(flopCards).rank;
                        if (flopHand === HandRank.Pair) {
                            return true;
                        }

                        return false;
                    },
                    value: 20,
                }
            ],
            note: "Turn will give a three on the board"
        },
        <SideBetOptions>{
            betName: "Next is Club",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 0, tableCards, 3, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 2, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4,
                },
            ],
            note: "Turn will give 3rd Club on the board"
        },
        <SideBetOptions>{
            betName: "Next is Hart",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 0, tableCards, 3, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 2, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4,
                },
            ],
            note: "Turn will give 3rd Hart on the board"
        },
        <SideBetOptions>{
            betName: "Next is Diamond",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 0, tableCards, 3, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 2, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4,
                },
            ],
            note: "Turn will give 3rd Diamond on the board"
        },
        <SideBetOptions>{
            betName: "Next is Spade",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 0, tableCards, 3, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 2, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4,
                },
            ],
            note: "Turn will give 3rd Spade on the board"
        },
    ],
    [
        <SideBetOptions>{
            betName: "Board will pair",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const flopCards = tableCards!.slice(0, 4);
                        const flopHand = Hand.solve(flopCards).rank;
                        if (flopHand === HandRank.ThreeOfAKind) {
                            return false;
                        }

                        if (flopHand === HandRank.Pair) {
                            return false;
                        }

                        return true;
                    },
                    value: 4.5,
                }
            ],
            note: "River will pair the board"
        },
        <SideBetOptions>{
            betName: "Three on the board",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const turnCards = tableCards!.slice(0, 4);
                        const turnHand = Hand.solve(turnCards).rank;
                        if (turnHand === HandRank.Pair) {
                            return true;
                        }

                        return false;
                    },
                    value: 20,
                }
            ],
            note: "River will give a three on the board"
        },
        <SideBetOptions>{
            betName: "Next is Club",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 0, tableCards, 4, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 2, tableCards, 4, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4,
                },
            ],
            note: "River will give 3rd Club on the board"
        },
        <SideBetOptions>{
            betName: "Next is Hart",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 0, tableCards, 4, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 2, tableCards, 4, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4,
                },
            ],
            note: "River will give 3rd Hart on the board"
        },
        <SideBetOptions>{
            betName: "Next is Diamond",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 0, tableCards, 4, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 2, tableCards, 4, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4,
                },
            ],
            note: "River will give 3rd Diamond on the board"
        },
        <SideBetOptions>{
            betName: "Next is Spade",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 0, tableCards, 4, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 2, tableCards, 4, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4,
                },
            ],
            note: "River will give 3rd Spade on the board"
        },
    ],
];

const plo5SideBetOptions = [
    [
        <SideBetOptions>{ betName: "Aces", ratio: 16, odds: [{ selector: () => true, value: 23 }], note: "At least 2 aces." },
        <SideBetOptions>{ betName: "2 pairs", ratio: 4, odds: [{ selector: () => true, value: 19 }], note: "2 different pairs." },
        <SideBetOptions>{ betName: "Cards Below 7", ratio: 6.5, odds: [{ selector: () => true, value: 25 }], note: "All card values are less than or equal to 7 (ace counted as Low)" },
        <SideBetOptions>{ betName: "Cards Below 10", ratio: 25, odds: [{ selector: () => true, value: 3.5 }], note: "All card values are less than or equal to T (ace counted as Low)" },
        <SideBetOptions>{ betName: "Cards Above 5", ratio: 75, odds: [{ selector: () => true, value: 3.5 }], note: "All card values are greater than or equal to 5 (ace counted as High)" },
        <SideBetOptions>{ betName: "Cards Above 10", ratio: 200, odds: [{ selector: () => true, value: 150 }], note: "All card values are greater than or equal to T (ace counted as High)" },
        <SideBetOptions>{ betName: "3 of a kind", ratio: 1000, odds: [{ selector: () => true, value: 40 }], note: "3 cards with the same value. (4 of a kind excluded)" },
        <SideBetOptions>{ betName: "4 of a kind", ratio: 4000, odds: [{ selector: () => true, value: 4000 }], note: "4 cards with the same value." },
    ],
    [
        <SideBetOptions>{ betName: "Rainbow", ratio: 2, odds: [{ selector: () => true, value: 2 }], note: "Raibow Flop (3 different suites)" },
        <SideBetOptions>{ betName: "Pair", ratio: 5.5, odds: [{ selector: () => true, value: 5.5 }], note: "The flop will contain a pair, (Excluding three of a kind on the flop)" },
        <SideBetOptions>{ betName: "One Suit", ratio: 18, odds: [{ selector: () => true, value: 18 }], note: "All the cards in the flop will be of the same suit." },
        <SideBetOptions>{ betName: "Three", ratio: 350, odds: [{ selector: () => true, value: 350 }], note: "All the cards on the flop will have the same value" },
        <SideBetOptions>{ betName: "3 Red Cards", ratio: 8, odds: [{ selector: () => true, value: 8 }], note: "All the cards on the flop will be red (Diamonds or Hearts)." },
        <SideBetOptions>{ betName: "3 Black Cards", ratio: 8, odds: [{ selector: () => true, value: 8 }], note: "All the cards on the flop will be Black (Spades or Clubs)." },
    ],
    [
        <SideBetOptions>{
            betName: "Board will pair",
            ratio: 10,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const flopCards = tableCards!.slice(0, 3);
                        const flopHand = Hand.solve(flopCards).rank;
                        if (flopHand === HandRank.ThreeOfAKind) {
                            return false;
                        }

                        if (flopHand === HandRank.Pair) {
                            return false;
                        }

                        return true;
                    },
                    value: 10,
                }
            ],
            note: "Turn will pair the board"
        },
        <SideBetOptions>{
            betName: "Three on the board",
            ratio: 20,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const flopCards = tableCards!.slice(0, 3);
                        const flopHand = Hand.solve(flopCards).rank;
                        if (flopHand === HandRank.Pair) {
                            return true;
                        }

                        return false;
                    },
                    value: 20,
                }
            ],
            note: "Turn will give a three on the board"
        },
        <SideBetOptions>{
            betName: "Next is Club",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 0, tableCards, 3, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 2, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4,
                },
            ],
            note: "Turn will give 3rd Club on the board"
        },
        <SideBetOptions>{
            betName: "Next is Hart",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 0, tableCards, 3, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 2, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4,
                },
            ],
            note: "Turn will give 3rd Hart on the board"
        },
        <SideBetOptions>{
            betName: "Next is Diamond",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 0, tableCards, 3, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 2, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4,
                },
            ],
            note: "Turn will give 3rd Diamond on the board"
        },
        <SideBetOptions>{
            betName: "Next is Spade",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 0, tableCards, 3, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 2, tableCards, 3, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 1, tableCards, 3, 2);
                    },
                    value: 4,
                },
            ],
            note: "Turn will give 3rd Spade on the board"
        },
    ],
    [
        <SideBetOptions>{
            betName: "Board will pair",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const flopCards = tableCards!.slice(0, 4);
                        const flopHand = Hand.solve(flopCards).rank;
                        if (flopHand === HandRank.ThreeOfAKind) {
                            return false;
                        }

                        if (flopHand === HandRank.Pair) {
                            return false;
                        }

                        return true;
                    },
                    value: 4.5,
                }
            ],
            note: "River will pair the board"
        },
        <SideBetOptions>{
            betName: "Three on the board",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        const turnCards = tableCards!.slice(0, 4);
                        const turnHand = Hand.solve(turnCards).rank;
                        if (turnHand === HandRank.Pair) {
                            return true;
                        }

                        return false;
                    },
                    value: 20,
                }
            ],
            note: "River will give a three on the board"
        },
        <SideBetOptions>{
            betName: "Next is Club",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 0, tableCards, 4, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 2, tableCards, 4, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('C', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4,
                },
            ],
            note: "River will give 3rd Club on the board"
        },
        <SideBetOptions>{
            betName: "Next is Hart",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 0, tableCards, 4, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 2, tableCards, 4, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('H', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4,
                },
            ],
            note: "River will give 3rd Hart on the board"
        },
        <SideBetOptions>{
            betName: "Next is Diamond",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 0, tableCards, 4, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 2, tableCards, 4, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('D', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4,
                },
            ],
            note: "River will give 3rd Diamond on the board"
        },
        <SideBetOptions>{
            betName: "Next is Spade",
            ratio: 11,
            odds: [
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 0, tableCards, 4, 2);
                    },
                    value: 3.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 2, tableCards, 4, 2);
                    },
                    value: 4.5,
                },
                {
                    selector: (handCards: Card[], tableCards: Card[]) => {
                        return howIsCardSuits('S', handCards, 1, tableCards, 4, 2);
                    },
                    value: 4,
                },
            ],
            note: "River will give 3rd Spade on the board"
        },
    ]
];

sideBetOptions.set('nlh', holdemSideBetOptions);
sideBetOptions.set('nlh4', nlh4SideBetOptions);

const ploSideBetOptions = nlh4SideBetOptions;
sideBetOptions.set('plo', ploSideBetOptions);

sideBetOptions.set('plo5', plo5SideBetOptions);
sideBetOptions.set('plo6', plo5SideBetOptions);


const cardValues = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const evaluateSideBet = (street: any, betName: string, handCards?: Card[], tableCards?: Card[]) => {

    const functions = [
        {
            street: 'PreCards',
            funcs: [
                {
                    betName: 'pair',
                    func: () => {
                        return handCards![0].charAt(0) === handCards![1].charAt(0);
                    },
                },
                {
                    betName: 'suited',
                    func: () => {
                        return handCards![0].charAt(1) === handCards![1].charAt(1);
                    },
                },
                {
                    betName: 'connectors',
                    func: () => {
                        return Math.abs(cardValues.indexOf(handCards![0].charAt(0)) - cardValues.indexOf(handCards![1].charAt(0))) === 1;
                    },
                },
                {
                    betName: 'suited connectors',
                    func: () => {
                        return Math.abs(cardValues.indexOf(handCards![0].charAt(0)) - cardValues.indexOf(handCards![1].charAt(0))) === 1 &&
                            handCards![0].charAt(1) === handCards![1].charAt(1);
                    },
                },
                {
                    betName: 'Duce Seven',
                    func: () => {
                        return handCards!.filter(card => card.charAt(0) === '2').length > 0 &&
                            handCards!.filter(card => card.charAt(0) === '7').length > 0;
                    },
                },
                {
                    betName: 'Duces',
                    func: () => {
                        return handCards!.filter(card => card.charAt(0) === '2').length > 1;
                    },
                },
                {
                    betName: 'Black Aces',
                    func: () => {
                        return handCards!.filter(card => card.charAt(0) === 'A' && (card.charAt(1) === 'S' || card.charAt(1) === 'C')).length > 1;
                    },
                },
                {
                    betName: 'Aces',
                    func: () => {
                        return handCards!.filter(handCard => handCard.charAt(0) === 'A').length >= 2;
                    },
                },
                {
                    betName: '2 pairs',
                    func: () => {
                        const hand = Hand.solve(handCards!);
                        if (hand.rank !== HandRank.TwoPair) {
                            return false;
                        }

                        if (handCards?.filter(handCard => handCard.charAt(0) === handCards[0].charAt(0)).length! > 2) {
                            return false;
                        }
                        
                        return true;
                    },
                },
                {
                    betName: 'Low cards',
                    func: () => {
                        let isWin = true;

                        handCards!.filter(card => card.charAt(0) !== 'A')
                                .forEach(card => {
                                    const level = cardValues.indexOf(card.charAt(0));

                                    if (level < 1 || level > 6) {
                                        isWin = false;
                                    }
                                });

                        return isWin;
                    },
                },
                {
                    betName: 'High cards',
                    func: () => {
                        let isWin = true;

                        handCards!.forEach(card => {
                            const level = cardValues.indexOf(card.charAt(0));

                            if (level < 9) {
                                isWin = false;
                            }
                        });

                        return isWin;
                    },
                },
                {
                    betName: 'Cards Below 7',
                    func: () => {
                        let isWin = true;

                        handCards!.filter(card => card.charAt(0) !== 'A')
                                .forEach(card => {
                                    const level = cardValues.indexOf(card.charAt(0));

                                    if (level < 1 || level > 6) {
                                        isWin = false;
                                    }
                                });

                        return isWin;
                    },
                },
                {
                    betName: 'Cards Below 10',
                    func: () => {
                        let isWin = true;

                        handCards!.filter(card => card.charAt(0) !== 'A')
                                .forEach(card => {
                                    const level = cardValues.indexOf(card.charAt(0));

                                    if (level < 1 || level > 9) {
                                        isWin = false;
                                    }
                                });

                        return isWin;
                    },
                },
                {
                    betName: 'Cards Above 5',
                    func: () => {
                        let isWin = true;

                        handCards!.forEach(card => {
                            const level = cardValues.indexOf(card.charAt(0));

                            if (level < 4) {
                                isWin = false;
                            }
                        });

                        return isWin;
                    },
                },
                {
                    betName: 'Cards Above 10',
                    func: () => {
                        let isWin = true;

                        handCards!.forEach(card => {
                            const level = cardValues.indexOf(card.charAt(0));

                            if (level < 9) {
                                isWin = false;
                            }
                        });

                        return isWin;
                    },
                },
                {
                    betName: 'Rainbow',
                    func: () => {
                        for (let i = 0; i < handCards!.length! - 1; ++i)
                        for (let j = i + 1; j < handCards!.length!; ++j) {
                            if (handCards![i].charAt(1) === handCards![j].charAt(1)) {
                                return false;
                            }
                        }
                        return true;
                    },
                },
                {
                    betName: 'Ace X suited',
                    func: () => {
                        const hand_two_cards = combinations(handCards!).filter(card => card.length === 2);
                        let isWin = false;
                        hand_two_cards.forEach(two_cards => {
                            if (two_cards[0].charAt(1) === two_cards[1].charAt(1) 
                                && ((two_cards[0].charAt(0) === 'A' && two_cards[1].charAt(0) !== 'A')
                                    || (two_cards[1].charAt(0) === 'A' && two_cards[0].charAt(0) !== 'A'))) {
                                isWin = true;
                            }
                        });
                        return isWin;
                    },
                },
                {
                    betName: '3 of a kind',
                    func: () => {
                        const hand = Hand.solve(handCards!);

                        if (hand.rank === HandRank.ThreeOfAKind) {
                            return true;
                        }

                        return false;
                    },
                },
                {
                    betName: '4 of a kind',
                    func: () => {
                        const hand = Hand.solve(handCards!);

                        if (hand.rank === HandRank.FourOfAKind) {
                            return true;
                        }

                        return false;
                    },
                },
                {
                    betName: 'double suited',
                    func: () => {
                        const suits = handCards?.map(card => card.charAt(1));
                        let isWin = true;
                        suits?.forEach(suit => {
                            if (suits.filter(s => s === suit).length !== 2) {
                                isWin = false;
                            }
                        });

                        return isWin;
                    },
                },
            ],
        },
        {
            street: 'PreFlop',
            funcs: [
                {
                    betName: 'Flash Draw',
                    func: () => {
                        if (tableCards!.filter(tableCard => tableCard.charAt(1) === handCards![0].charAt(1)).length !== 2)
                            return false;
                        return true;
                    },
                },
                {
                    betName: 'Flash',
                    func: () => {
                        if (tableCards!.filter(tableCard => tableCard.charAt(1) === handCards![0].charAt(1)).length !== 3)
                            return false;
                        return true;
                    },
                },
                {
                    betName: 'Stright',
                    func: () => {
                        const hand = Hand.solve([...handCards!, ...tableCards!]);
                        if (hand.rank === HandRank.Straight || hand.rank === HandRank.StraightFlush)
                            return true;
                        return false;
                    },
                },
                {
                    betName: 'Set',
                    func: () => {
                        if (tableCards!.filter(tableCard => tableCard.charAt(0) === handCards![0].charAt(0)).length < 1)
                            return false;
                        return true;
                    },
                },
                {
                    betName: '2 pairs',
                    func: () => {
                        let isWin = false;
                        const table_two_cards = combinations(tableCards!).filter(card => card.length === 2);
                        table_two_cards.forEach(two_cards => {
                            const hand = Hand.solve([...handCards!, ...two_cards]);
                            if (hand.rank === HandRank.TwoPair) {
                                isWin = true;
                            }
                        })

                        return isWin;
                    },
                },
                {
                    betName: 'Rainbow',
                    func: () => {
                        let suits: Array<string> = [];
                        [...tableCards!].forEach(card => {
                            if (suits.indexOf(card.charAt(1)) < 0) {
                                suits.push(card.charAt(1));
                            }
                        });

                        if (suits.length >= 3)
                            return true;

                        return false;
                    },
                },
                {
                    betName: 'Ace',
                    func: () => {
                        const tableCardsSuits = tableCards!.map(card => card.charAt(0));
                        if (tableCardsSuits.indexOf('A') >= 0) {
                            return true;
                        }

                        return false;
                    },
                },
                {
                    betName: 'Pair',
                    func: () => {
                        const hand = Hand.solve(tableCards!);

                        if (hand.rank === HandRank.ThreeOfAKind)
                            return false;

                        if (hand.rank === HandRank.Pair)
                            return true;

                        return false;
                    },
                },
                {
                    betName: 'high card is 7',
                    func: () => {
                        let isWin = true;

                        tableCards!.forEach(card => {
                            const level = cardValues.indexOf(card.charAt(0));

                            if (level < 1 || level > 6) {
                                isWin = false;
                            }
                        });

                        return isWin;
                    },
                },
                {
                    betName: 'One Suit',
                    func: () => {
                        let isWin = true;

                        tableCards!.forEach(card => {
                            if (card.charAt(1) !== tableCards![0].charAt(1)) {
                                isWin = false;
                            }
                        });

                        return isWin;
                    },
                },
                {
                    betName: 'Three',
                    func: () => {
                        const hand = Hand.solve(tableCards!);

                        if (hand.rank === HandRank.ThreeOfAKind) {
                            return true;
                        }

                        return false;
                    },
                },
                {
                    betName: '3 Red Cards',
                    func: () => {
                        let isWin = true;
                        for (const card of tableCards!) {
                            if (card.charAt(1) === 'S' || card.charAt(1) === 'C') {
                                return false;
                            }
                        }

                        return true;
                    },
                },
                {
                    betName: '3 Black Cards',
                    func: () => {
                        for (const card of tableCards!) {
                            if (card.charAt(1) === 'D' || card.charAt(1) === 'H') {
                                return false;
                            }
                        }

                        return true;
                    },
                },
                {
                    betName: '777',
                    func: () => {
                        for (const card of tableCards!) {
                            if (card.charAt(0) !== '7') {
                                return false;
                            }
                        }

                        return true;
                    },
                },
            ]
        },
        {
            street: 'Flop',
            funcs:
                [
                    {
                        betName: 'Next Is Ace',
                        func: () => {
                            if (tableCards![3].charAt(0) !== 'A')
                                return false;

                            return true;
                        },
                    },
                    {
                        betName: 'Board will pair',
                        func: () => {
                            const tableHand = Hand.solve(tableCards!).rank;
                            if (tableHand !== HandRank.Pair) {
                                return false;
                            }

                            return true;
                        },
                    },
                    {
                        betName: 'Three on the board',
                        func: () => {
                            if (Hand.solve(tableCards!).rank === HandRank.ThreeOfAKind) {
                                return true;
                            }

                            return false;
                        },
                    },
                    {
                        betName: 'Next is Club',
                        func: () => {
                            return tableCards![3].charAt(1) === 'C';
                        },
                    },
                    {
                        betName: 'Next is Hart',
                        func: () => {
                            return tableCards![3].charAt(1) === 'H';
                        },
                    },
                    {
                        betName: 'Next is Diamond',
                        func: () => {
                            return tableCards![3].charAt(1) === 'D';
                        },
                    },
                    {
                        betName: 'Next is Spade',
                        func: () => {
                            return tableCards![3].charAt(1) === 'S';
                        },
                    },
                ],
        },
        {
            street: 'Turn',
            funcs:
                [
                    {
                        betName: 'Next Is Ace',
                        func: () => {
                            if (tableCards![4].charAt(0) !== 'A')
                                return false;

                            return true;
                        },
                    },
                    {
                        betName: 'Board will pair',
                        func: () => {
                            const tableHand = Hand.solve(tableCards!).rank;
                            if (tableHand !== HandRank.Pair) {
                                return false;
                            }

                            return true;
                        },
                    },
                    {
                        betName: 'Three on the board',
                        func: () => {
                            if (Hand.solve(tableCards!).rank === HandRank.ThreeOfAKind) {
                                return true;
                            }

                            return false;
                        },
                    },
                    {
                        betName: 'Next is Club',
                        func: () => {
                            return tableCards![4].charAt(1) === 'C';
                        },
                    },
                    {
                        betName: 'Next is Hart',
                        func: () => {
                            return tableCards![4].charAt(1) === 'H';
                        },
                    },
                    {
                        betName: 'Next is Diamond',
                        func: () => {
                            return tableCards![4].charAt(1) === 'D';
                        },
                    },
                    {
                        betName: 'Next is Spade',
                        func: () => {
                            return tableCards![4].charAt(1) === 'S';
                        },
                    },
                ],
        },
    ];

    const funcs = functions.filter(item => item.street === street)[0].funcs;
    const isWin = funcs.filter(item => item.betName === betName)[0].func();

    return isWin;
}