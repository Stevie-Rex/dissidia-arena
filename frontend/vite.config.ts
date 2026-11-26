import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // A fixed port that fails loudly when taken, so a stale dev server is found at once
    // instead of a new one quietly starting on 5174, 5175 and so on. Playwright passes its own port.
    port: 5173,
    strictPort: true,
    // Same-origin API so the Flask session cookie just works (and OAuth redirects land here).
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
})
