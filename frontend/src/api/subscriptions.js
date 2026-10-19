import { api } from './client'
// VITE_USE_MOCK=true 이면 api/mock 의 인메모리 데이터를 사용한다 (파일 안에서 상수로 선언해야 운영 빌드에서 제거된다).
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const mock = () => import('./mock')

// 목록 관리만 지원: 조회·등록·삭제 (수정 없음)
export const listSubscriptions = async () =>
  USE_MOCK ? (await mock()).mockSubscriptions.list() : api.get('/subscriptions')

// { name, amount_krw, billing_cycle, billing_anchor_date, category_id, memo? }
export const createSubscription = async (data) =>
  USE_MOCK ? (await mock()).mockSubscriptions.create(data) : api.post('/subscriptions', data)

export const deleteSubscription = async (id) =>
  USE_MOCK ? (await mock()).mockSubscriptions.remove(id) : api.delete(`/subscriptions/${id}`)
