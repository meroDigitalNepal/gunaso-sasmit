import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'development' ? '/' : '/gunaso/',
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
}))
