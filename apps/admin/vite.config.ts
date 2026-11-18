import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, everything that is not the admin app comes from the live site.
const live = { target: 'https://onlytools.click', changeOrigin: true }
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: { proxy: { '/api': live, '/auth.js': live, '/config.json': live, '/only-tools.css': live, '/auth/callback': live } },
})
