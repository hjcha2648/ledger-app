import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// 개발 서버에서는 /api 요청을 로컬 FastAPI로 프록시한다.
// 배포 환경에서는 CloudFront의 /api/* 동작이 같은 역할을 한다.
// 8000 포트를 다른 프로세스가 쓰는 경우 .env 의 API_PROXY_TARGET 으로 바꾼다.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
      },
    },
  }
})
