import { api } from './client'
// VITE_USE_MOCK=true 이면 api/mock 의 인메모리 데이터를 사용한다 (파일 안에서 상수로 선언해야 운영 빌드에서 제거된다).
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const mock = () => import('./mock')

// 기본 + 내 카테고리 배열
export const listCategories = async () => (USE_MOCK ? (await mock()).mockCategories.list() : api.get('/categories'))

// { name, type: 'INCOME' | 'EXPENSE' }
export const createCategory = async (data) =>
  USE_MOCK ? (await mock()).mockCategories.create(data) : api.post('/categories', data)
