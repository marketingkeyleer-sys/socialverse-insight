import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Listen on IPv4 and IPv6. By default Vite binds only to whatever "localhost"
  // resolves to, which on some Windows setups is IPv6 alone, so
  // http://127.0.0.1:5173 (and some browsers) can't open the app.
  server: { host: true, port: 5173, strictPort: true },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
