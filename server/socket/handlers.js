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
