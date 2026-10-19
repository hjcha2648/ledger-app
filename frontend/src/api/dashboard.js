import { api } from './client'
// VITE_USE_MOCK=true 이면 api/mock 의 인메모리 데이터를 사용한다 (파일 안에서 상수로 선언해야 운영 빌드에서 제거된다).
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const mock = () => import('./mock')

// month: 'YYYY-MM' → { month, summary, expense_by_category, monthly_compare }
export const getDashboard = async (month) =>
  USE_MOCK ? (await mock()).mockDashboard.get(month) : api.get('/dashboard', { month })
