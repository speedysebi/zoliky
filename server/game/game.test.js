import { describe, it, expect } from 'vitest';
import { Game } from './game.js';

export function makeGame(numPlayers, config = {}) {
  const game = new Game(config);
  const ids = [];
  for (let i = 0; i < numPlayers; i++) ids.push(game.join(`P${i}`));
  return { game, ids };
}

export function startPlaying(numPlayers, config = {}) {
  const { game, ids } = makeGame(numPlayers, config);
  game.startMatch(ids[0]);
  game.cutDeck(game.cutterId, 30);
  return { game, ids };
}

describe('lobby', () => {
  it('first joiner is host; max 6 players; unique names', () => {
    const game = new Game();
    const a = game.join('Ana');
    expect(game.hostId).toBe(a);
    expect(() => game.join('Ana')).toThrow();
    for (let i = 0; i < 5; i++) game.join(`P${i}`);
    expect(() => game.join('Seventh')).toThrow();
  });
  it('only host can set config, only in lobby, and values are validated', () => {
    const { game, ids } = makeGame(2);
    game.setConfig(ids[0], { openingThreshold: 42, meldDelayTurn: 3 });
    expect(game.config.openingThreshold).toBe(42);
    expect(game.config.meldDelayTurn).toBe(3);
    expect(() => game.setConfig(ids[1], { openingThreshold: 51 })).toThrow();
    expect(() => game.setConfig(ids[0], { openingThreshold: 40 })).toThrow();
    game.startMatch(ids[0]);
    expect(() => game.setConfig(ids[0], { openingThreshold: 51 })).toThrow();
  });
  it('needs host and >=2 players to start; then phase is cutting', () => {
    const game = new Game();
    const a = game.join('Ana');
    expect(() => game.startMatch(a)).toThrow();
    const b = game.join('Ben');
    expect(() => game.startMatch(b)).toThrow();
    game.startMatch(a);
    expect(game.phase).toBe('cutting');
    expect(game.cutterId).toBe(b); // left of dealer (P0 deals round 1)
  });
  it('reattaches by name after start instead of adding a seat', () => {
    const { game, ids } = makeGame(2);
    game.startMatch(ids[0]);
    expect(game.join('P1')).toBe(ids[1]);
    expect(() => game.join('Newcomer')).toThrow();
  });
});

describe('cut and deal', () => {
  it('only the cutter may cut, with a sane index', () => {
    const { game, ids } = makeGame(3);
    game.startMatch(ids[0]);
    expect(() => game.cutDeck(ids[0], 30)).toThrow();
    expect(() => game.cutDeck(game.cutterId, 0)).toThrow();
    expect(() => game.cutDeck(game.cutterId, 110)).toThrow();
    game.cutDeck(game.cutterId, 30);
    expect(game.phase).toBe('playing');
  });
  it.each([2, 3, 4, 5, 6])('deals correctly for %i players', n => {
    const { game } = startPlaying(n);
    const first = game.players[(game.dealerIndex + 1) % n];
    expect(first.hand).toHaveLength(15);
    for (const p of game.players) if (p !== first) expect(p.hand).toHaveLength(14);
    expect(game.closingCard).toBeTruthy();
    expect(game.discardPile).toHaveLength(0);
    expect(game.drawPile).toHaveLength(110 - 15 - 14 * (n - 1) - 1);
    // first player already holds their draw (the 15th card) and must discard
    expect(game.players[game.currentIndex].id).toBe(first.id);
    expect(game.hasDrawn).toBe(true);
    expect(game.laps[first.id]).toBe(1);
    expect(game.roundNumber).toBe(1);
  });
  it('all dealt cards are distinct and account for the whole deck', () => {
    const { game } = startPlaying(4);
    const all = [
      ...game.drawPile, game.closingCard,
      ...game.players.flatMap(p => p.hand)
    ];
    expect(new Set(all.map(c => c.id)).size).toBe(110);
  });
});

