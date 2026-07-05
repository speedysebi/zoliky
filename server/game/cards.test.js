import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, cut, cardPoints } from './cards.js';

describe('createDeck', () => {
  it('has 110 cards: 104 suited + 6 jokers', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(110);
    expect(deck.filter(c => c.joker)).toHaveLength(6);
    expect(deck.filter(c => !c.joker)).toHaveLength(104);
  });
  it('has exactly 2 copies of each suit+rank and unique ids', () => {
    const deck = createDeck();
    const counts = {};
    for (const c of deck.filter(c => !c.joker)) {
      counts[`${c.suit}${c.rank}`] = (counts[`${c.suit}${c.rank}`] || 0) + 1;
    }
    expect(Object.keys(counts)).toHaveLength(52);
    expect(Object.values(counts).every(n => n === 2)).toBe(true);
    expect(new Set(deck.map(c => c.id)).size).toBe(110);
  });
});

describe('shuffle', () => {
  it('preserves the card multiset and returns a new array', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck, () => 0.42);
    expect(shuffled).not.toBe(deck);
    expect(new Set(shuffled.map(c => c.id))).toEqual(new Set(deck.map(c => c.id)));
  });
});

describe('cut', () => {
  it('rotates the deck at the index', () => {
    const deck = createDeck();
    const cutDeck = cut(deck, 40);
    expect(cutDeck[0].id).toBe(deck[40].id);
    expect(cutDeck[cutDeck.length - 1].id).toBe(deck[39].id);
    expect(cutDeck).toHaveLength(110);
  });
});

describe('cardPoints', () => {
  it('scores A/K/Q/J as 10, numbers as face value, joker as 50', () => {
    expect(cardPoints({ suit: 'S', rank: 1, joker: false })).toBe(10);
    expect(cardPoints({ suit: 'S', rank: 13, joker: false })).toBe(10);
    expect(cardPoints({ suit: 'S', rank: 12, joker: false })).toBe(10);
    expect(cardPoints({ suit: 'S', rank: 11, joker: false })).toBe(10);
    expect(cardPoints({ suit: 'S', rank: 10, joker: false })).toBe(10);
    expect(cardPoints({ suit: 'S', rank: 7, joker: false })).toBe(7);
    expect(cardPoints({ suit: 'S', rank: 2, joker: false })).toBe(2);
    expect(cardPoints({ joker: true, suit: null, rank: null })).toBe(50);
  });
});
