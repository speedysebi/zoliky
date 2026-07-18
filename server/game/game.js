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

  // ---- turn helpers ----
  #requireTurn(playerId) {
    if (this.phase !== 'playing') throw new Error('Not in a round');
    const p = this.player(playerId);
    if (this.players[this.currentIndex].id !== playerId) throw new Error('Not your turn');
    return p;
  }

  canMeldNow(playerId) {
    if (!this.config.meldDelayEnabled) return true;
    return (this.laps[playerId] || 0) >= this.config.meldDelayTurn;
  }

  #takeFromHand(p, cardIds) {
    if (new Set(cardIds).size !== cardIds.length) throw new Error('Duplicate cards in move');
    const cards = cardIds.map(id => {
      const c = p.hand.find(c => c.id === id);
      if (!c) throw new Error('Card not in your hand');
      return c;
    });
    p.hand = p.hand.filter(c => !cards.includes(c));
    return cards;
  }

  draw(playerId, source, plan) {
    const p = this.#requireTurn(playerId);
    if (this.hasDrawn) throw new Error('You already drew this turn');
    if (source === 'deck') {
      if (this.drawPile.length === 0) this.#recycleDiscard();
      if (this.drawPile.length === 0) throw new Error('No cards left to draw');
      p.hand.push(this.drawPile.shift());
      this.hasDrawn = true;
    } else if (source === 'discard') {
      if (!this.canMeldNow(playerId)) throw new Error('Discard pickup is locked until the meld turn begins');
      if (this.discardPile.length === 0) throw new Error('Discard pile is empty');
      p.hand.push(this.discardPile.pop());
      this.hasDrawn = true;
    } else if (source === 'closing') {
      this.#drawClosing(p, plan);
    } else {
      throw new Error('Unknown draw source');
    }
  }

  #recycleDiscard() {
    if (this.discardPile.length <= 1) return;
    const top = this.discardPile.pop();
    this.drawPile = shuffle(this.discardPile, this.rng);
    this.discardPile = [top];
  }

  #drawClosing(p, plan) {
    if (!this.closingCard) throw new Error('Closing card already taken');
    if (!plan || typeof plan !== 'object') throw new Error('Taking the closing card requires going out this turn');
    const snapshot = structuredClone({
      hand: p.hand, melded: p.melded, melds: this.melds, closingCard: this.closingCard
    });
    try {
      p.hand.push(this.closingCard);
      this.closingCard = null;
      this.hasDrawn = true;
      this.#doMelds(p, plan.melds || []);
      for (const add of plan.additions || []) {
        this.#doAddToMeld(p, add.meldId, add.cardIds, add.where);
      }
      if (p.hand.length !== 1 || p.hand[0].id !== plan.discardId) {
        throw new Error('Closing card may only be taken if you meld out and win this turn');
      }
    } catch (err) {
      p.hand = snapshot.hand;
      p.melded = snapshot.melded;
      this.melds = snapshot.melds;
      this.closingCard = snapshot.closingCard;
      this.hasDrawn = false;
      throw err;
    }
    this.discard(p.id, plan.discardId);
  }

  #doMelds(p, meldsCardIds) {
    if (meldsCardIds.length === 0) return;
    if (!this.canMeldNow(p.id)) {
      throw new Error(`No melding until turn ${this.config.meldDelayTurn} begins`);
    }
    const allIds = meldsCardIds.flat();
    if (new Set(allIds).size !== allIds.length) throw new Error('Duplicate cards in move');
    const validated = meldsCardIds.map(ids => {
      const cards = ids.map(id => {
        const c = p.hand.find(c => c.id === id);
        if (!c) throw new Error('Card not in your hand');
        return c;
      });
      const result = validateMeld(cards);
      if (!result.valid) throw new Error('Invalid meld');
      return { cards, ...result };
    });
    if (!p.melded) {
      const total = validated.reduce((sum, m) => sum + m.points, 0);
      if (total < this.config.openingThreshold) {
        throw new Error(`Opening requires at least ${this.config.openingThreshold} points (you laid ${total})`);
      }
      if (!validated.some(m => m.type === 'sequence' && m.pure)) {
        throw new Error('Opening requires at least one pure sequence (no joker)');
      }
    }
    if (allIds.length >= p.hand.length) throw new Error('You must keep a card to discard');
    for (const m of validated) {
      p.hand = p.hand.filter(c => !m.cards.includes(c));
      this.melds.push({ id: `m${this.nextMeldId++}`, ownerId: p.id, cards: m.cards });
    }
    p.melded = true;
  }

  meld(playerId, meldsCardIds) {
    const p = this.#requireTurn(playerId);
    if (!this.hasDrawn) throw new Error('Draw a card first');
    if (!Array.isArray(meldsCardIds) || meldsCardIds.length === 0) throw new Error('No melds given');
    this.#doMelds(p, meldsCardIds);
  }

  #doAddToMeld(p, meldId, cardIds, where = 'end') {
    if (!this.canMeldNow(p.id)) {
      throw new Error(`No melding until turn ${this.config.meldDelayTurn} begins`);
    }
    if (!p.melded) throw new Error('You must open with your own meld first');
    const meld = this.melds.find(m => m.id === meldId);
    if (!meld) throw new Error('Unknown meld');
    if (!Array.isArray(cardIds) || cardIds.length === 0) throw new Error('No cards given');
    if (cardIds.length >= p.hand.length) throw new Error('You must keep a card to discard');
    if (new Set(cardIds).size !== cardIds.length) throw new Error('Duplicate cards in move');
    const cards = cardIds.map(id => {
      const c = p.hand.find(c => c.id === id);
      if (!c) throw new Error('Card not in your hand');
      return c;
    });
    const arrangement = where === 'start' ? [...cards, ...meld.cards] : [...meld.cards, ...cards];
    if (!validateMeld(arrangement).valid) throw new Error('That card does not fit this meld');
    p.hand = p.hand.filter(c => !cards.includes(c));
    meld.cards = arrangement;
  }

  addToMeld(playerId, meldId, cardIds, where = 'end') {
    const p = this.#requireTurn(playerId);
    if (!this.hasDrawn) throw new Error('Draw a card first');
    this.#doAddToMeld(p, meldId, cardIds, where);
  }

  discard(playerId, cardId) {
    const p = this.#requireTurn(playerId);
    if (!this.hasDrawn) throw new Error('Draw a card first');
    const [cardObj] = this.#takeFromHand(p, [cardId]);
    this.discardPile.push(cardObj);
    if (p.hand.length === 0) {
      this.#endRound(p);
      return;
    }
    this.currentIndex = (this.currentIndex + 1) % this.players.length;
    const next = this.players[this.currentIndex];
    this.laps[next.id] = (this.laps[next.id] || 0) + 1;
    this.hasDrawn = false;
  }

  #endRound(winner) {
    const penalties = {};
    const carryover = {};
    let totalJokers = 0;
    for (const p of this.players) {
      if (p.id === winner.id) continue;
      penalties[p.id] = p.hand.reduce((sum, c) => sum + cardPoints(c), 0);
      p.score += penalties[p.id];
      const jokers = p.hand.filter(c => c.joker).length;
      if (jokers > 0) { carryover[p.id] = jokers; totalJokers += jokers; }
    }
    this.roundResult = { winnerId: winner.id, penalties };
    this.pendingCarryover = totalJokers > 0 ? carryover : null;
    this.phase = 'roundEnd';
  }

  nextRound(playerId) {
    if (playerId !== this.hostId) throw new Error('Only the host can start the next round');
    if (this.phase !== 'roundEnd') throw new Error('Round is not over');
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    this.roundNumber += 1;
    if (this.pendingCarryover) {
      this.phase = 'carryover';
    } else {
      this.#startCutting();
    }
  }

  get dealerId() { return this.players[this.dealerIndex]?.id ?? null; }

  adjustCarryover(playerId, assignment) {
    if (this.phase !== 'carryover') throw new Error('Not reviewing carryover');
    if (playerId !== this.dealerId) throw new Error('Only the dealer adjusts joker carryover');
    const total = Object.values(this.pendingCarryover).reduce((a, b) => a + b, 0);
    const entries = Object.entries(assignment || {});
    let newTotal = 0;
    for (const [pid, count] of entries) {
      this.player(pid);
      if (!Number.isInteger(count) || count < 0) throw new Error('Counts must be non-negative integers');
      newTotal += count;
    }
    if (newTotal !== total) throw new Error(`Carryover must assign exactly ${total} joker(s)`);
    this.pendingCarryover = Object.fromEntries(entries.filter(([, c]) => c > 0));
  }

  confirmCarryover(playerId) {
    if (this.phase !== 'carryover') throw new Error('Not reviewing carryover');
    if (playerId !== this.dealerId) throw new Error('Only the dealer confirms joker carryover');
    this.#startCutting();
  }

  endMatch(playerId) {
    if (playerId !== this.hostId) throw new Error('Only the host can end the match');
    if (this.phase === 'lobby' || this.phase === 'matchEnd') throw new Error('No match in progress');
    this.phase = 'matchEnd';
  }

  forceEndMatch() {
    // Used when host disconnects
    if (this.phase !== 'lobby' && this.phase !== 'matchEnd') {
      this.phase = 'matchEnd';
    }
  }

  removePlayer(playerId) {
    // Remove a player from the game (for admin panel)
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx === -1) return false;
    this.players.splice(idx, 1);
    return true;
  }

  getStateFor(playerId) {
    const you = this.players.find(p => p.id === playerId) || null;
    const currentId = this.currentIndex >= 0 ? this.players[this.currentIndex]?.id : null;
    const isDealerViewer = playerId === this.dealerId;
    const showCarry = this.pendingCarryover && (this.phase === 'roundEnd' || this.phase === 'carryover');
    return {
      phase: this.phase,
      config: { ...this.config },
      roundNumber: this.roundNumber,
      youId: playerId,
      hand: you ? you.hand.map(c => ({ ...c })) : [],
      players: this.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        handCount: p.hand.length,
        melded: p.melded,
        score: p.score,
        connected: p.connected,
        isDealer: i === this.dealerIndex,
        isCurrent: p.id === currentId && this.phase === 'playing',
        isHost: p.id === this.hostId,
        isCutter: this.phase === 'cutting' && p.id === this.cutterId,
        carryJokers: showCarry ? (this.pendingCarryover[p.id] || 0) : 0
      })),
      drawCount: this.drawPile.length,
      discardTop: this.discardPile.length ? { ...this.discardPile[this.discardPile.length - 1] } : null,
      discardCount: this.discardPile.length,
      closingCard: this.closingCard ? { ...this.closingCard } : null,
      melds: this.melds.map(m => ({
        id: m.id,
        ownerId: m.ownerId,
        ownerName: this.players.find(p => p.id === m.ownerId)?.name ?? '?',
        cards: m.cards.map(c => ({ ...c }))
      })),
      currentPlayerId: this.phase === 'playing' ? currentId : null,
      hasDrawn: this.hasDrawn,
      canMeldNow: you ? this.canMeldNow(you.id) : false,
      canDrawDiscard: you ? this.canMeldNow(you.id) && this.discardPile.length > 0 : false,
      meldTurnActive: !this.config.meldDelayEnabled ||
        Math.max(0, ...Object.values(this.laps || {})) >= this.config.meldDelayTurn,
      lap: you ? (this.laps[you.id] || 0) : 0,
      cutterId: this.phase === 'cutting' ? this.cutterId : null,
      deckSize: this.phase === 'cutting' ? this.pendingDeck.length : 0,
      roundResult: this.roundResult && (this.phase === 'roundEnd' || this.phase === 'matchEnd')
        ? {
            winnerId: this.roundResult.winnerId,
            winnerName: this.players.find(p => p.id === this.roundResult.winnerId)?.name ?? '?',
            penalties: Object.entries(this.roundResult.penalties).map(([pid, points]) => ({
              id: pid,
              name: this.players.find(p => p.id === pid)?.name ?? '?',
              points
            }))
          }
        : null,
      carryover: showCarry
        ? {
            total: Object.values(this.pendingCarryover).reduce((a, b) => a + b, 0),
            assignment: { ...this.pendingCarryover },
            editable: isDealerViewer && this.phase === 'carryover'
          }
        : null
    };
  }
}
