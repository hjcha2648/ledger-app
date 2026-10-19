import { api } from './client'
// VITE_USE_MOCK=true 이면 api/mock 의 인메모리 데이터를 사용한다 (파일 안에서 상수로 선언해야 운영 빌드에서 제거된다).
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const mock = () => import('./mock')

// month: 'YYYY-MM' → 거래 배열 (최신순)
export const listTransactions = async (month) =>
  USE_MOCK ? (await mock()).mockTransactions.list(month) : api.get('/transactions', { month })

// { type, amount_krw, occurred_on, category_id, merchant?, memo? }
export const createTransaction = async (data) =>
  USE_MOCK ? (await mock()).mockTransactions.create(data) : api.post('/transactions', data)

export const updateTransaction = async (id, data) =>
  USE_MOCK ? (await mock()).mockTransactions.update(id, data) : api.patch(`/transactions/${id}`, data)

export const deleteTransaction = async (id) =>
  USE_MOCK ? (await mock()).mockTransactions.remove(id) : api.delete(`/transactions/${id}`)
