import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process/browser',
      stream: 'stream-browserify',
      events: 'events',
    },
  },

  define: {
    global: 'window',
  },

  optimizeDeps: {
    include: ['buffer', 'process', 'stream-browserify', 'events'],
  },
})