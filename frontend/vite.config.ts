import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5188,
    strictPort: true,
    proxy: { '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:5088', ws: true } },
  },
})
