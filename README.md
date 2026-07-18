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

**If the host closes their tab, the game automatically ends for everyone.**

## Features

- **SVG card rendering** — polished playing cards with suit symbols and corner ranks
- **Drag-and-drop hand reordering** — drag cards to arrange them before melding
- **Closing card highlight** — horizontal card with golden glow, visually distinct from the deck
- **Admin panel** (http://localhost:3001) — manage players, kick players, force-end matches, or reset the game
- **Auto-reconnect** — rejoin by name if disconnected
- **Per-player state filtering** — server never leaks other players' hands over the network

## Rules implemented

2×52 cards + 6 jokers (110). Dealer rotates; player left of dealer cuts;
first player gets 15 cards and opens the discard pile; a closing card is
tucked face-up under the draw pile (take it only to meld out and win that
turn). Turn = draw → optional melds → discard. Opening needs 42/51+ points
incl. a pure sequence; no melds or discard pickup before the configured
turn (default 4). Penalties: A/K/Q/J 10, numbers face value, joker 50.
Leftover jokers carry into the next deal (dealer reviews).

## Development

    npm test            # vitest: game logic + socket + client smoke tests (62 passing)
    npm run build       # build client for production
    npm run dev:server  # backend on :3000
    npm run dev:client  # vite dev server proxying socket.io to :3000



This project was meant as a way for me to see how well claude's Fable 5 would be during my week of having it.
I was able to one-shot this app without having any external resources.
Plan: used sonnet
Execute via .md files: all Fable 5
I also used some of Christopher Kapic's harness in this process which supplemented Fable 5.


