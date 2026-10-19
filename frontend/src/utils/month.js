// 월은 항상 'YYYY-MM' 문자열로 다룬다 (API 쿼리 형식과 동일).

export function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthLabel(month) {
  const [y, m] = month.split('-')
  return `${y}년 ${Number(m)}월`
}

// 오늘 날짜 'YYYY-MM-DD' (로컬 기준)
export function today() {
  const d = new Date()
  return `${currentMonth()}-${String(d.getDate()).padStart(2, '0')}`
}
