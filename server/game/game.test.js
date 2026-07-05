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
