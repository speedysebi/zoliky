# Žolíky

LAN multiplayer web version of Žolíky (Czech/Slovak Rummy) for 2–6 players.

## Play

    npm install
    npm run start

The terminal prints a LAN URL like `http://192.168.x.x:3000`. Everyone
(including the host) opens it in a browser, types a name, and joins.
The first player to join is the host: they set house rules (opening
threshold 42/51, meld-delay turn) and start the match.

If a non-host player's browser refreshes or drops, reconnect with the same
name in the same browser profile. The browser saves a private reconnect
token locally so another player cannot reclaim the seat by guessing the
name. Clearing that browser's site data removes the token and prevents
reclaiming the seat. If the host disconnects during a match, the match ends
for everyone; the host cannot refresh and rejoin an active match. The host
can end the match with **End match** on any round-end screen; lowest total
penalty wins.

**If the host closes their tab, refreshes, or loses the connection during a
match, the game automatically ends for everyone.**

## Network and safety

- The game server listens on TCP port `3000` by default. Allow incoming
  connections to that port only on a trusted private network. If the terminal
  prints several IP addresses, use the host address on the same subnet as the
  other players. Guest Wi-Fi and client-isolation settings can block devices
  from connecting to one another.
- The admin panel uses TCP port `3001` by default and listens only on the host's
  loopback interface. Open it on the host at `http://localhost:3001`; do not
  open this port to the LAN.
- The game uses plain HTTP and has no player accounts or invitations. Anyone
  who can reach the game server can join an open lobby, so use a network you
  trust rather than public Wi-Fi.

## Features

- **SVG card rendering** — polished playing cards with suit symbols and corner ranks
- **Drag-and-drop hand reordering** — drag cards to arrange them before melding
- **Closing card highlight** — horizontal card with golden glow, visually distinct from the deck
- **Host-only admin panel** (http://localhost:3001) — manage players, kick players, force-end matches, or reset the game
- **Token-protected reconnect** — reclaim your seat from the same browser profile
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


