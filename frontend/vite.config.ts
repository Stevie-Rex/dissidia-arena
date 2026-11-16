import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin API so the Flask session cookie just works (and OAuth redirects land here).
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
})
