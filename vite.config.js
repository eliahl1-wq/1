import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
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