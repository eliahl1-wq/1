import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    fs: {
      // Slither Studio imports the authoritative engine from the sibling server project.
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Polyfill for 'buffer' module, often needed by crypto/wallet libraries
      // This points 'buffer' imports to a browser-compatible version.
      buffer: 'buffer/',
    },
  },
  // Optional: If the 'buffer' warning persists or causes runtime errors,
  // you might need to explicitly tell Vite to optimize it.
  // optimizeDeps: {
  //   include: ['buffer'],
  // },
});