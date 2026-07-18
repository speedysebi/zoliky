import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { Game } from './game/game.js';
import { attachSocketHandlers } from './socket/handlers.js';
import { setupAdminRoutes } from './admin/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PORT = Number(process.env.ADMIN_PORT) || 3001;

// Game server
const app = express();
app.use(express.static(path.join(__dirname, '../client/dist')));

const httpServer = createServer(app);
const io = new Server(httpServer);
const game = new Game();
attachSocketHandlers(io, game);

// Admin panel server
const adminApp = express();
setupAdminRoutes(adminApp, game, io);

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

adminApp.listen(ADMIN_PORT, '0.0.0.0', () => {
  console.log(`Admin panel running at http://localhost:${ADMIN_PORT}\n`);
});
