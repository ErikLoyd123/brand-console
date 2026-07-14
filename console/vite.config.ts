import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite dev server on 3001; every /api call is proxied to the local Express API on 5174.
// The more-specific WebSocket entries (ws: true) are listed first so Vite's
// longest-prefix match routes each upgrade there instead of the HTTP /api entry.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    strictPort: true,
    proxy: {
      '/api/terminal': {
        target: 'ws://localhost:5174',
        ws: true,
        changeOrigin: true,
      },
      // The skill-surface prefix serves BOTH the WS conversation (upgrade at
      // /api/skill-surface) and the HTTP health probe (/api/skill-surface/health).
      // An http:// target with ws:true proxies both; without this entry the WS
      // upgrade falls through to the HTTP /api proxy and hangs at "Connecting…".
      '/api/skill-surface': {
        target: 'http://localhost:5174',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
})
