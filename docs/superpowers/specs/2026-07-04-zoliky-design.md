# Žolíky — Design Spec

Date: 2026-07-04

## 1. Scope

A LAN-playable web version of Žolíky (Czech/Slovak Rummy-style card game), played as a multi-round match:

- 2–6 human players. One device (the host) runs a local Node.js server; every player, including the host, plays through a browser tab pointed at the host's LAN URL.
- No bots — every seat is a human player.
- No internet/cloud dependency — LAN only.

## 2. Rules Implemented

**Deck:** 2 standard 52-card decks + 6 jokers = 110 cards total.

**Setup / dealing (per round):**
- Dealer rotates each round.
- Player to dealer's left cuts the deck.
- Player immediately after the dealer receives 15 cards and discards one right away to start the discard pile; every other player receives 14.
- After dealing, the dealer flips the next card face-up and tucks it under the draw pile — this is the **closing card**.

**Turn structure:** draw one card → optionally lay/add to meld(s) → discard one card.

**Draw sources:**
- Draw pile (face-down, normal draw).
- Discard pile (top card) — **only allowed once the meld-delay turn has begun** (see below).
- Closing card — **only drawable if doing so lets the player meld out and win the round on that same turn.** (In practice this can't happen before the meld-delay turn anyway, since melding is banned until then.)

**Melds:**
- Sequences: 3+ consecutive cards of the same suit.
- Sets: 3–4 cards of the same rank, different suits.
- Jokers are wild but cannot fill two consecutive slots within the same sequence.

**Opening rule:** a player's first meld(s) must total a configurable point threshold (**42 or 51**, house-rule setting) and include at least one *pure* sequence (no joker).

**Meld-delay rule:** no player may lay down any meld until a configurable turn/lap number of the hand has begun (**default: turn 4**, configurable). Until that turn begins, discard-pile pickup is also disabled — only the draw pile may be drawn from.

**Round end:** the round ends the instant a player melds/adds out their entire hand and discards their final card face-up. That player wins the round.

**Scoring:** each other player's remaining hand is scored as penalty points added to their running match total:
- A/K/Q/J = 10
- Number cards = face value
- Joker = 50

**Joker carryover:** any joker(s) left in a player's hand at round end are automatically carried into that player's deal for the next round. Before the next round starts, a screen is shown to the dealer to review and, if needed, manually adjust the carryover assignment.

**Match structure:** the match consists of any number of rounds played in sequence, with the dealer rotating each round and scores accumulating on a running scoreboard. There is no fixed target score — the host ends the match manually via an "End Match" control, after which a final scoreboard is shown.

**House rules (configurable by host before match start):**
- Opening threshold: 42 or 51 points
- Meld-delay: on/off, and which turn number it lifts at (default 4)

## 3. Architecture

**Backend — Node.js + Socket.IO.** A single authoritative process holds all game state: deck, hands, discard pile, table melds, scores, dealer/turn pointer, and house-rule config. Clients never receive other players' hand contents — the server filters state per-socket before emitting. Opponents are represented to other clients only by name + card count; the shared melds strip and closing/discard cards are visible to everyone.

**Frontend — React**, single page app served by the same host. Flow:
- **Lobby:** players type in their name and join. Host sees a "Start Game" control plus a house-rules panel (opening threshold, meld-delay toggle/turn number).
- **Table:** the validated circular layout — opponents seated around the edge showing only hidden card-backs + counts, center area with draw pile (closing card peeking beneath) and visible discard pile, a melds strip below showing every player's laid-down melds tagged by name, and the player's own hand always visible at the bottom.
- **Round-end summary:** shows the round winner and updated scoreboard.
- **Joker carryover review:** shown to the dealer between rounds if any jokers were left in hands.
- **Match-end summary:** final scoreboard, shown after the host ends the match.

**Networking:** host runs `npm run start`; the terminal prints the LAN URL (e.g. `http://192.168.x.x:3000`). Other players open that URL on their own device's browser. Reconnection: if a player's browser drops/refreshes, the server retains their seat and hand; rejoining under the same name reattaches to the existing state.

**Components:**
- `server/game/` — pure game-logic module: dealing, turn/move validation, meld validation, opening-threshold check, meld-delay gating, scoring, joker carryover, round/match progression. No networking — fully unit-testable.
- `server/socket/` — Socket.IO event handlers; call into `server/game/`, broadcast per-socket-filtered state.
- `client/` — React components: `Lobby`, `HouseRulesPanel`, `Table`, `Hand`, `MeldsStrip`, `RoundEndSummary`, `JokerCarryoverReview`, `MatchEndSummary`.

## 4. Game Flow & Validation

**Per-round state machine:**
```
dealing → turn(draw → meld?(if allowed) → discard) → next player [loop]
  → someone melds out → round-end scoring → joker carryover review (dealer)
  → next round (dealing, dealer rotated)
  ... until host clicks "End Match" → match-end summary
```

**Validation:** every move (draw source choice, meld legality, opening threshold, meld-delay timing, discard) is validated server-side only. Clients render server-provided state and send move *attempts*; the server is the single source of truth.

**Testing:** `server/game/` gets thorough unit tests (dealing counts for 2–6 players, meld validation incl. joker rules, opening threshold both variants, meld-delay gating, scoring, joker carryover, round/match progression). `server/socket/` and `client/` get lighter smoke tests since they're mostly wiring around the validated game-logic module.

## 5. Implementation Note

Implementation (coding) will be done using the Fable 5 model.
