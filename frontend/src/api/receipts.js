import { api } from './client'
// VITE_USE_MOCK=true 이면 api/mock 의 인메모리 데이터를 사용한다 (파일 안에서 상수로 선언해야 운영 빌드에서 제거된다).
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const mock = () => import('./mock')

// POST /api/receipts/analyze (multipart, 필드 이름 file) — 영수증·명세서 1개를 분석해 "저장하지 않은" 거래 입력 초안을 돌려준다.
// file: File (JPEG·PNG·WEBP 이미지 또는 PDF, 5MB 이하)
// → { items: [{ type, amount_krw, occurred_on|null, merchant|null, memo|null, category_id|null, category_name|null }], warnings: string[] }
// 저장은 사용자가 확인한 항목만 기존 createTransaction(POST /api/transactions)으로 한다.
export const analyzeReceipt = async (file) => {
  if (USE_MOCK) return (await mock()).mockReceipts.analyze(file)
  const form = new FormData()
  form.append('file', file)
  return api.upload('/receipts/analyze', form)
}
