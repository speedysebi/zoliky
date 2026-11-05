import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as clientIo } from 'socket.io-client';
import { Game } from '../game/game.js';
import { attachSocketHandlers } from './handlers.js';

let httpServer, io, port;
const sockets = [];
let benReconnectToken;
let benSocket;

// keep a running log of states per socket so no broadcast is ever missed
function connect() {
  const s = clientIo(`http://localhost:${port}`, { transports: ['websocket'] });
  s.states = [];
  s.on('state', st => s.states.push(st));
  sockets.push(s);
  return s;
}
function emitAck(socket, event, payload) {
  return new Promise(resolve => socket.emit(event, payload, resolve));
}
function waitFor(socket, predicate, timeout = 5000) {
  const existing = [...socket.states].reverse().find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for state')), timeout);
    const listener = st => {
      if (predicate(st)) {
        clearTimeout(timer);
        socket.off('state', listener);
        resolve(st);
      }
    };
    socket.on('state', listener);
  });
}

beforeAll(async () => {
  httpServer = createServer();
  io = new Server(httpServer);
  attachSocketHandlers(io, new Game());
  await new Promise(resolve => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});

afterAll(() => {
  for (const s of sockets) s.disconnect();
  io.close();
});

describe('socket wiring', () => {
  it('join → personalized state; opponent hands are hidden; moves flow end to end', async () => {
    const a = connect();
    const b = connect();
    benSocket = b;
    const joinA = await emitAck(a, 'join', { name: 'Ana' });
    expect(joinA.ok).toBe(true);
    const joinB = await emitAck(b, 'join', { name: 'Ben' });
    expect(joinB.ok).toBe(true);
    expect(joinB.reconnectToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    benReconnectToken = joinB.reconnectToken;

    // host configures + starts
    a.emit('configure', { openingThreshold: 42 });
    a.emit('startMatch', {});
    const sb = await waitFor(b, st => st.phase === 'cutting');
    expect(sb.config.openingThreshold).toBe(42);

    // Ben is cutter (left of dealer Ana)
    b.emit('cut', { index: 30 });
    const sb2 = await waitFor(b, st => st.phase === 'playing');
    expect(sb2.hand.length === 15 || sb2.hand.length === 14).toBe(true);
    expect(sb2.reconnectToken).toBeUndefined();
    // no other player's cards leak
    for (const p of sb2.players) {
      expect(p.hand).toBeUndefined();
      expect(p.reconnectToken).toBeUndefined();
    }

    // an illegal move produces gameError for that socket
    const notCurrent = sb2.currentPlayerId === joinA.playerId ? b : a;
    const errTarget = new Promise(r => notCurrent.once('gameError', r));
    notCurrent.emit('discard', { cardId: 'S1-0' });
    const err = await errTarget;
    expect(err.message).toBeTruthy();
  }, 15000);

  it('requires the reconnect token to reattach a name and preserves the hand', async () => {
    const benState = [...benSocket.states].reverse().find(st => st.phase === 'playing');
    const handBefore = benState.hand.map(card => card.id);
    benSocket.disconnect();

    const c = connect();
    const nameOnlyJoin = await emitAck(c, 'join', { name: 'Ben' });
    expect(nameOnlyJoin.ok).toBe(false);

    const rejoin = await emitAck(c, 'join', { name: 'Ben', reconnectToken: benReconnectToken });
    expect(rejoin.ok).toBe(true);
    const s = await waitFor(c, st => st.phase === 'playing');
    expect(s.hand.map(card => card.id)).toEqual(handBefore);
  }, 15000);
});
