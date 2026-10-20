import { api } from './client'
// VITE_USE_MOCK=true 이면 api/mock 의 인메모리 데이터를 사용한다 (파일 안에서 상수로 선언해야 운영 빌드에서 제거된다).
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const mock = () => import('./mock')

// GET /api/reports/email-status → { email: 'h***@gmail.com', status: 'verified' | 'pending' | 'unverified' }
export const getEmailStatus = async () =>
  USE_MOCK ? (await mock()).mockReports.status() : api.get('/reports/email-status')

// POST /api/reports/email-verification — 내 주소로 AWS 인증 메일 (이미 pending·verified 면 다시 보내지 않음)
export const requestEmailVerification = async () =>
  USE_MOCK ? (await mock()).mockReports.requestVerification() : api.post('/reports/email-verification')

// POST /api/reports/monthly-email — 선택 월 명세서를 내 메일로 (202 { sent_to }, 미인증 409, 5분 제한 429)
export const sendMonthlyEmail = async (month) =>
  USE_MOCK ? (await mock()).mockReports.sendMonthly({ month }) : api.post('/reports/monthly-email', { month })
