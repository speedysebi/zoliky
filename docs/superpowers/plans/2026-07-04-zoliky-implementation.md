# Žolíky LAN Multiplayer Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A LAN-playable web version of Žolíky (Czech/Slovak Rummy) for 2–6 human players: Node.js authoritative server + Socket.IO, React client, per-socket state filtering, multi-round match with running scoreboard.

**Architecture:** A single Node process holds all game state in a pure, unit-tested `server/game/` module (no networking). `server/socket/` wires Socket.IO events to that module and emits per-player-filtered state. A React SPA (built with Vite, served by the same Express server) renders server state and sends move *attempts*; the server is the single source of truth.

**Tech Stack:** Node.js (≥20, ESM), Express, Socket.IO 4, React 18, Vite, Vitest (+ jsdom & @testing-library/react for client smoke tests), socket.io-client (client + socket smoke tests). Plain JavaScript, no TypeScript.

## Global Constraints

- 2–6 human players; no bots; LAN only, no cloud dependency.
- Deck: 2 × 52 cards + 6 jokers = **110 cards**.
- Opening threshold config: **42 or 51** (default 51); first meld(s) must include ≥1 *pure* sequence (no joker).
- Meld-delay config: on/off + turn number (**default: turn 4**). Until a player's Nth lap has begun: no melding, no discard-pile pickup.
- Scoring: A/K/Q/J = 10, number cards = face value, Joker = 50. (Ace counts 10 always, including in A-2-3 sequences.)
- Closing card drawable **only** as part of an atomic go-out plan validated server-side.
- Jokers left in hands carry into that player's next deal; dealer reviews/adjusts between rounds.
- Match has no target score; host ends it manually ("End Match").
- Clients never receive other players' hand contents — server filters per socket.
- `npm run start` builds the client and starts the server, printing the LAN URL (port 3000, `PORT` env override).
- All moves validated server-side only.

## File Structure

```
package.json               — single package, scripts: start/build/test/dev
vite.config.js             — Vite (root: client/) + Vitest config
server/
  index.js                 — Express + Socket.IO bootstrap, serves client/dist, prints LAN URL
  game/
    cards.js               — deck creation, shuffle, cut, card points
    melds.js               — sequence/set validation + meld points (joker = represented card)
    game.js                — Game class: full match state machine + per-player state filtering
    cards.test.js
    melds.test.js
    game.test.js
  socket/
    handlers.js            — Socket.IO event wiring → Game, per-socket broadcast
    handlers.test.js       — smoke test with real socket.io + socket.io-client
client/
  index.html
  src/
    main.jsx
    App.jsx                — socket connection, join-by-name, phase routing
    socket.js              — socket.io-client singleton
    cardUtils.js           — card display helpers (label, color)
    components/
      Lobby.jsx            — name join + player list + HouseRulesPanel + Start
      HouseRulesPanel.jsx  — opening threshold, meld-delay toggle/turn (host only)
      CutScreen.jsx        — cutter picks cut depth; others wait
      Table.jsx            — circular table: seats, center (deck/closing/discard), actions
      Hand.jsx             — own hand with ordered multi-select
      MeldsStrip.jsx       — everyone's melds tagged by name, clickable for add-to-meld
      RoundEndSummary.jsx  — round winner + scoreboard, host: Next Round / End Match
      JokerCarryoverReview.jsx — dealer adjusts joker carryover counts
      MatchEndSummary.jsx  — final scoreboard
    App.test.jsx           — client smoke test (jsdom)
    styles.css
docs/superpowers/specs/2026-07-04-zoliky-design.md   (already exists)
```

**Card model (used everywhere):** `{ id: string, suit: 'S'|'H'|'D'|'C'|null, rank: 1..13|null, joker: boolean }` — rank 1=A, 11=J, 12=Q, 13=K. Ids: `"S7-0"`, `"S7-1"` (two copies), `"JOKER-0"`…`"JOKER-5"`.

**Sequences are ordered arrays.** The client sends meld cards in the order they should sit in the sequence; joker positions are therefore explicit. Ace may be low (A-2-3) or high (Q-K-A); no wrap-around.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `vite.config.js`, `.gitignore` (modify), `client/index.html`, `client/src/main.jsx`, `client/src/App.jsx` (placeholder), `client/src/styles.css` (empty)

**Interfaces:**
- Produces: `npm test` (vitest run), `npm run build` (vite build → `client/dist`), `npm run start` (build + node server — server comes in Task 7, script defined now).

- [ ] **Step 1: Write package.json, vite config, client entry stub**

`package.json`:
```json
{
  "name": "zoliky",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "npm run build && node server/index.js",
    "build": "vite build",
    "dev:client": "vite",
    "dev:server": "node server/index.js",
    "test": "vitest run"
  }
}
```

`vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: { proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } } },
  test: {
    root: '.',
    include: ['server/**/*.test.js', 'client/src/**/*.test.jsx'],
    environment: 'node'
  }
});
```

`client/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Žolíky</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`client/src/main.jsx`:
```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
```

`client/src/App.jsx` (placeholder, replaced in Task 8):
```jsx
export default function App() {
  return <h1>Žolíky</h1>;
}
```

Append to `.gitignore`: `node_modules/`, `client/dist/`.

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install express socket.io react react-dom
npm install -D vite @vitejs/plugin-react vitest socket.io-client jsdom @testing-library/react
```

- [ ] **Step 3: Verify build and test runner**

Run: `npm run build` → Expected: Vite build succeeds, `client/dist/index.html` exists.
Run: `npm test` → Expected: "No test files found" exit 0? Vitest exits 1 with no tests — use `vitest run --passWithNoTests` check manually once; do NOT add the flag to package.json (tests exist from Task 2 on).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.js .gitignore client/
git commit -m "feat: scaffold Vite+React client and test tooling"
```

---

### Task 2: Card primitives (`server/game/cards.js`)

**Files:**
- Create: `server/game/cards.js`
- Test: `server/game/cards.test.js`

**Interfaces:**
- Produces:
  - `createDeck() → Card[]` (110 cards, ids unique)
  - `shuffle(deck, rand = Math.random) → Card[]` (new array)
  - `cut(deck, index) → Card[]` (rotate: `[...deck.slice(index), ...deck.slice(0, index)]`)
  - `cardPoints(card) → number` (joker 50; A/J/Q/K 10; else rank)
  - `SUITS = ['S','H','D','C']`

- [ ] **Step 1: Write the failing tests**

`server/game/cards.test.js`:
```js
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
```

- [ ] **Step 2: Run tests, verify they fail** — `npx vitest run server/game/cards.test.js` → FAIL (module not found).

- [ ] **Step 3: Implement**

`server/game/cards.js`:
```js
export const SUITS = ['S', 'H', 'D', 'C'];

export function createDeck() {
  const deck = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ id: `${suit}${rank}-${copy}`, suit, rank, joker: false });
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    deck.push({ id: `JOKER-${i}`, suit: null, rank: null, joker: true });
  }
  return deck;
}

