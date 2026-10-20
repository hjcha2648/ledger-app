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

// ───────────── 달력 계산 (순수 함수) ─────────────
// 날짜는 'YYYY-MM-DD' 문자열을 그대로 키로 쓴다. 요일·말일 계산만 new Date(년, 월-1, 일) 로 하며
// 문자열 파싱(new Date('YYYY-MM-DD'), UTC 해석)을 쓰지 않아 타임존 때문에 하루가 밀리지 않는다.
const pad2 = (n) => String(n).padStart(2, '0')

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 'YYYY-MM' → 그 달의 일수 (윤년 반영)
export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// 'YYYY-MM-DD' → 요일 (0=일 … 6=토)
export function weekdayOf(date) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

// 일요일 시작 월 달력 격자: 앞뒤를 인접 달 날짜로 채워 7의 배수(최대 6주)로 만든다.
// → [{ date: 'YYYY-MM-DD', day: 숫자, inMonth: boolean, weekday: 0~6 }]
export function buildMonthGrid(month) {
  const lead = weekdayOf(`${month}-01`)
  const total = daysInMonth(month)
  const prev = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)
  const prevTotal = daysInMonth(prev)

  const cells = []
  for (let i = 0; i < lead; i++) {
    const day = prevTotal - lead + 1 + i
    cells.push({ date: `${prev}-${pad2(day)}`, day, inMonth: false })
  }
  for (let day = 1; day <= total; day++) cells.push({ date: `${month}-${pad2(day)}`, day, inMonth: true })
  for (let day = 1; cells.length % 7 !== 0; day++) cells.push({ date: `${next}-${pad2(day)}`, day, inMonth: false })
  return cells.map((c, i) => ({ ...c, weekday: i % 7 }))
}

// 'YYYY-MM-DD' → '10월 5일'
export function formatMonthDay(date) {
  const [, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일`
}

// 'YYYY-MM-DD' → '10월 5일 (토)'
export function formatDayLabel(date) {
  return `${formatMonthDay(date)} (${WEEKDAYS[weekdayOf(date)]})`
}
