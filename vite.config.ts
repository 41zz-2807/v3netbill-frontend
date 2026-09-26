import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['v3netbill.<domain>'],
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