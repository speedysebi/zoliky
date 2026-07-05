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
