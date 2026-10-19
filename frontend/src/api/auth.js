import { api } from './client'
// VITE_USE_MOCK=true 이면 api/mock 의 인메모리 데이터를 사용한다 (파일 안에서 상수로 선언해야 운영 빌드에서 제거된다).
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// 목 서버는 동적 import — 운영 빌드(VITE_USE_MOCK=false)에서는 번들에서 제거된다.
const mock = () => import('./mock')

// 회원가입: { email, password } → { id, email }
export const register = async (data) => (USE_MOCK ? (await mock()).mockAuth.register(data) : api.post('/auth/register', data))

// 로그인: { email, password } → { access_token, token_type }
export const login = async (data) => (USE_MOCK ? (await mock()).mockAuth.login(data) : api.post('/auth/login', data))

// 현재 사용자 (선택적 구현 API)
export const getMe = async () => (USE_MOCK ? (await mock()).mockAuth.me() : api.get('/auth/me'))
