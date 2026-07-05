import { describe, it, expect } from 'vitest';
import { validateMeld } from './melds.js';

const c = (suit, rank) => ({ id: `${suit}${rank}-t${Math.random()}`, suit, rank, joker: false });
const joker = (n = 0) => ({ id: `JOKER-${n}`, suit: null, rank: null, joker: true });

describe('sequences', () => {
  it('accepts 3+ consecutive same suit', () => {
    const r = validateMeld([c('H', 5), c('H', 6), c('H', 7)]);
    expect(r).toMatchObject({ valid: true, type: 'sequence', pure: true, points: 18 });
  });
  it('rejects fewer than 3 cards', () => {
    expect(validateMeld([c('H', 5), c('H', 6)]).valid).toBe(false);
  });
  it('rejects mixed suits and gaps', () => {
    expect(validateMeld([c('H', 5), c('S', 6), c('H', 7)]).valid).toBe(false);
    expect(validateMeld([c('H', 5), c('H', 6), c('H', 8)]).valid).toBe(false);
  });
  it('accepts ace-low (A-2-3) and ace-high (Q-K-A), scoring A as 10', () => {
    expect(validateMeld([c('S', 1), c('S', 2), c('S', 3)]))
      .toMatchObject({ valid: true, points: 15 });
    expect(validateMeld([c('S', 12), c('S', 13), c('S', 1)]))
      .toMatchObject({ valid: true, points: 30 });
  });
  it('rejects wrap-around (K-A-2)', () => {
    expect(validateMeld([c('S', 13), c('S', 1), c('S', 2)]).valid).toBe(false);
  });
  it('allows a joker filling a slot, scored as the represented card', () => {
    const r = validateMeld([c('D', 4), joker(), c('D', 6)]);
    expect(r).toMatchObject({ valid: true, type: 'sequence', pure: false, points: 15 });
  });
  it('rejects two consecutive jokers in a sequence', () => {
    expect(validateMeld([c('D', 4), joker(0), joker(1), c('D', 7)]).valid).toBe(false);
  });
  it('allows non-adjacent jokers and jokers at the ends', () => {
    expect(validateMeld([joker(0), c('D', 5), joker(1), c('D', 7)]).valid).toBe(true);
    expect(validateMeld([c('D', 4), joker(0), c('D', 6), joker(1)]).valid).toBe(true);
  });
  it('rejects jokers that would represent out-of-range ranks', () => {
    // joker after ace-high would be rank 15
    expect(validateMeld([c('S', 13), c('S', 1), joker()]).valid).toBe(false);
    // joker before ace-low would be rank 0
    expect(validateMeld([joker(), c('S', 1), c('S', 2)]).valid).toBe(false);
  });
});

describe('sets', () => {
  it('accepts 3 and 4 of same rank, different suits', () => {
    expect(validateMeld([c('S', 9), c('H', 9), c('D', 9)]))
      .toMatchObject({ valid: true, type: 'set', pure: true, points: 27 });
    expect(validateMeld([c('S', 9), c('H', 9), c('D', 9), c('C', 9)]).valid).toBe(true);
  });
  it('rejects duplicate suits, mixed ranks, and 5+ cards', () => {
    expect(validateMeld([c('S', 9), c('S', 9), c('D', 9)]).valid).toBe(false);
    expect(validateMeld([c('S', 9), c('H', 9), c('D', 8)]).valid).toBe(false);
    expect(validateMeld([c('S', 9), c('H', 9), c('D', 9), c('C', 9), joker()]).valid).toBe(false);
  });
  it('allows jokers filling missing suits, scored as the rank', () => {
    const r = validateMeld([c('S', 12), joker(), c('D', 12)]);
    expect(r).toMatchObject({ valid: true, type: 'set', pure: false, points: 30 });
  });
  it('rejects an all-joker meld', () => {
    expect(validateMeld([joker(0), joker(1), joker(2)]).valid).toBe(false);
  });
});
