import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// dev では base='/'、build時(=本番)のみ '/my-review-app/' に
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/my-review-app/' : '/',
}))
