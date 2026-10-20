import { api } from './client'
// VITE_USE_MOCK=true 이면 api/mock 의 인메모리 데이터를 사용한다 (파일 안에서 상수로 선언해야 운영 빌드에서 제거된다).
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const mock = () => import('./mock')

// POST /api/chat — 선택 월의 본인 데이터를 근거로 답한다 (조회 전용, 대화는 서버에 저장되지 않음).
// month: 'YYYY-MM', messages: [{ role: 'user'|'assistant', content }] 오래된 순서, 1~10개, 마지막은 user
// → 답변 일반 텍스트(줄바꿈·"- " 목록 포함, 마크다운 없음)
export const sendChat = async ({ month, messages }) => {
  const res = USE_MOCK ? await (await mock()).mockChat.send({ month, messages }) : await api.post('/chat', { month, messages })
  return res.reply
}
