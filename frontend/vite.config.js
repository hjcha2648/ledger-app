import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 개발 서버에서는 /api 요청을 로컬 FastAPI로 프록시한다.
// 배포 환경에서는 CloudFront의 /api/* 동작이 같은 역할을 한다.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
