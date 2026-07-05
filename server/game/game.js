import { createDeck, shuffle, cut, cardPoints } from './cards.js';
import { validateMeld } from './melds.js';

let nextId = 1;

export class Game {
  constructor(config = {}) {
    this.config = {
      openingThreshold: 51,
      meldDelayEnabled: true,
      meldDelayTurn: 4
    };
    this.#applyConfig(config);
    this.phase = 'lobby';
    this.players = [];
    this.hostId = null;
    this.dealerIndex = -1;
    this.currentIndex = -1;
    this.drawPile = [];
    this.discardPile = [];
    this.closingCard = null;
    this.melds = [];
    this.laps = {};
    this.hasDrawn = false;
    this.roundNumber = 0;
    this.roundResult = null;
    this.pendingCarryover = null;
    this.pendingDeck = null;
    this.nextMeldId = 1;
    this.rng = Math.random;
  }

  #applyConfig(partial) {
    if (partial.openingThreshold !== undefined) {
      if (![42, 51].includes(partial.openingThreshold)) throw new Error('Opening threshold must be 42 or 51');
      this.config.openingThreshold = partial.openingThreshold;
    }
    if (partial.meldDelayEnabled !== undefined) this.config.meldDelayEnabled = !!partial.meldDelayEnabled;
    if (partial.meldDelayTurn !== undefined) {
      if (!Number.isInteger(partial.meldDelayTurn) || partial.meldDelayTurn < 1) throw new Error('Meld-delay turn must be a positive integer');
      this.config.meldDelayTurn = partial.meldDelayTurn;
    }
  }

  player(playerId) {
    const p = this.players.find(p => p.id === playerId);
    if (!p) throw new Error('Unknown player');
    return p;
  }

  join(name) {
    name = String(name || '').trim();
    if (!name) throw new Error('Name required');
    const existing = this.players.find(p => p.name === name);
    if (this.phase === 'lobby') {
      if (existing) throw new Error('Name already taken');
      if (this.players.length >= 6) throw new Error('Table is full (6 players max)');
      const id = `p${nextId++}`;
      this.players.push({ id, name, connected: true, hand: [], melded: false, score: 0 });
      if (!this.hostId) this.hostId = id;
      return id;
    }
    if (existing) { existing.connected = true; return existing.id; }
    throw new Error('Match already in progress');
  }

  markConnected(playerId, connected) {
    const p = this.players.find(p => p.id === playerId);
    if (p) p.connected = connected;
  }

  setConfig(playerId, partial) {
    if (playerId !== this.hostId) throw new Error('Only the host can change house rules');
    if (this.phase !== 'lobby') throw new Error('House rules are locked once the match starts');
    this.#applyConfig(partial);
  }

  startMatch(playerId) {
    if (playerId !== this.hostId) throw new Error('Only the host can start the match');
    if (this.phase !== 'lobby') throw new Error('Match already started');
    if (this.players.length < 2) throw new Error('Need at least 2 players');
    this.dealerIndex = 0;
    this.roundNumber = 1;
    this.#startCutting();
  }

  #startCutting() {
    this.pendingDeck = shuffle(createDeck(), this.rng);
    this.phase = 'cutting';
  }

  get cutterId() {
    return this.players[(this.dealerIndex + 1) % this.players.length].id;
  }

  cutDeck(playerId, index) {
    if (this.phase !== 'cutting') throw new Error('Not in cutting phase');
    if (playerId !== this.cutterId) throw new Error('Only the player left of the dealer cuts');
    if (!Number.isInteger(index) || index < 1 || index > this.pendingDeck.length - 1) {
      throw new Error('Cut index out of range');
    }
    this.#deal(cut(this.pendingDeck, index));
  }

  #deal(deck) {
    const n = this.players.length;
    const carry = this.pendingCarryover || {};
    // pull carried jokers out of the deck up front
    const totalCarry = Object.values(carry).reduce((a, b) => a + b, 0);
    const jokerPool = [];
    for (let i = deck.length - 1; i >= 0 && jokerPool.length < totalCarry; i--) {
      if (deck[i].joker) jokerPool.push(...deck.splice(i, 1));
    }
    for (const p of this.players) {
      p.hand = [];
      p.melded = false;
    }
    this.melds = [];
    this.nextMeldId = 1;
    for (let offset = 1; offset <= n; offset++) {
      const p = this.players[(this.dealerIndex + offset) % n];
      const target = offset === 1 ? 15 : 14;
      const jokers = jokerPool.splice(0, carry[p.id] || 0);
      p.hand = [...jokers, ...deck.splice(0, target - jokers.length)];
    }
    this.closingCard = deck.shift();
    this.drawPile = deck;
    this.discardPile = [];
    this.currentIndex = (this.dealerIndex + 1) % n;
    this.laps = Object.fromEntries(this.players.map(p => [p.id, 0]));
    this.laps[this.players[this.currentIndex].id] = 1;
    this.hasDrawn = true; // first player's 15th card counts as their draw
    this.pendingCarryover = null;
    this.pendingDeck = null;
    this.roundResult = null;
    this.phase = 'playing';
  }
}