export function shuffle(deck, rand = Math.random) {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function cut(deck, index) {
  return [...deck.slice(index), ...deck.slice(0, index)];
}

export function cardPoints(card) {
  if (card.joker) return 50;
  if (card.rank === 1 || card.rank >= 10) return 10;
  return card.rank;
}
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run server/game/cards.test.js` → PASS.

- [ ] **Step 5: Commit** — `git add server/game/cards.js server/game/cards.test.js && git commit -m "feat: card deck primitives"`

---

### Task 3: Meld validation (`server/game/melds.js`)

**Files:**
- Create: `server/game/melds.js`
- Test: `server/game/melds.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `validateMeld(cards) → { valid: boolean, type: 'sequence'|'set'|null, points: number, pure: boolean }`
  - `cards` is an **ordered** array for sequences. `pure` = contains no joker.
  - Points: joker counts as the card it represents; position value 14 (ace-high) or 1 (ace-low) scores 10; values ≥10 score 10; else face value.

- [ ] **Step 1: Write the failing tests**

`server/game/melds.test.js`:
```js
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
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run server/game/melds.test.js` → FAIL.

- [ ] **Step 3: Implement**

`server/game/melds.js`:
```js
const INVALID = { valid: false, type: null, points: 0, pure: false };

function pointsForValue(v) {
  // v is a sequence position value 1..14 (1 = ace-low, 14 = ace-high) or a set rank 1..13
  if (v === 1 || v >= 10) return 10;
  return v;
}

function validateSequence(cards) {
  const nonJokers = cards.filter(c => !c.joker);
  if (nonJokers.length === 0) return INVALID;
  const suit = nonJokers[0].suit;
  if (!nonJokers.every(c => c.suit === suit)) return INVALID;
  for (let i = 1; i < cards.length; i++) {
    if (cards[i].joker && cards[i - 1].joker) return INVALID;
  }
  for (const aceValue of [1, 14]) {
    const val = c => (c.rank === 1 ? aceValue : c.rank);
    const anchorIdx = cards.findIndex(c => !c.joker);
    const base = val(cards[anchorIdx]) - anchorIdx;
    const maxValue = aceValue === 14 ? 14 : 13;
    if (base < 1 || base + cards.length - 1 > maxValue) continue;
    let ok = true;
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].joker && val(cards[i]) !== base + i) { ok = false; break; }
    }
    if (!ok) continue;
    let points = 0;
    for (let i = 0; i < cards.length; i++) points += pointsForValue(base + i);
    return { valid: true, type: 'sequence', points, pure: nonJokers.length === cards.length };
  }
  return INVALID;
}

function validateSet(cards) {
  if (cards.length > 4) return INVALID;
  const nonJokers = cards.filter(c => !c.joker);
  if (nonJokers.length === 0) return INVALID;
  const rank = nonJokers[0].rank;
  if (!nonJokers.every(c => c.rank === rank)) return INVALID;
  const suits = new Set(nonJokers.map(c => c.suit));
  if (suits.size !== nonJokers.length) return INVALID;
  return {
    valid: true,
    type: 'set',
    points: pointsForValue(rank) * cards.length,
    pure: nonJokers.length === cards.length
  };
}

export function validateMeld(cards) {
  if (!Array.isArray(cards) || cards.length < 3) return INVALID;
  const asSet = validateSet(cards);
  if (asSet.valid) return asSet;
  return validateSequence(cards);
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run server/game/melds.test.js` → PASS. Also run `npx vitest run` (all green).

- [ ] **Step 5: Commit** — `git commit -m "feat: meld validation with joker rules"` (after `git add server/game/melds.js server/game/melds.test.js`).

---

### Task 4: Game class — lobby, config, cut & deal

**Files:**
- Create: `server/game/game.js`
- Test: `server/game/game.test.js`

**Interfaces:**
- Consumes: `createDeck, shuffle, cut, cardPoints` from `./cards.js`; `validateMeld` from `./melds.js`.
- Produces (this task):
  - `new Game(config?)` — config `{ openingThreshold: 42|51 = 51, meldDelayEnabled = true, meldDelayTurn = 4 }`; `game.rng` injectable.
  - `game.join(name) → playerId` — in lobby: new seat (max 6, unique names); after start: reattach by name, else throws.
  - `game.setConfig(playerId, partial)` — host only, lobby only. Validates `openingThreshold ∈ {42, 51}`, `meldDelayTurn` integer ≥ 1.
  - `game.startMatch(playerId)` — host only, ≥2 players → phase `'cutting'`, `dealerIndex = 0`, shuffled `pendingDeck`.
  - `game.cutterId` getter — player left of dealer (`players[(dealerIndex+1) % n].id`).
  - `game.cutDeck(playerId, index)` — cutter only, `1 ≤ index ≤ 109`; cuts then deals → phase `'playing'`.
  - Errors: every invalid move `throw new Error('<reason>')`, state unchanged.
  - Internal state after deal (later tasks rely on these exact names): `players[i] = { id, name, connected, hand, melded, score }`, `drawPile`, `discardPile` (empty at deal), `closingCard`, `melds` (empty array), `currentIndex` (seat after dealer), `hasDrawn = true` (first player holds 15 = dealt-in draw), `laps = { [playerId]: number }` with first player at 1 and others 0, `roundNumber` (1-based), `phase`, `hostId`, `dealerIndex`, `pendingCarryover` (`{ [playerId]: count }` or null).

- [ ] **Step 1: Write the failing tests**

`server/game/game.test.js` (this task's describe blocks; later tasks append to this file):
```js
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
    const { game, ids } = startPlaying(n);
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
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run server/game/game.test.js` → FAIL.

- [ ] **Step 3: Implement the Game class (lobby + cut/deal portion)**

`server/game/game.js`:
```js
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
```

Note: carryover jokers are pulled per-player using `carry[p.id]`; the deal keeps hand sizes at 15/14. `pendingCarryover` is populated in Task 6.

- [ ] **Step 4: Run, verify pass** — `npx vitest run server/game/game.test.js` → PASS.

- [ ] **Step 5: Commit** — `git add server/game/game.js server/game/game.test.js && git commit -m "feat: game lobby, cut and deal"`

---

### Task 5: Game class — turn actions (draw, meld, add, discard)

**Files:**
- Modify: `server/game/game.js`
- Test: append to `server/game/game.test.js`

**Interfaces:**
- Consumes: state from Task 4; `validateMeld`.
- Produces:
  - `game.canMeldNow(playerId) → boolean` — `!meldDelayEnabled || laps[playerId] >= meldDelayTurn`.
  - `game.draw(playerId, source, plan?)` — source `'deck' | 'discard' | 'closing'`.
    - `'deck'`: recycles discard pile (all but top card, reshuffled) if empty.
    - `'discard'`: requires `canMeldNow` and non-empty pile.
    - `'closing'`: requires `plan = { melds: cardIds[][], additions: [{meldId, cardIds, where}], discardId }`; simulated atomically; only commits if the player's hand empties (go out). Ends the round via `#endRound`.
  - `game.meld(playerId, meldsCardIds: string[][])` — after draw, gated by `canMeldNow`; if player not yet open: total points ≥ `openingThreshold` and ≥1 pure sequence among the laid melds; may not empty the hand (a discard must remain). Appends `{ id, ownerId, cards }` to `game.melds`.
  - `game.addToMeld(playerId, meldId, cardIds, where = 'end')` — requires the player is open; resulting arrangement must pass `validateMeld`; may not empty the hand.
  - `game.discard(playerId, cardId)` — after draw; advances turn (increments next player's lap, resets `hasDrawn`); if the hand empties, calls `#endRound(player)` (Task 6 — for this task, a stub that sets `phase='roundEnd'` and `roundResult={winnerId}` is enough; Task 6 completes it).
- Test setup note: tests rig hands by assigning `game.players[i].hand = [...]` directly and use `game.laps[id] = n` to fast-forward the meld-delay; that is the supported testing approach for the pure module.

- [ ] **Step 1: Write the failing tests** (append to `server/game/game.test.js`)

```js
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
    const p1 = cur(game); // first player again, lap 2 → allowed
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
    const { game, ids } = startPlaying(2, config);
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
    expect(() => game.meld(p.id, [[`H5-0`, `H6-0`, `H7-0`]])).toThrow();
  });
  it('allows melding from turn 1 when meld-delay is disabled', () => {
    const { game, p } = (() => {
      const { game } = startPlaying(2, { meldDelayEnabled: false });
      const p = cur(game);
      p.hand = [
        card('H', 5), card('H', 6), card('H', 7), card('H', 8), card('H', 9), card('H', 10),
        ...p.hand.slice(6)
      ];
      return { game, p };
    })();
    game.laps[p.id] = 1;
    game.meld(p.id, [['H5-0', 'H6-0', 'H7-0', 'H8-0', 'H9-0', 'H10-0']]);
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
      card('S', 9), card('D', 9), card('C', 9)       // 27 set → total 57 ≥ 51
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
    // Q-K-A = 30 < 42 → reject; hand unchanged
    expect(() => game.meld(p.id, [['H12-0', 'H13-0', 'H1-0']])).toThrow();
  });
  it('rejects opening without a pure sequence even above threshold', () => {
    const { game, p } = riggedGame([
      card('H', 10), jok(0), card('H', 12),          // sequence with joker (30)
      card('S', 13), card('D', 13), card('C', 13)    // pure SET (30) — not a sequence
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
    const { game, ids } = startPlaying(3);
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
    })).toThrow(); // S9-y would remain → not a go-out
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
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run server/game/game.test.js` → new describes FAIL.

- [ ] **Step 3: Implement turn actions** (add to the `Game` class in `server/game/game.js`)

```js
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
    p.hand = p.hand.filter(c => !cardIds.includes(c.id));
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
    // completed in Task 6
    this.roundResult = { winnerId: winner.id };
    this.phase = 'roundEnd';
  }
```

Note on `#drawClosing`: `structuredClone` deep-copies the hand/melds; on success the cloned snapshot is discarded and original card objects flow into `#doMelds`/`discard` untouched. On failure everything (including `hasDrawn`) is restored.

- [ ] **Step 4: Run, verify pass** — `npx vitest run server/game/game.test.js` → PASS (all describes).

- [ ] **Step 5: Commit** — `git add -A server/game && git commit -m "feat: turn actions - draw, meld, add, discard, closing card"`

---

### Task 6: Game class — round end, scoring, carryover, match end, state filtering

**Files:**
- Modify: `server/game/game.js`
- Test: append to `server/game/game.test.js`

**Interfaces:**
- Consumes: everything from Tasks 4–5.
- Produces:
  - `#endRound(winner)` (full version): scores each other player's hand via `cardPoints` into `p.score`; `roundResult = { winnerId, penalties: { [playerId]: points } }`; counts jokers left in each hand into `pendingCarryover = { [playerId]: count }` (or `null` if zero total); phase `'roundEnd'`.
  - `game.nextRound(playerId)` — host only, from `'roundEnd'`: rotates `dealerIndex`, increments `roundNumber`; → phase `'carryover'` if `pendingCarryover` else `#startCutting()`.
  - `game.adjustCarryover(playerId, assignment)` — dealer only, phase `'carryover'`; `assignment = { [playerId]: count }`; total must equal original total, all keys valid player ids, counts non-negative integers.
  - `game.confirmCarryover(playerId)` — dealer only → `#startCutting()`.
  - `game.endMatch(playerId)` — host only, any phase after lobby → phase `'matchEnd'`.
  - `game.getStateFor(playerId) → object`:
    ```js
    {
      phase, config, roundNumber,
      youId: playerId,
      hand: [...own cards] | [],
      players: [{ id, name, handCount, melded, score, connected,
                  isDealer, isCurrent, isHost, isCutter, carryJokers }],
      drawCount, discardTop: card|null, discardCount,
      closingCard: card|null,
      melds: [{ id, ownerId, ownerName, cards }],
      currentPlayerId, hasDrawn, canMeldNow: bool (for `you`), canDrawDiscard: bool,
      meldTurnActive: bool, lap: laps[you],
      cutterId (cutting phase), deckSize (cutting phase, for the cut slider),
      roundResult: { winnerId, winnerName, penalties: [{id, name, points, jokers}] } | null,
      carryover: { total, assignment, editable: bool } | null  // full detail only for dealer & roundEnd/carryover phases
    }
    ```
    **Never** includes other players' hand contents anywhere.

- [ ] **Step 1: Write the failing tests** (append to `server/game/game.test.js`)

```js
function playDiscard(game) { // helper: current player discards first card
  const p = cur(game);
  if (!game.hasDrawn) game.draw(p.id, 'deck');
  game.discard(p.id, p.hand[0].id);
}

function winRound(game) { // force current player to go out legitimately
  const p = cur(game);
  game.laps[p.id] = 99;
  p.melded = true;
  if (!game.hasDrawn) game.draw(p.id, 'deck');
  p.hand = [card('H', 5, 'w'), card('H', 6, 'w'), card('H', 7, 'w'), card('S', 2, 'w')];
  game.meld(p.id, [['H5-w', 'H6-w', 'H7-w']]);
  game.discard(p.id, 'S2-w');
  return p;
}

describe('round end and scoring', () => {
  it('scores losers hands as penalties; winner gains nothing; jokers=50', () => {
    const { game, ids } = startPlaying(3);
    const winner = cur(game);
    const losers = game.players.filter(p => p.id !== winner.id);
    losers[0].hand = [card('S', 13, 'l1'), card('D', 5, 'l2')]; // 10 + 5 = 15
    losers[1].hand = [jok(5), card('H', 2, 'l3')];              // 50 + 2 = 52
    winRound(game);
    expect(game.phase).toBe('roundEnd');
    expect(game.roundResult.winnerId).toBe(winner.id);
    expect(game.roundResult.penalties[losers[0].id]).toBe(15);
    expect(game.roundResult.penalties[losers[1].id]).toBe(52);
    expect(losers[0].score).toBe(15);
    expect(losers[1].score).toBe(52);
    expect(winner.score).toBe(0);
    expect(game.pendingCarryover[losers[1].id]).toBe(1);
  });
  it('nextRound rotates the dealer and goes to cutting when no jokers remain', () => {
    const { game, ids } = startPlaying(3);
    for (const p of game.players) if (p.id !== cur(game).id) p.hand = [card('S', 5, `x${p.id}`)];
    winRound(game);
    expect(game.pendingCarryover).toBeNull();
    const prevDealer = game.dealerIndex;
    game.nextRound(game.hostId);
    expect(game.dealerIndex).toBe((prevDealer + 1) % 3);
    expect(game.roundNumber).toBe(2);
    expect(game.phase).toBe('cutting');
  });
  it('goes to carryover review when jokers remain; dealer can adjust and confirm', () => {
    const { game, ids } = startPlaying(3);
    const others = game.players.filter(p => p.id !== cur(game).id);
    others[0].hand = [jok(4), jok(5)];
    others[1].hand = [card('S', 5, 'q')];
    winRound(game);
    game.nextRound(game.hostId);
    expect(game.phase).toBe('carryover');
    const dealer = game.players[game.dealerIndex];
    // reassign one joker to the other loser
    expect(() => game.adjustCarryover(dealer.id, { [others[0].id]: 1 })).toThrow(); // total mismatch
    game.adjustCarryover(dealer.id, { [others[0].id]: 1, [others[1].id]: 1 });
    game.confirmCarryover(dealer.id);
    expect(game.phase).toBe('cutting');
    game.cutDeck(game.cutterId, 25);
    // both players got exactly their assigned jokers, hand sizes normal
    const j0 = game.players.find(p => p.id === others[0].id);
    const j1 = game.players.find(p => p.id === others[1].id);
    expect(j0.hand.filter(c => c.joker).length).toBeGreaterThanOrEqual(1);
    expect(j1.hand.filter(c => c.joker).length).toBeGreaterThanOrEqual(1);
    const first = game.players[(game.dealerIndex + 1) % 3];
    for (const p of game.players) expect(p.hand).toHaveLength(p === first ? 15 : 14);
  });
  it('only the host can end the match; final phase is matchEnd', () => {
    const { game, ids } = startPlaying(2);
    expect(() => game.endMatch(ids[1])).toThrow();
    game.endMatch(game.hostId);
    expect(game.phase).toBe('matchEnd');
  });
});

describe('getStateFor', () => {
  it('shows own hand but never other players cards', () => {
    const { game, ids } = startPlaying(3);
    const state = game.getStateFor(ids[1]);
    expect(state.hand.every(c => c.id)).toBe(true);
    for (const p of state.players) {
      expect(p.hand).toBeUndefined();
      expect(typeof p.handCount).toBe('number');
    }
    expect(JSON.stringify(state.players)).not.toContain('"suit"');
  });
  it('exposes shared zones: discard top, closing card, melds, draw count', () => {
    const { game, ids } = startPlaying(2);
    playDiscard(game);
    const state = game.getStateFor(ids[0]);
    expect(state.discardTop).toBeTruthy();
    expect(state.closingCard).toBeTruthy();
    expect(state.drawCount).toBeGreaterThan(0);
    expect(Array.isArray(state.melds)).toBe(true);
    expect(state.currentPlayerId).toBe(cur(game).id);
  });
  it('flags turn/permission state for the viewer', () => {
    const { game, ids } = startPlaying(2, { meldDelayTurn: 4 });
    const first = cur(game);
    const s = game.getStateFor(first.id);
    expect(s.hasDrawn).toBe(true);
    expect(s.canMeldNow).toBe(false);
    expect(s.lap).toBe(1);
  });
});

describe('reconnection', () => {
  it('reattaching by name preserves seat, hand, and score', () => {
    const { game, ids } = startPlaying(2);
    const p1 = game.players.find(p => p.id === ids[1]);
    const handBefore = p1.hand.map(c => c.id);
    game.markConnected(ids[1], false);
    const rejoined = game.join('P1');
    expect(rejoined).toBe(ids[1]);
    expect(game.players.find(p => p.id === ids[1]).hand.map(c => c.id)).toEqual(handBefore);
    expect(game.players.find(p => p.id === ids[1]).connected).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement** — replace the Task 5 `#endRound` stub and add the new methods to `Game`:

```js
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
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run` → all server tests PASS.

- [ ] **Step 5: Commit** — `git add -A server/game && git commit -m "feat: scoring, joker carryover, match end, per-player state"`

---

### Task 7: Server bootstrap + Socket.IO handlers

**Files:**
- Create: `server/index.js`, `server/socket/handlers.js`
- Test: `server/socket/handlers.test.js` (smoke test with real sockets)

**Interfaces:**
- Consumes: `Game` from `../game/game.js`.
- Produces (Socket.IO protocol — the client in Tasks 8–10 uses these exact events):
  - Client → server (all take an object payload):
    - `join { name }` → ack `{ ok: true, playerId }` or `{ ok: false, error }`
    - `configure { openingThreshold?, meldDelayEnabled?, meldDelayTurn? }`
    - `startMatch {}`, `cut { index }`, `draw { source, plan? }`,
      `meld { melds }`, `addToMeld { meldId, cardIds, where }`,
      `discard { cardId }`, `nextRound {}`, `adjustCarryover { assignment }`,
      `confirmCarryover {}`, `endMatch {}`
  - Server → client:
    - `state` — the personalized `game.getStateFor(playerId)` payload, re-broadcast to every connected socket after every successful (and joining) action.
    - `gameError { message }` — sent only to the offending socket when a move throws.
  - `attachSocketHandlers(io, game)` exported from `handlers.js`.
  - `server/index.js` starts Express on `PORT` (default 3000), serves `client/dist` statically, and prints all non-internal IPv4 LAN URLs.

- [ ] **Step 1: Write the failing smoke test**

`server/socket/handlers.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as clientIo } from 'socket.io-client';
import { Game } from '../game/game.js';
import { attachSocketHandlers } from './handlers.js';

let httpServer, io, port, sockets = [];

function connect() {
  const s = clientIo(`http://localhost:${port}`, { transports: ['websocket'] });
  sockets.push(s);
  return s;
}
function emitAck(socket, event, payload) {
  return new Promise(resolve => socket.emit(event, payload, resolve));
}
function nextState(socket) {
  return new Promise(resolve => socket.once('state', resolve));
}

beforeAll(async () => {
  httpServer = createServer();
  io = new Server(httpServer);
  attachSocketHandlers(io, new Game());
  await new Promise(resolve => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});

afterAll(async () => {
  for (const s of sockets) s.disconnect();
  io.close();
});

describe('socket wiring', () => {
  it('join → personalized state; opponent hands are hidden; moves flow end to end', async () => {
    const a = connect();
    const b = connect();
    const joinA = await emitAck(a, 'join', { name: 'Ana' });
    expect(joinA.ok).toBe(true);
    const [joinB] = await Promise.all([emitAck(b, 'join', { name: 'Ben' })]);
    expect(joinB.ok).toBe(true);

    // host configures + starts
    const cutState = nextState(b);
    await emitAck(a, 'configure', { openingThreshold: 42 });
    a.emit('startMatch', {});
    const sb = await cutState;
    expect(['cutting', 'lobby']).toContain(sb.phase); // may still see lobby broadcast first
    const afterStart = sb.phase === 'cutting' ? sb : await nextState(b);
    expect(afterStart.phase).toBe('cutting');
    expect(afterStart.config.openingThreshold).toBe(42);

    // Ben is cutter (left of dealer Ana)
    const dealt = nextState(b);
    b.emit('cut', { index: 30 });
    const sb2 = await dealt;
    expect(sb2.phase).toBe('playing');
    expect(sb2.hand.length === 15 || sb2.hand.length === 14).toBe(true);
    // no other player's cards leak
    for (const p of sb2.players) expect(p.hand).toBeUndefined();

    // an illegal move produces gameError for that socket only
    const errPromise = new Promise(resolve => a.once('gameError', resolve));
    // whoever is NOT current tries to discard
    const notCurrent = sb2.currentPlayerId === joinA.playerId ? b : a;
    const errTarget = notCurrent === a ? errPromise : new Promise(r => b.once('gameError', r));
    notCurrent.emit('discard', { cardId: 'S1-0' });
    const err = await errTarget;
    expect(err.message).toBeTruthy();
  }, 15000);

  it('reconnect: same name reattaches with hand intact', async () => {
    const c = connect();
    const rejoin = await emitAck(c, 'join', { name: 'Ben' });
    expect(rejoin.ok).toBe(true);
    const s = await new Promise(resolve => c.once('state', resolve));
    expect(s.hand.length).toBeGreaterThan(0);
  }, 15000);
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run server/socket/handlers.test.js` → FAIL.

- [ ] **Step 3: Implement handlers and server**

`server/socket/handlers.js`:
```js
export function attachSocketHandlers(io, game) {
  const socketToPlayer = new Map();

  function broadcast() {
    for (const [socketId, playerId] of socketToPlayer) {
      io.to(socketId).emit('state', game.getStateFor(playerId));
    }
  }

  io.on('connection', socket => {
    socket.on('join', (payload, ack) => {
      try {
        const playerId = game.join(payload?.name);
        socketToPlayer.set(socket.id, playerId);
        game.markConnected(playerId, true);
        if (typeof ack === 'function') ack({ ok: true, playerId });
        broadcast();
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    const moves = {
      configure: (pid, p) => game.setConfig(pid, p ?? {}),
      startMatch: pid => game.startMatch(pid),
      cut: (pid, p) => game.cutDeck(pid, p?.index),
      draw: (pid, p) => game.draw(pid, p?.source, p?.plan),
      meld: (pid, p) => game.meld(pid, p?.melds),
      addToMeld: (pid, p) => game.addToMeld(pid, p?.meldId, p?.cardIds, p?.where),
      discard: (pid, p) => game.discard(pid, p?.cardId),
      nextRound: pid => game.nextRound(pid),
      adjustCarryover: (pid, p) => game.adjustCarryover(pid, p?.assignment),
      confirmCarryover: pid => game.confirmCarryover(pid),
      endMatch: pid => game.endMatch(pid)
    };

    for (const [event, fn] of Object.entries(moves)) {
      socket.on(event, payload => {
        const playerId = socketToPlayer.get(socket.id);
        if (!playerId) return socket.emit('gameError', { message: 'Join first' });
        try {
          fn(playerId, payload);
          broadcast();
        } catch (err) {
          socket.emit('gameError', { message: err.message });
        }
      });
    }

    socket.on('disconnect', () => {
      const playerId = socketToPlayer.get(socket.id);
      socketToPlayer.delete(socket.id);
      if (playerId && ![...socketToPlayer.values()].includes(playerId)) {
        game.markConnected(playerId, false);
        broadcast();
      }
    });
  });
}
```

`server/index.js`:
```js
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { Game } from './game/game.js';
import { attachSocketHandlers } from './socket/handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.static(path.join(__dirname, '../client/dist')));

const httpServer = createServer(app);
const io = new Server(httpServer);
attachSocketHandlers(io, new Game());

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('\nŽolíky server running. Players open one of these URLs:\n');
  console.log(`  http://localhost:${PORT}  (this device)`);
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        console.log(`  http://${addr.address}:${PORT}  (LAN)`);
      }
    }
  }
  console.log('');
});
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run server/socket/handlers.test.js` → PASS. Then `npx vitest run` → all PASS.

- [ ] **Step 5: Commit** — `git add server/index.js server/socket && git commit -m "feat: socket.io server with per-player state broadcast"`

---

### Task 8: Client foundation — socket, App phase routing, Lobby + HouseRulesPanel

**Files:**
- Create: `client/src/socket.js`, `client/src/cardUtils.js`, `client/src/components/Lobby.jsx`, `client/src/components/HouseRulesPanel.jsx`
- Modify: `client/src/App.jsx`, `client/src/styles.css`
- Test: `client/src/App.test.jsx`

**Interfaces:**
- Consumes: socket protocol from Task 7.
- Produces:
  - `socket.js` exports a lazily-connected singleton `socket` (`io({ autoConnect: false })` — same-origin).
  - `cardUtils.js` exports `cardLabel(card) → '9♥' | '★'` and `cardColor(card) → 'red'|'black'|'joker'`.
  - `App.jsx` holds `{ state, playerId, error }`; renders by `state.phase`: `lobby → Lobby`, `cutting → CutScreen`, `playing → Table`, `roundEnd → RoundEndSummary`, `carryover → JokerCarryoverReview`, `matchEnd → MatchEndSummary`. Placeholder `<div>` for components arriving in Tasks 9–10. Persists name in `localStorage('zoliky-name')` and auto-rejoins on reconnect. Shows `gameError` messages in a dismissable toast bar.
  - `send(event, payload)` helper passed down via props: `send('startMatch')`, etc.

- [ ] **Step 1: Write the failing smoke test**

`client/src/App.test.jsx`:
```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./socket.js', () => {
  const handlers = {};
  return {
    socket: {
      on: (ev, fn) => { handlers[ev] = fn; },
      off: () => {},
      emit: vi.fn(),
      connect: vi.fn(),
      connected: false
    },
    __handlers: handlers
  };
});

import App from './App.jsx';

describe('App', () => {
  it('renders the join screen before any state arrives', () => {
    render(<App />);
    expect(screen.getByText(/Žolíky/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/your name/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run client/src/App.test.jsx` → FAIL.

- [ ] **Step 3: Implement**

`client/src/socket.js`:
```js
import { io } from 'socket.io-client';
export const socket = io({ autoConnect: false, transports: ['websocket', 'polling'] });
```

`client/src/cardUtils.js`:
```js
const SUIT_SYMBOLS = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export function cardLabel(card) {
  if (!card) return '';
  if (card.joker) return '★';
  return `${RANK_LABELS[card.rank] || card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function cardColor(card) {
  if (!card) return 'black';
  if (card.joker) return 'joker';
  return card.suit === 'H' || card.suit === 'D' ? 'red' : 'black';
}
```

`client/src/App.jsx`:
```jsx
import { useEffect, useState, useCallback } from 'react';
import { socket } from './socket.js';
import Lobby from './components/Lobby.jsx';

export default function App() {
  const [state, setState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem('zoliky-name') || '');

  const send = useCallback((event, payload = {}) => {
    socket.emit(event, payload);
  }, []);

  const join = useCallback(joinName => {
    const trimmed = joinName.trim();
    if (!trimmed) return;
    localStorage.setItem('zoliky-name', trimmed);
    setName(trimmed);
    setJoining(true);
    if (!socket.connected) socket.connect();
    socket.emit('join', { name: trimmed }, res => {
      setJoining(false);
      if (res.ok) { setPlayerId(res.playerId); setError(null); }
      else setError(res.error);
    });
  }, []);

  useEffect(() => {
    const onState = s => setState(s);
    const onError = e => setError(e.message);
    const onConnect = () => {
      const saved = localStorage.getItem('zoliky-name');
      if (saved && playerId) {
        socket.emit('join', { name: saved }, res => {
          if (res.ok) setPlayerId(res.playerId);
        });
      }
    };
    socket.on('state', onState);
    socket.on('gameError', onError);
    socket.on('connect', onConnect);
    return () => {
      socket.off('state', onState);
      socket.off('gameError', onError);
      socket.off('connect', onConnect);
    };
  }, [playerId]);

  let screen;
  if (!playerId || !state) {
    screen = <JoinScreen name={name} joining={joining} onJoin={join} />;
  } else if (state.phase === 'lobby') {
    screen = <Lobby state={state} send={send} />;
  } else if (state.phase === 'cutting') {
    screen = <div>Cut screen (Task 9)</div>;
  } else if (state.phase === 'playing') {
    screen = <div>Table (Task 9)</div>;
  } else if (state.phase === 'roundEnd') {
    screen = <div>Round end (Task 10)</div>;
  } else if (state.phase === 'carryover') {
    screen = <div>Carryover (Task 10)</div>;
  } else if (state.phase === 'matchEnd') {
    screen = <div>Match end (Task 10)</div>;
  }

  return (
    <div className="app">
      {error && (
        <div className="toast" onClick={() => setError(null)}>
          {error} <span className="dismiss">✕</span>
        </div>
      )}
      {screen}
    </div>
  );
}

function JoinScreen({ name, joining, onJoin }) {
  const [value, setValue] = useState(name);
  return (
    <div className="join-screen">
      <h1>Žolíky</h1>
      <form onSubmit={e => { e.preventDefault(); onJoin(value); }}>
        <input
          placeholder="Your name"
          value={value}
          onChange={e => setValue(e.target.value)}
          maxLength={20}
          autoFocus
        />
        <button type="submit" disabled={joining || !value.trim()}>
          {joining ? 'Joining…' : 'Join table'}
        </button>
      </form>
    </div>
  );
}
```

`client/src/components/HouseRulesPanel.jsx`:
```jsx
export default function HouseRulesPanel({ config, isHost, send }) {
  const set = partial => send('configure', partial);
  return (
    <div className="house-rules">
      <h3>House rules</h3>
      <div className="rule-row">
        <span>Opening threshold</span>
        <div className="segmented">
          {[42, 51].map(v => (
            <button
              key={v}
              className={config.openingThreshold === v ? 'active' : ''}
              disabled={!isHost}
              onClick={() => set({ openingThreshold: v })}
            >{v}</button>
          ))}
        </div>
      </div>
      <div className="rule-row">
        <span>Meld delay</span>
        <div className="segmented">
          <button
            className={config.meldDelayEnabled ? 'active' : ''}
            disabled={!isHost}
            onClick={() => set({ meldDelayEnabled: true })}
          >On</button>
          <button
            className={!config.meldDelayEnabled ? 'active' : ''}
            disabled={!isHost}
            onClick={() => set({ meldDelayEnabled: false })}
          >Off</button>
        </div>
      </div>
      {config.meldDelayEnabled && (
        <div className="rule-row">
          <span>Melds allowed from turn</span>
          <input
            type="number" min="1" max="10"
            value={config.meldDelayTurn}
            disabled={!isHost}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              if (Number.isInteger(v) && v >= 1) set({ meldDelayTurn: v });
            }}
          />
        </div>
      )}
      {!isHost && <p className="hint">Only the host can change house rules.</p>}
    </div>
  );
}
```

`client/src/components/Lobby.jsx`:
```jsx
import HouseRulesPanel from './HouseRulesPanel.jsx';

export default function Lobby({ state, send }) {
  const you = state.players.find(p => p.id === state.youId);
  const isHost = you?.isHost;
  return (
    <div className="lobby">
      <h1>Žolíky — Lobby</h1>
      <ul className="player-list">
        {state.players.map(p => (
          <li key={p.id} className={p.connected ? '' : 'disconnected'}>
            {p.name}
            {p.isHost && <span className="tag">host</span>}
            {p.id === state.youId && <span className="tag you">you</span>}
            {!p.connected && <span className="tag">offline</span>}
          </li>
        ))}
      </ul>
      <HouseRulesPanel config={state.config} isHost={isHost} send={send} />
      {isHost ? (
        <button
          className="primary"
          disabled={state.players.length < 2}
          onClick={() => send('startMatch')}
        >
          Start game ({state.players.length}/6 players)
        </button>
      ) : (
        <p className="hint">Waiting for the host to start the game…</p>
      )}
    </div>
  );
}
```

`client/src/styles.css` — base app styles (table styles arrive in Task 9):
```css
* { box-sizing: border-box; margin: 0; }
body { font-family: system-ui, sans-serif; background: #10251a; color: #eee; }
.app { max-width: 560px; margin: 0 auto; padding: 12px; min-height: 100vh; }
h1 { text-align: center; margin: 16px 0; }
button { cursor: pointer; border: none; border-radius: 8px; padding: 8px 14px;
  background: #35543f; color: #fff; font-size: 15px; }
button:disabled { opacity: 0.45; cursor: default; }
button.primary { background: #e0a231; color: #201500; font-weight: 700; width: 100%;
  padding: 12px; margin-top: 16px; }
input { border-radius: 8px; border: 1px solid #476b52; background: #0c1c13;
  color: #fff; padding: 10px; font-size: 16px; }
.join-screen { display: flex; flex-direction: column; align-items: center; padding-top: 15vh; }
.join-screen form { display: flex; flex-direction: column; gap: 10px; width: 260px; }
.toast { position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
  background: #a33; color: #fff; padding: 10px 16px; border-radius: 8px; z-index: 10;
  cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
.player-list { list-style: none; padding: 0; margin: 16px 0; }
.player-list li { padding: 10px; background: rgba(255,255,255,0.07);
  border-radius: 8px; margin-bottom: 6px; }
.player-list li.disconnected { opacity: 0.5; }
.tag { font-size: 11px; background: #35543f; border-radius: 8px; padding: 2px 8px; margin-left: 8px; }
.tag.you { background: #e0a231; color: #201500; }
.house-rules { background: rgba(255,255,255,0.07); border-radius: 10px; padding: 14px; margin: 14px 0; }
.rule-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
.rule-row input[type="number"] { width: 64px; }
.segmented button { border-radius: 0; }
.segmented button:first-child { border-radius: 8px 0 0 8px; }
.segmented button:last-child { border-radius: 0 8px 8px 0; }
.segmented button.active { background: #e0a231; color: #201500; font-weight: 700; }
.hint { color: #9db8a5; font-size: 13px; margin-top: 10px; text-align: center; }
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run client/src/App.test.jsx` → PASS. `npm run build` → succeeds.

- [ ] **Step 5: Commit** — `git add client vite.config.js && git commit -m "feat: client join flow, lobby and house rules"`

---

### Task 9: Client Table — circular layout, hand interaction, all moves

**Files:**
- Create: `client/src/components/Table.jsx`, `client/src/components/Hand.jsx`, `client/src/components/MeldsStrip.jsx`, `client/src/components/CutScreen.jsx`
- Modify: `client/src/App.jsx` (wire real components), `client/src/styles.css` (append table styles)

**Interfaces:**
- Consumes: `state` shape from Task 6, `send` from Task 8, `cardLabel/cardColor`.
- Produces the validated brainstorm layout: green felt square; opponents around top/left/right edges as card-backs + name·count; center = draw pile with **closing card peeking beneath** + discard top; melds strip below the table tagged by owner name; own hand at the bottom.
- Interaction model (all attempts — server validates):
  - **Draw:** buttons/clicks on draw pile (`draw {source:'deck'}`), discard pile (`draw {source:'discard'}`), closing card (enters *go-out mode*).
  - **Hand selection:** clicking own cards toggles selection; selection **order is preserved** (order = sequence order, jokers explicit).
  - **Lay meld:** "Stage meld" moves current selection into a local staging area (list of melds); "Lay staged melds" sends `meld { melds: [[ids]] }` (single message so multi-meld openings satisfy the threshold). "Clear" unstages.
  - **Add to meld:** with cards selected, each meld in the strip shows ⊕-start/⊕-end buttons → `addToMeld { meldId, cardIds, where }`.
  - **Discard:** with exactly 1 card selected, "Discard" sends `discard { cardId }`.
  - **Go-out mode (closing card):** banner appears; player stages melds normally, selects final discard, then "Confirm go out" sends `draw { source:'closing', plan: { melds, additions, discardId } }` (additions staged the same way, buffered locally in go-out mode instead of sent). "Cancel" exits the mode and unstages.
- Status bar: whose turn, your lap number, meld-lock notice ("Melds unlock on turn 4"), draw/meld/discard prompts.
- `CutScreen`: cutter sees a range slider `1..deckSize-1` + "Cut here" → `cut { index }`; others see "Waiting for <name> to cut the deck…".

- [ ] **Step 1: Implement Hand.jsx**

```jsx
import { cardLabel, cardColor } from '../cardUtils.js';

export default function Hand({ cards, selectedIds, onToggle }) {
  return (
    <div className="your-hand">
      {cards.map(card => {
        const idx = selectedIds.indexOf(card.id);
        return (
          <button
            key={card.id}
            className={`card ${cardColor(card)} ${idx >= 0 ? 'selected' : ''}`}
            onClick={() => onToggle(card.id)}
          >
            {cardLabel(card)}
            {idx >= 0 && <span className="sel-order">{idx + 1}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Implement MeldsStrip.jsx**

```jsx
import { cardLabel, cardColor } from '../cardUtils.js';

export default function MeldsStrip({ melds, canAdd, onAdd }) {
  if (melds.length === 0) {
    return <div className="melds-strip empty">No melds on the table yet</div>;
  }
  return (
    <div className="melds-strip">
      {melds.map(meld => (
        <div className="meld-group" key={meld.id}>
          <div className="who">{meld.ownerName}</div>
          <div className="meld-cards">
            {canAdd && <button className="add-btn" onClick={() => onAdd(meld.id, 'start')}>+</button>}
            {meld.cards.map(c => (
              <div key={c.id} className={`mc ${cardColor(c)}`}>{cardLabel(c)}</div>
            ))}
            {canAdd && <button className="add-btn" onClick={() => onAdd(meld.id, 'end')}>+</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implement CutScreen.jsx**

```jsx
import { useState } from 'react';

export default function CutScreen({ state, send }) {
  const cutter = state.players.find(p => p.isCutter);
  const isYou = cutter?.id === state.youId;
  const max = Math.max(2, state.deckSize - 1);
  const [index, setIndex] = useState(Math.floor(max / 2));
  return (
    <div className="cut-screen">
      <h1>Round {state.roundNumber}</h1>
      {isYou ? (
        <>
          <p>You cut the deck. Pick a depth:</p>
          <input type="range" min="1" max={max} value={index}
            onChange={e => setIndex(Number(e.target.value))} />
          <p className="hint">{index} cards from the top</p>
          <button className="primary" onClick={() => send('cut', { index })}>Cut here</button>
        </>
      ) : (
        <p className="hint">Waiting for {cutter?.name} to cut the deck…</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement Table.jsx**

```jsx
import { useState, useMemo } from 'react';
import Hand from './Hand.jsx';
import MeldsStrip from './MeldsStrip.jsx';
import { cardLabel, cardColor } from '../cardUtils.js';

export default function Table({ state, send }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [staged, setStaged] = useState([]); // [{ids, cards}]
  const [goOut, setGoOut] = useState(false);
  const [goOutAdditions, setGoOutAdditions] = useState([]);

  const you = state.players.find(p => p.id === state.youId);
  const isYourTurn = state.currentPlayerId === state.youId;
  const opponents = useMemo(() => {
    const idx = state.players.findIndex(p => p.id === state.youId);
    return [...state.players.slice(idx + 1), ...state.players.slice(0, idx)];
  }, [state.players, state.youId]);

  const stagedIds = staged.flatMap(m => m.ids);
  const handCards = state.hand.filter(c => !stagedIds.includes(c.id));

  const toggle = id =>
    setSelectedIds(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));

  const reset = () => { setSelectedIds([]); setStaged([]); setGoOut(false); setGoOutAdditions([]); };

  const stageMeld = () => {
    if (selectedIds.length < 3) return;
    const cards = selectedIds.map(id => state.hand.find(c => c.id === id));
    setStaged(s => [...s, { ids: selectedIds, cards }]);
    setSelectedIds([]);
  };

  const layMelds = () => {
    send('meld', { melds: staged.map(m => m.ids) });
    setStaged([]);
  };

  const addToMeld = (meldId, where) => {
    if (selectedIds.length === 0) return;
    if (goOut) {
      setGoOutAdditions(a => [...a, { meldId, cardIds: selectedIds, where }]);
      setStaged(s => [...s, { ids: selectedIds, cards: [], hidden: true }]); // reserve cards
    } else {
      send('addToMeld', { meldId, cardIds: selectedIds, where });
    }
    setSelectedIds([]);
  };

  const discard = () => {
    if (selectedIds.length !== 1) return;
    if (goOut) {
      send('draw', {
        source: 'closing',
        plan: {
          melds: staged.filter(m => !m.hidden).map(m => m.ids),
          additions: goOutAdditions,
          discardId: selectedIds[0]
        }
      });
      reset();
    } else {
      send('discard', { cardId: selectedIds[0] });
      setSelectedIds([]);
    }
  };

  const seatClass = i => {
    if (opponents.length === 1) return 'seat-top';
    if (opponents.length === 2) return ['seat-left', 'seat-right'][i];
    const map = {
      3: ['seat-left', 'seat-top', 'seat-right'],
      4: ['seat-left', 'seat-top-left', 'seat-top-right', 'seat-right'],
      5: ['seat-left', 'seat-top-left', 'seat-top', 'seat-top-right', 'seat-right']
    };
    return map[opponents.length][i];
  };

  let prompt;
  if (!isYourTurn) {
    prompt = `${state.players.find(p => p.id === state.currentPlayerId)?.name}'s turn`;
  } else if (goOut) {
    prompt = 'GO OUT: stage all your melds, then select the final discard and confirm';
  } else if (!state.hasDrawn) {
    prompt = 'Your turn — draw a card';
  } else {
    prompt = state.canMeldNow ? 'Meld if you like, then discard' : `Discard a card (melds unlock on turn ${state.config.meldDelayTurn})`;
  }

  return (
    <div className="table-screen">
      <div className="status-bar">
        <span>Round {state.roundNumber} · Turn {state.lap}</span>
        <span className={isYourTurn ? 'active-prompt' : ''}>{prompt}</span>
      </div>

      <div className="table-square">
        {opponents.map((p, i) => (
          <div key={p.id} className={`seat ${seatClass(i)} ${p.isCurrent ? 'current' : ''}`}>
            <div className="name">
              {p.name} · {p.handCount}
              {p.isDealer ? ' 🂠' : ''}{!p.connected ? ' ⚠' : ''}
            </div>
            <div className="mini-hand">
              {Array.from({ length: Math.min(p.handCount, 7) }).map((_, k) => (
                <div key={k} className="mini-card" />
              ))}
            </div>
          </div>
        ))}

        <div className="center-area">
          <div className="deck-stack"
            onClick={() => isYourTurn && !state.hasDrawn && send('draw', { source: 'deck' })}>
            {state.closingCard && (
              <div className={`peek ${cardColor(state.closingCard)}`}
                onClick={e => {
                  e.stopPropagation();
                  if (isYourTurn && !state.hasDrawn) setGoOut(true);
                }}>
                {cardLabel(state.closingCard)}
              </div>
            )}
            <div className="top">DECK<br />{state.drawCount}</div>
          </div>
          <div className={`discard-card ${state.discardTop ? cardColor(state.discardTop) : 'empty'}`}
            onClick={() => isYourTurn && !state.hasDrawn && state.discardTop && send('draw', { source: 'discard' })}>
            {state.discardTop ? cardLabel(state.discardTop) : '—'}
          </div>
        </div>
      </div>

      {goOut && (
        <div className="go-out-banner">
          Going out with the closing card.
          <button onClick={reset}>Cancel</button>
        </div>
      )}

      <div className="label">Melds on the table</div>
      <MeldsStrip
        melds={state.melds}
        canAdd={isYourTurn && state.hasDrawn && selectedIds.length > 0}
        onAdd={addToMeld}
      />

      {staged.filter(m => !m.hidden).length > 0 && (
        <div className="staged">
          <div className="label">Staged melds (not laid yet)</div>
          {staged.filter(m => !m.hidden).map((m, i) => (
            <div key={i} className="meld-cards">
              {m.cards.map(c => (
                <div key={c.id} className={`mc ${cardColor(c)}`}>{cardLabel(c)}</div>
              ))}
            </div>
          ))}
          {!goOut && <button onClick={layMelds}>Lay staged melds</button>}
          <button onClick={() => { setStaged(s => s.filter(m => m.hidden)); }}>Clear</button>
        </div>
      )}

      <div className="label">Your hand ({handCards.length}){you?.melded ? ' · opened' : ''}</div>
      <Hand cards={handCards} selectedIds={selectedIds} onToggle={toggle} />

      <div className="actions">
        <button
          disabled={!isYourTurn || !state.hasDrawn || selectedIds.length < 3 || !state.canMeldNow}
          onClick={stageMeld}
        >Stage meld ({selectedIds.length})</button>
        <button
          className="primary-inline"
          disabled={!isYourTurn || !state.hasDrawn || selectedIds.length !== 1}
          onClick={discard}
        >{goOut ? 'Confirm go out' : 'Discard'}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire into App.jsx** — replace the Task 8 placeholders:

```jsx
import CutScreen from './components/CutScreen.jsx';
import Table from './components/Table.jsx';
// ...
  } else if (state.phase === 'cutting') {
    screen = <CutScreen state={state} send={send} />;
  } else if (state.phase === 'playing') {
    screen = <Table state={state} send={send} />;
  }
```

- [ ] **Step 6: Append table styles to styles.css**

```css
.table-screen { display: flex; flex-direction: column; }
.status-bar { display: flex; justify-content: space-between; font-size: 13px;
  color: #9db8a5; padding: 6px 2px; }
.active-prompt { color: #e0a231; font-weight: 700; }
.table-square { width: 100%; aspect-ratio: 1; max-height: 46vh;
  background: radial-gradient(circle at center, #2f6b45, #1f4d31);
  border-radius: 16px; position: relative; border: 6px solid #14331f; }
.seat { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.seat .name { color: #fff; font-size: 12px; background: rgba(0,0,0,0.4);
  padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
.seat.current .name { background: #e0a231; color: #201500; font-weight: 700; }
.seat-top { top: 10px; left: 50%; transform: translateX(-50%); }
.seat-top-left { top: 10px; left: 18%; }
.seat-top-right { top: 10px; right: 18%; }
.seat-left { left: 10px; top: 50%; transform: translateY(-50%); }
.seat-right { right: 10px; top: 50%; transform: translateY(-50%); }
.mini-hand { display: flex; }
.mini-card { width: 22px; height: 32px; border-radius: 4px;
  background: repeating-linear-gradient(45deg, #4a5a8a, #4a5a8a 4px, #3b4a75 4px, #3b4a75 8px);
  border: 1px solid rgba(255,255,255,0.4); margin-left: -12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
.mini-hand .mini-card:first-child { margin-left: 0; }
.center-area { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  display: flex; align-items: center; gap: 18px; }
.deck-stack { position: relative; width: 54px; height: 76px; cursor: pointer; }
.deck-stack .peek { position: absolute; width: 54px; height: 76px; border-radius: 6px;
  background: #f4f0e4; border: 1px solid #999; top: 14px; left: 14px;
  display: flex; align-items: flex-end; justify-content: flex-end;
  padding: 3px 5px; font-size: 12px; font-weight: 700; }
.deck-stack .top { position: absolute; width: 54px; height: 76px; border-radius: 6px;
  background: repeating-linear-gradient(45deg, #4a5a8a, #4a5a8a 4px, #3b4a75 4px, #3b4a75 8px);
  border: 1px solid #fff; display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 10px; text-align: center; }
.discard-card { width: 54px; height: 76px; border-radius: 6px; background: #f4f0e4;
  border: 1px solid #ccc; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 18px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); cursor: pointer; }
.discard-card.empty { background: rgba(255,255,255,0.15); color: #fff; }
.red { color: #c0392b; } .black { color: #222; } .joker { color: #7d3ca3; }
.label { font-size: 12px; color: #9db8a5; margin: 10px 0 4px; }
.melds-strip { display: flex; gap: 12px; overflow-x: auto; padding: 8px;
  background: rgba(0,0,0,0.25); border-radius: 8px; min-height: 66px; }
.melds-strip.empty { align-items: center; justify-content: center; color: #6d8a77; font-size: 13px; }
.meld-group .who { font-size: 10px; color: #ccc; margin-bottom: 2px; }
.meld-cards { display: flex; align-items: center; }
.mc { width: 30px; height: 42px; border-radius: 4px; background: #f4f0e4;
  border: 1px solid #ccc; margin-left: -12px; display: flex; align-items: center;
  justify-content: center; font-size: 11px; font-weight: 600; }
.meld-cards .mc:first-child { margin-left: 0; }
.add-btn { width: 22px; height: 42px; padding: 0; margin: 0 2px; background: #e0a231;
  color: #201500; font-weight: 700; }
.your-hand { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-top: 6px; }
.your-hand .card { position: relative; width: 46px; height: 64px; border-radius: 6px;
  background: #f4f0e4; border: 1px solid #ccc; display: flex; align-items: center;
  justify-content: center; font-weight: 700; font-size: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2); padding: 0; }
.your-hand .card.selected { transform: translateY(-10px); outline: 3px solid #e0a231; }
.sel-order { position: absolute; top: -8px; right: -6px; background: #e0a231;
  color: #201500; font-size: 10px; border-radius: 50%; width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center; }
.actions { display: flex; gap: 10px; justify-content: center; margin: 12px 0; }
.primary-inline { background: #e0a231; color: #201500; font-weight: 700; }
.go-out-banner { background: #7d3ca3; color: #fff; border-radius: 8px; padding: 8px 12px;
  margin-top: 8px; display: flex; justify-content: space-between; align-items: center; }
.staged { background: rgba(224,162,49,0.12); border: 1px dashed #e0a231;
  border-radius: 8px; padding: 8px; margin-top: 6px; }
.staged .meld-cards { margin: 4px 0; }
.cut-screen { display: flex; flex-direction: column; align-items: center; padding-top: 12vh; gap: 10px; }
.cut-screen input[type='range'] { width: 260px; }
```

- [ ] **Step 7: Verify** — `npx vitest run` (all pass) and `npm run build` (succeeds).

- [ ] **Step 8: Commit** — `git add client && git commit -m "feat: table screen with circular layout and all move interactions"`

---

### Task 10: Client end screens — RoundEndSummary, JokerCarryoverReview, MatchEndSummary

**Files:**
- Create: `client/src/components/RoundEndSummary.jsx`, `client/src/components/JokerCarryoverReview.jsx`, `client/src/components/MatchEndSummary.jsx`
- Modify: `client/src/App.jsx` (wire), `client/src/styles.css` (append)

**Interfaces:**
- Consumes: `state.roundResult`, `state.carryover`, `state.players` (scores), `send`.
- Produces: three screens wired into App phase routing. Host sees "Next round" + "End match" on the round-end screen; dealer sees editable carryover; everyone sees final scoreboard sorted ascending (lowest penalty total first = best).

- [ ] **Step 1: Implement RoundEndSummary.jsx**

```jsx
export default function RoundEndSummary({ state, send }) {
  const you = state.players.find(p => p.id === state.youId);
  const scoreboard = [...state.players].sort((a, b) => a.score - b.score);
  return (
    <div className="summary-screen">
      <h1>Round {state.roundNumber} over</h1>
      <p className="winner">🏆 {state.roundResult?.winnerName} melded out!</p>
      {state.roundResult?.penalties.length > 0 && (
        <table className="score-table">
          <thead><tr><th>Player</th><th>Penalty</th><th>Total</th></tr></thead>
          <tbody>
            {scoreboard.map(p => {
              const pen = state.roundResult.penalties.find(x => x.id === p.id);
              return (
                <tr key={p.id} className={p.id === state.youId ? 'you-row' : ''}>
                  <td>{p.name}{p.carryJokers > 0 ? ` (★×${p.carryJokers})` : ''}</td>
                  <td>{pen ? `+${pen.points}` : '—'}</td>
                  <td>{p.score}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {state.carryover && (
        <p className="hint">★ Jokers left in hands carry into the next deal — the dealer will review them.</p>
      )}
      {you?.isHost ? (
        <div className="summary-actions">
          <button className="primary" onClick={() => send('nextRound')}>Next round</button>
          <button onClick={() => send('endMatch')}>End match</button>
        </div>
      ) : (
        <p className="hint">Waiting for the host…</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement JokerCarryoverReview.jsx**

```jsx
import { useState } from 'react';

export default function JokerCarryoverReview({ state, send }) {
  const editable = state.carryover?.editable;
  const [assignment, setAssignment] = useState(() => {
    const base = {};
    for (const p of state.players) base[p.id] = state.carryover?.assignment[p.id] || 0;
    return base;
  });
  const total = state.carryover?.total ?? 0;
  const assigned = Object.values(assignment).reduce((a, b) => a + b, 0);
  const bump = (id, delta) =>
    setAssignment(a => ({ ...a, [id]: Math.max(0, (a[id] || 0) + delta) }));

  if (!editable) {
    const dealer = state.players.find(p => p.isDealer);
    return (
      <div className="summary-screen">
        <h1>Joker carryover</h1>
        <p className="hint">{dealer?.name} is reviewing who keeps the leftover joker(s)…</p>
      </div>
    );
  }
  return (
    <div className="summary-screen">
      <h1>Joker carryover</h1>
      <p>You deal next. Assign the {total} leftover joker(s) into next round's hands:</p>
      <ul className="carry-list">
        {state.players.map(p => (
          <li key={p.id}>
            <span>{p.name}</span>
            <span className="stepper">
              <button onClick={() => bump(p.id, -1)}>−</button>
              <b>{assignment[p.id]}</b>
              <button onClick={() => bump(p.id, +1)}>+</button>
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">{assigned}/{total} assigned</p>
      <button
        className="primary"
        disabled={assigned !== total}
        onClick={() => {
          send('adjustCarryover', { assignment });
          send('confirmCarryover');
        }}
      >Confirm and deal</button>
    </div>
  );
}
```

- [ ] **Step 3: Implement MatchEndSummary.jsx**

```jsx
export default function MatchEndSummary({ state }) {
  const scoreboard = [...state.players].sort((a, b) => a.score - b.score);
  return (
    <div className="summary-screen">
      <h1>Match over</h1>
      <p className="winner">🏆 {scoreboard[0]?.name} wins with {scoreboard[0]?.score} points</p>
      <table className="score-table">
        <thead><tr><th>#</th><th>Player</th><th>Total penalty</th></tr></thead>
        <tbody>
          {scoreboard.map((p, i) => (
            <tr key={p.id} className={p.id === state.youId ? 'you-row' : ''}>
              <td>{i + 1}</td><td>{p.name}</td><td>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Lowest total wins. Refresh to start a new lobby (restart the server).</p>
    </div>
  );
}
```

- [ ] **Step 4: Wire into App.jsx** (replace remaining placeholders) and append styles:

```css
.summary-screen { display: flex; flex-direction: column; align-items: center; padding-top: 8vh; gap: 12px; }
.winner { font-size: 20px; }
.score-table { border-collapse: collapse; min-width: 280px; }
.score-table th, .score-table td { padding: 8px 14px; text-align: left;
  border-bottom: 1px solid rgba(255,255,255,0.15); }
.you-row { background: rgba(224,162,49,0.15); }
.summary-actions { display: flex; flex-direction: column; gap: 8px; width: 260px; }
.carry-list { list-style: none; padding: 0; width: 280px; }
.carry-list li { display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.15); }
.stepper { display: flex; align-items: center; gap: 10px; }
.stepper button { width: 32px; }
```

- [ ] **Step 5: Verify** — `npx vitest run` all pass; `npm run build` succeeds.

- [ ] **Step 6: Commit** — `git add client && git commit -m "feat: round-end, carryover review and match-end screens"`

---

### Task 11: End-to-end verification + README

**Files:**
- Create: `README.md`

**Interfaces:** none new — this task proves the whole stack works together.

- [ ] **Step 1: Full test suite** — Run `npm test` → all server + client tests PASS.

- [ ] **Step 2: Production build + server boot** — Run `npm run start` in the background; verify the terminal prints `http://<LAN-IP>:3000`; `curl -s http://localhost:3000 | grep -i žolíky` (or `<div id="root">`) returns the SPA shell.

- [ ] **Step 3: Scripted multi-client round-trip** — Write a throwaway script in the scratchpad (NOT committed) using `socket.io-client`: two clients join, host starts, cutter cuts, first player discards, second draws+discards; assert every received `state` has `players[i].hand === undefined` and phases advance. Run it against the live server, then kill the server.

- [ ] **Step 4: Write README.md**

```markdown
# Žolíky

LAN multiplayer web version of Žolíky (Czech/Slovak Rummy) for 2–6 players.

## Play

    npm install
    npm run start

The terminal prints a LAN URL like `http://192.168.x.x:3000`. Everyone
(including the host) opens it in a browser, types a name, and joins.
The first player to join is the host: they set house rules (opening
threshold 42/51, meld-delay turn) and start the match.

If a browser refreshes or drops, rejoin with the same name to get your
seat and hand back. The host ends the match with **End match** on any
round-end screen; lowest total penalty wins.

## Rules implemented

2×52 cards + 6 jokers (110). Dealer rotates; player left of dealer cuts;
first player gets 15 cards and opens the discard pile; a closing card is
tucked face-up under the draw pile (take it only to meld out and win that
turn). Turn = draw → optional melds → discard. Opening needs 42/51+ points
incl. a pure sequence; no melds or discard pickup before the configured
turn (default 4). Penalties: A/K/Q/J 10, numbers face value, joker 50.
Leftover jokers carry into the next deal (dealer reviews).

## Development

    npm test            # vitest: game logic + socket + client smoke tests
    npm run dev:server  # backend on :3000
    npm run dev:client  # vite dev server proxying socket.io to :3000
```

- [ ] **Step 5: Commit** — `git add README.md && git commit -m "docs: README with play and dev instructions"`

- [ ] **Step 6: Final check** — `git status` clean; `npm test` green; report completion.

---

## Self-Review

- **Spec coverage:** deck composition (T2), dealing/cut/closing card (T4), draw sources incl. closing-card go-out (T5), melds + joker adjacency + pure sequence + opening thresholds 42/51 + meld-delay (T3/T5), scoring + joker carryover + dealer review (T6, T10), match structure + End Match (T6, T10), server-authoritative validation + per-socket filtering (T5–T7), lobby/house rules (T8), circular table layout per validated brainstorm (T9), LAN URL + reconnection (T7, T8), unit tests for game logic + smoke tests for socket/client (T2–T8). ✔
- **Placeholder scan:** the two deliberate forward references are Task 5's `#endRound` stub (completed with full code in Task 6) and Task 8's phase placeholders (replaced with full code in Tasks 9–10) — both are real code at every point, not TBDs. ✔
- **Type consistency:** card `{id, suit, rank, joker}` everywhere; `validateMeld` returns `{valid, type, points, pure}` (T3, consumed T5); state payload field names in T6 match client usage in T8–T10 (`youId`, `hand`, `players[].handCount`, `discardTop`, `closingCard`, `melds[].ownerName`, `carryover.assignment`, `roundResult.penalties`); socket event names in T7 match client `send` calls in T8–T10. ✔
