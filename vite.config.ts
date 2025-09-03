import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// ★ base は GitHub Pages のリポジトリ名に合わせて後で変更
export default defineConfig({
plugins: [react()],
base: '/my-review-app/'
})