// helpers for rigging
const card = (suit, rank, tag = '0') => ({ id: `${suit}${rank}-${tag}`, suit, rank, joker: false });
const jok = (n = 0) => ({ id: `JOKER-${n}`, suit: null, rank: null, joker: true });
const cur = game => game.players[game.currentIndex];

describe('drawing', () => {
  it('draws from the deck once per turn', () => {
    const { game } = startPlaying(2);
    // first player already drew (15 cards)
    expect(() => game.draw(cur(game).id, 'deck')).toThrow();
    game.discard(cur(game).id, cur(game).hand[0].id);
    const p = cur(game);
    const before = p.hand.length;
    game.draw(p.id, 'deck');
    expect(p.hand).toHaveLength(before + 1);
    expect(() => game.draw(p.id, 'deck')).toThrow(); // already drew
  });
  it('rejects out-of-turn moves', () => {
    const { game, ids } = startPlaying(2);
    const other = ids.find(id => id !== cur(game).id);
    expect(() => game.discard(other, 'anything')).toThrow();
    expect(() => game.draw(other, 'deck')).toThrow();
  });
  it('blocks discard-pile pickup before the meld-delay turn and allows it after', () => {
    const { game } = startPlaying(2, { meldDelayTurn: 2 });
    game.discard(cur(game).id, cur(game).hand[0].id); // P1's lap 1 ends, discard pile has 1
    const p = cur(game); // second player, lap 1
    expect(() => game.draw(p.id, 'discard')).toThrow();
    game.draw(p.id, 'deck');
    game.discard(p.id, p.hand[0].id);
    const p1 = cur(game); // first player again, lap 2 -> allowed
    const top = game.discardPile[game.discardPile.length - 1];
    game.draw(p1.id, 'discard');
    expect(p1.hand.some(c => c.id === top.id)).toBe(true);
  });
  it('allows discard pickup from turn 1 when meld-delay is disabled', () => {
    const { game } = startPlaying(2, { meldDelayEnabled: false });
    game.discard(cur(game).id, cur(game).hand[0].id);
    const p = cur(game);
    game.draw(p.id, 'discard');
    expect(game.discardPile).toHaveLength(0);
  });
  it('recycles the discard pile (minus top card) when the draw pile empties', () => {
    const { game } = startPlaying(2);
    game.discardPile = [card('S', 2, 'x1'), card('S', 3, 'x2'), card('S', 4, 'x3')];
    game.drawPile = [];
    game.discard(cur(game).id, cur(game).hand[0].id); // now next player draws
    const p = cur(game);
    game.draw(p.id, 'deck');
    // top discard (the one just discarded) stays; the rest became the draw pile (1 drawn)
    expect(game.discardPile).toHaveLength(1);
    expect(game.drawPile.length).toBe(2); // 3 recycled - 1 drawn
  });
});

