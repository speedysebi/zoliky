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
