import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function setupAdminRoutes(app, game, io) {
  // Serve admin HTML
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
  });

  // API: Get game state
  app.get('/api/state', (req, res) => {
    const players = game.players.map(p => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      handCount: p.hand.length,
      isHost: p.id === game.hostId,
      score: p.score
    }));
    res.json({
      phase: game.phase,
      players,
      hostId: game.hostId,
      roundNumber: game.roundNumber
    });
  });

  // API: End the match
  app.post('/api/end-match', (req, res) => {
    try {
      game.forceEndMatch();
      // Broadcast to all connected clients
      for (const socket of io.sockets.sockets.values()) {
        socket.emit('state', game.getStateFor(socket.playerId));
      }
      res.json({ success: true, message: 'Match ended' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // API: Kick a player
  app.post('/api/kick-player/:playerId', (req, res) => {
    const { playerId } = req.params;
    try {
      // Find and disconnect all sockets for this player
      let kicked = false;
      for (const socket of io.sockets.sockets.values()) {
        if (socket.playerId === playerId) {
          socket.disconnect(true);
          kicked = true;
        }
      }
      if (!kicked) throw new Error('Player not found');
      res.json({ success: true, message: `Kicked player ${playerId}` });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // API: Reset game (new lobby)
  app.post('/api/reset', (req, res) => {
    try {
      // Disconnect all clients and reset game state
      for (const socket of io.sockets.sockets.values()) {
        socket.emit('state', {
          phase: 'lobby',
          players: [],
          youId: socket.playerId,
          hand: [],
          config: { openingThreshold: 51, meldDelayEnabled: true, meldDelayTurn: 4 }
        });
        socket.disconnect(true);
      }
      // Note: Game object persists; new players can rejoin to create a new lobby
      res.json({ success: true, message: 'Game reset, all clients disconnected' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });
}