describe('melding', () => {
  function riggedGame(handCards, { open = false, config } = {}) {
    const { game } = startPlaying(2, config);
    // make it the first player's turn with a rigged hand, already drawn
    const p = cur(game);
    p.hand = [...handCards, card('C', 2, 'filler1'), card('D', 9, 'filler2')];
    p.melded = open;
    game.laps[p.id] = 99; // past any meld delay
    return { game, p };
  }

  it('blocks melding before the meld-delay turn begins', () => {
    const { game } = startPlaying(2, { meldDelayTurn: 4 });
    const p = cur(game);
    p.hand = [card('H', 5), card('H', 6), card('H', 7), card('S', 1, 'a'), ...p.hand.slice(4)];
    expect(game.laps[p.id]).toBe(1);
    expect(() => game.meld(p.id, [['H5-0', 'H6-0', 'H7-0']])).toThrow();
  });
  it('allows melding from turn 1 when meld-delay is disabled', () => {
    const { game, p } = (() => {
      const { game } = startPlaying(2, { meldDelayEnabled: false });
      const p = cur(game);
      p.hand = [
        card('H', 8), card('H', 9), card('H', 10), card('H', 11), card('H', 12), card('H', 13),
        ...p.hand.slice(6)
      ]; // 8+9+10+10+10+10 = 57 >= 51 opening threshold
      return { game, p };
    })();
    game.laps[p.id] = 1;
    game.meld(p.id, [['H8-0', 'H9-0', 'H10-0', 'H11-0', 'H12-0', 'H13-0']]);
    expect(game.melds).toHaveLength(1);
  });
  it('rejects opening below the threshold', () => {
    const { game, p } = riggedGame([card('H', 2), card('H', 3), card('H', 4)]);
    // 2+3+4 = 9 < 51
    expect(() => game.meld(p.id, [['H2-0', 'H3-0', 'H4-0']])).toThrow();
    expect(p.hand).toHaveLength(5); // unchanged
  });
  it('accepts opening at/above threshold with a pure sequence; sums multiple melds', () => {
    const { game, p } = riggedGame([
      card('H', 10), card('H', 11), card('H', 12),   // 30, pure sequence
      card('S', 9), card('D', 9), card('C', 9)       // 27 set -> total 57 >= 51
    ]);
    game.meld(p.id, [['H10-0', 'H11-0', 'H12-0'], ['S9-0', 'D9-0', 'C9-0']]);
    expect(p.melded).toBe(true);
    expect(game.melds).toHaveLength(2);
    expect(p.hand).toHaveLength(2);
  });
  it('respects the 42 threshold config', () => {
    const { game, p } = riggedGame(
      [card('H', 12), card('H', 13), card('H', 1), card('H', 2, 'z')],
      { config: { openingThreshold: 42 } }
    );
    // Q-K-A = 30 < 42 -> reject; hand unchanged
    expect(() => game.meld(p.id, [['H12-0', 'H13-0', 'H1-0']])).toThrow();
  });
  it('rejects opening without a pure sequence even above threshold', () => {
    const { game, p } = riggedGame([
      card('H', 10), jok(0), card('H', 12),          // sequence with joker (30)
      card('S', 13), card('D', 13), card('C', 13)    // pure SET (30) -- not a sequence
    ]);
    expect(() => game.meld(p.id, [['H10-0', 'JOKER-0', 'H12-0'], ['S13-0', 'D13-0', 'C13-0']])).toThrow();
  });
  it('after opening, single small melds are fine', () => {
    const { game, p } = riggedGame([card('H', 2), card('H', 3), card('H', 4)], { open: true });
    game.meld(p.id, [['H2-0', 'H3-0', 'H4-0']]);
    expect(game.melds).toHaveLength(1);
  });
  it('rejects melds using cards not in hand, duplicate ids, or invalid shapes', () => {
    const { game, p } = riggedGame([card('H', 5), card('H', 6), card('H', 7)], { open: true });
    expect(() => game.meld(p.id, [['H5-0', 'H6-0', 'NOT-A-CARD']])).toThrow();
    expect(() => game.meld(p.id, [['H5-0', 'H5-0', 'H6-0']])).toThrow();
    expect(() => game.meld(p.id, [['H5-0', 'H6-0']])).toThrow();
  });
  it('may not meld away the whole hand (must keep a discard)', () => {
    const { game } = startPlaying(2);
    const p = cur(game);
    p.melded = true;
    game.laps[p.id] = 99;
    p.hand = [card('H', 5), card('H', 6), card('H', 7)];
    expect(() => game.meld(p.id, [['H5-0', 'H6-0', 'H7-0']])).toThrow();
  });
});

