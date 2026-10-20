const krw = new Intl.NumberFormat('ko-KR')

export function formatKRW(amount) {
  return `${krw.format(amount ?? 0)}원`
}

// 단위 없는 숫자: 320000 → 320,000 (열 맞춤 표에서 사용)
export const formatNumber = (n) => krw.format(n ?? 0)

// 거래 금액 표시: 수입은 +, 지출은 − 부호
export function formatSignedKRW(type, amount) {
  return `${type === 'INCOME' ? '+' : '−'}${formatKRW(amount)}`
}

// 수입=초록, 지출=빨강
export function typeColorClass(type) {
  return type === 'INCOME' ? 'text-income-ink' : 'text-expense-ink'
}

export const TYPE_LABEL = { INCOME: '수입', EXPENSE: '지출' }

export const CYCLE_LABEL = { WEEKLY: '매주', MONTHLY: '매월', YEARLY: '매년' }

// 'YYYY-MM-DD' → 'YYYY.MM.DD'
export function formatDate(iso) {
  return iso ? iso.replaceAll('-', '.') : ''
}

// 차트 축용 축약 표기: 1,500,000 → 150만
export function formatCompactKRW(amount) {
  if (amount === 0) return '0'
  if (Math.abs(amount) >= 10000) return `${Number((amount / 10000).toFixed(1))}만`
  return krw.format(amount)
}

// 'YYYY-MM' → 'M월'
export function formatMonthShort(month) {
  return `${Number(month.split('-')[1])}월`
}
