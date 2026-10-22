import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Relative base: the itch.io iframe serves the game from a subpath —
  // absolute asset URLs would 404 there. Local dev/preview unaffected.
  base: './',
  plugins: [react()],
  // Dedicated Simulation Worker imports cold IndexedDB pages asynchronously.
  // That requires an ES-module worker output: IIFE cannot split worker chunks.
  worker: { format: 'es' },
  // Both HTML entries mount the same canonical Worker shell in production.
  // Legacy main-thread simulation is gated behind an explicit DEV-only query.
  build: {
    rollupOptions: {
      input: {
        game: path.resolve(__dirname, 'index.html'),
        worker: path.resolve(__dirname, 'worker.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: true,
  },
});