describe('adding to melds', () => {
  function withTableMeld() {
    const { game } = startPlaying(2);
    const p = cur(game);
    game.laps[p.id] = 99;
    game.melds.push({ id: 'm1', ownerId: 'someone', cards: [card('H', 5, 'm'), card('H', 6, 'm'), card('H', 7, 'm')] });
    return { game, p };
  }
  it('requires the player to have opened', () => {
    const { game, p } = withTableMeld();
    p.hand = [card('H', 8), ...p.hand.slice(1)];
    expect(() => game.addToMeld(p.id, 'm1', ['H8-0'], 'end')).toThrow();
  });
  it('extends a sequence at either end and a set to 4', () => {
    const { game, p } = withTableMeld();
    p.melded = true;
    p.hand = [card('H', 8), card('H', 4), ...p.hand.slice(2)];
    game.addToMeld(p.id, 'm1', ['H8-0'], 'end');
    game.addToMeld(p.id, 'm1', ['H4-0'], 'start');
    expect(game.melds[0].cards.map(c => c.rank)).toEqual([4, 5, 6, 7, 8]);
  });
  it('rejects invalid extensions, leaving state unchanged', () => {
    const { game, p } = withTableMeld();
    p.melded = true;
    p.hand = [card('S', 9), ...p.hand.slice(1)];
    expect(() => game.addToMeld(p.id, 'm1', ['S9-0'], 'end')).toThrow();
    expect(game.melds[0].cards).toHaveLength(3);
    expect(p.hand.some(c => c.id === 'S9-0')).toBe(true);
  });
});

describe('discarding', () => {
  it('requires having drawn, and the card in hand; advances the turn', () => {
    const { game } = startPlaying(3);
    const p = cur(game);
    game.discard(p.id, p.hand[0].id);
    const q = cur(game);
    expect(q.id).not.toBe(p.id);
    expect(game.hasDrawn).toBe(false);
    expect(() => game.discard(q.id, q.hand[0].id)).toThrow(); // hasn't drawn
    game.draw(q.id, 'deck');
    expect(() => game.discard(q.id, 'NOT-IN-HAND')).toThrow();
  });
  it('increments the incoming player lap counter', () => {
    const { game } = startPlaying(2);
    const first = cur(game);
    game.discard(first.id, first.hand[0].id);
    const second = cur(game);
    expect(game.laps[second.id]).toBe(1);
    game.draw(second.id, 'deck');
    game.discard(second.id, second.hand[0].id);
    expect(game.laps[first.id]).toBe(2);
  });
});

describe('closing card', () => {
  it('rejects a plain closing-card draw with no go-out plan', () => {
    const { game } = startPlaying(2);
    const p = cur(game);
    expect(() => game.draw(p.id, 'closing')).toThrow();
  });
  it('rejects a plan that does not empty the hand, leaving state untouched', () => {
    const { game } = startPlaying(2);
    game.discard(cur(game).id, cur(game).hand[0].id);
    const p = cur(game);
    game.laps[p.id] = 99;
    p.melded = true;
    game.closingCard = card('H', 7, 'cc');
    p.hand = [card('H', 5), card('H', 6), card('S', 2, 'x'), card('S', 9, 'y')];
    const snapshotHand = p.hand.map(c => c.id);
    expect(() => game.draw(p.id, 'closing', {
      melds: [['H5-0', 'H6-0', 'H7-cc']],
      additions: [],
      discardId: 'S2-x'
    })).toThrow(); // S9-y would remain -> not a go-out
    expect(p.hand.map(c => c.id)).toEqual(snapshotHand);
    expect(game.closingCard.id).toBe('H7-cc');
    expect(game.phase).toBe('playing');
  });
  it('accepts a valid go-out plan and ends the round', () => {
    const { game } = startPlaying(2);
    game.discard(cur(game).id, cur(game).hand[0].id);
    const p = cur(game);
    game.laps[p.id] = 99;
    p.melded = true;
    game.closingCard = card('H', 7, 'cc');
    p.hand = [card('H', 5), card('H', 6), card('S', 2, 'x')];
    game.draw(p.id, 'closing', {
      melds: [['H5-0', 'H6-0', 'H7-cc']],
      additions: [],
      discardId: 'S2-x'
    });
    expect(game.phase).toBe('roundEnd');
    expect(game.roundResult.winnerId).toBe(p.id);
  });
});
