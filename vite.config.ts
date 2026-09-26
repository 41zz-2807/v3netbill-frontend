import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Domain publik tidak disimpan di repo — declare lewat ALLOWED_HOSTS di .env
// (pisah koma bila lebih dari satu). Kosongkan untuk hanya menerima localhost/LAN.
const allowedHosts = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts,
    proxy: {
      '/api': {
        target: 'http://v3netbill-backend:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://v3netbill-backend:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})