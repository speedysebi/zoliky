# CLAUDE.md

Guidance for Claude Code working with Žolíky.

## Repository shape

Žolíky is a single-package Node.js + React web app (no monorepo).

- `server/` — Node.js + Socket.IO backend
  - `server/game/` — pure game logic (no networking)
  - `server/socket/` — Socket.IO handlers
  - `server/index.js` — Express bootstrap
- `client/` — React 19 SPA (Vite)
  - `client/src/components/` — React components
  - `client/src/styles.css` — single stylesheet
  - `client/src/socket.js` — Socket.IO client singleton
- `docs/superpowers/` — planning and specs
- `package.json`, `vite.config.js` — build config

## Key commands

```bash
npm install               # install deps
npm run build            # build client for production
npm run start            # build + start server on :3000
npm run dev:client       # vite dev server
npm run dev:server       # node server (no build)
npm test                 # vitest (62 tests)
```

## Workflow rules

1. **Do not commit** unless explicitly asked.
2. **Do not install dependencies** without asking first.
3. **Do not weaken security/validation** (server is single source of truth, no hand leaks).
4. Create `.md` files in `docs/` for planning complex work.
5. Use `/code-review` before merging to main.

## Current state

- 110-card game engine with full ruleset (melds, jokers, opening threshold, meld-delay, scoring, carryover)
- Socket.IO server with per-player state filtering
- React UI: lobby, table (circular layout), round-end, carryover review, match-end
- 62 passing tests (game logic, socket smoke, client render)
- Published on GitHub: https://github.com/speedysebi/zoliky
