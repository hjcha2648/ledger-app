// 백엔드 없이 화면을 개발하기 위한 인메모리 목 서버.
// 실제 API와 같은 응답 형식·오류 코드(401/404/409/422)를 흉내 낸다. 새로고침하면 초기화된다.
import { ApiError, getToken } from '../client'

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))

const pad = (n) => String(n).padStart(2, '0')

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

const thisMonth = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
})()

// ---------- 저장소 ----------
const SYSTEM_CATEGORIES = [
  ...['식비', '교통', '주거·통신', '쇼핑', '여가·문화', '의료·건강', '교육', '구독·정기결제', '기타지출'].map(
    (name) => ({ name, type: 'EXPENSE' }),
  ),
  ...['급여', '용돈', '부수입', '기타수입'].map((name) => ({ name, type: 'INCOME' })),
].map((c, i) => ({ id: i + 1, user_id: null, ...c }))

const db = {
  nextId: { user: 2, category: 100, transaction: 1, subscription: 1 },
  users: [{ id: 1, email: 'demo@example.com', password: 'demo1234', created_at: '2026-01-01T00:00:00' }],
  categories: [...SYSTEM_CATEGORIES],
  transactions: [],
  subscriptions: [],
}

function seedDemoData() {
  const catId = (name) => SYSTEM_CATEGORIES.find((c) => c.name === name).id
  for (let back = 5; back >= 0; back--) {
    const month = shiftMonth(thisMonth, -back)
    const add = (type, category, day, amount, merchant = null, memo = null) =>
      db.transactions.push({
        id: db.nextId.transaction++,
        user_id: 1,
        type,
        amount_krw: amount,
        occurred_on: `${month}-${pad(day)}`,
        category_id: catId(category),
        merchant,
        memo,
        created_at: `${month}-${pad(day)}T09:00:00`,
        updated_at: `${month}-${pad(day)}T09:00:00`,
      })
    add('INCOME', '급여', 25, 3000000 + back * 20000, '회사')
    if (back % 2 === 0) add('INCOME', '용돈', 10, 100000, null, '부모님')
    add('EXPENSE', '주거·통신', 5, 450000 + back * 3000, '월세/통신비')
    add('EXPENSE', '식비', 8, 42000 + back * 1500, '마트')
    add('EXPENSE', '교통', 8, 4800, '버스') // 캘린더에서 한 날짜에 거래 3건(점 표시 확인용)
    add('EXPENSE', '여가·문화', 8, 12000, '카페')
    if (back === 0) {
      // 이번 달 8일에 거래를 7건으로 늘려 캘린더 점 5개 제한("+N")을 확인할 수 있게 한다
      add('INCOME', '용돈', 8, 20000, null, '친구에게 받음')
      add('EXPENSE', '식비', 8, 3500, '편의점')
      add('EXPENSE', '식비', 8, 6200, '간식')
    }
    add('EXPENSE', '식비', 14, 18500, '점심')
    add('EXPENSE', '식비', 21, 36000 - back * 1000, '저녁 외식')
    add('EXPENSE', '교통', 12, 55000, '교통카드')
    if (back % 3 !== 1) add('EXPENSE', '쇼핑', 17, 89000 + back * 5000, '온라인 쇼핑')
    add('EXPENSE', '여가·문화', 19, 28000, '영화')
  }
  db.subscriptions.push(
    {
      id: db.nextId.subscription++,
      user_id: 1,
      name: '넷플릭스',
      category_id: catId('구독·정기결제'),
      amount_krw: 17000,
      billing_cycle: 'MONTHLY',
      billing_anchor_date: '2026-01-15',
      memo: '프리미엄 요금제',
      created_at: '2026-01-15T00:00:00',
    },
    {
      id: db.nextId.subscription++,
      user_id: 1,
      name: '유튜브 프리미엄',
      category_id: catId('구독·정기결제'),
      amount_krw: 14900,
      billing_cycle: 'MONTHLY',
      billing_anchor_date: '2026-02-03',
      memo: null,
      created_at: '2026-02-03T00:00:00',
    },
  )
}
seedDemoData()

// ---------- 공통 ----------
// 토큰 'mock-<userId>' 에서 사용자 ID를 얻는다 (실서버는 JWT에서 취득).
function currentUserId() {
  const token = getToken()
  const id = token && /^mock-(\d+)$/.exec(token)?.[1]
  if (!id || !db.users.some((u) => u.id === Number(id))) {
    throw new ApiError(401, '인증이 필요합니다.')
  }
  return Number(id)
}

function visibleCategory(userId, categoryId) {
  return db.categories.find((c) => c.id === categoryId && (c.user_id === null || c.user_id === userId))
}

// API 계약: 형식 검증 실패(금액 0, 필수 누락, 잘못된 enum 등)는 422 + 배열 detail 이다.
// 실제 클라이언트는 이를 fields 로 파싱하므로 목 서버도 같은 모양(ApiError.fields)으로 던진다.
const INVALID_INPUT = '입력값을 확인해 주세요.'
function invalid(field) {
  return new ApiError(422, INVALID_INPUT, { [field]: INVALID_INPUT })
}

function checkAmount(v) {
  if (!Number.isInteger(v) || v < 1) throw invalid('amount_krw')
}

function checkDate(v, field) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    throw invalid(field)
  }
}

function checkMonth(v) {
  if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) {
    throw new ApiError(422, 'month 는 YYYY-MM 형식이어야 합니다.')
  }
}

const strip = ({ user_id, ...rest }) => rest // eslint-disable-line no-unused-vars

// 응답 모양: 거래·정기결제에는 category_name 이 포함된다 (API 계약)
const categoryNameOf = (id) => db.categories.find((c) => c.id === id)?.name ?? null
const pubItem = (item) => ({ ...strip(item), category_name: categoryNameOf(item.category_id) })
// 카테고리 응답: { id, name, type, is_default }
const pubCategory = (c) => ({ id: c.id, name: c.name, type: c.type, is_default: c.user_id === null })

// ---------- auth ----------
export const mockAuth = {
  async register({ email, password }) {  // eslint-disable-line no-param-reassign
    await wait()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid('email')
    if (!password || password.length < 8 || password.length > 64) throw invalid('password') // 8~64자
    email = email.toLowerCase() // 이메일은 소문자로 저장
    if (db.users.some((u) => u.email === email)) throw new ApiError(409, '이미 가입된 이메일입니다.')
    const user = { id: db.nextId.user++, email, password, created_at: new Date().toISOString().slice(0, 19) }
    db.users.push(user)
    return { id: user.id, email: user.email, created_at: user.created_at }
  },
  async login({ email, password }) {
    await wait()
    const user = db.users.find((u) => u.email === String(email).toLowerCase() && u.password === password)
    if (!user) throw new ApiError(401, '이메일 또는 비밀번호가 올바르지 않습니다.')
    return { access_token: `mock-${user.id}`, token_type: 'bearer', expires_in: 3600 }
  },
  async me() {
    await wait(100)
    const user = db.users.find((u) => u.id === currentUserId())
    return { id: user.id, email: user.email, created_at: user.created_at }
  },
}

// ---------- categories ----------
export const mockCategories = {
  async list() {
    await wait(150)
    const uid = currentUserId()
    // 정렬: type(EXPENSE → INCOME), id 순
    return db.categories
      .filter((c) => c.user_id === null || c.user_id === uid)
      .sort((a, b) => (a.type === b.type ? a.id - b.id : a.type === 'EXPENSE' ? -1 : 1))
      .map(pubCategory)
  },
  async create({ name, type }) {
    await wait()
    const uid = currentUserId()
    if (!name || name.length > 30) throw invalid('name')
    if (!['INCOME', 'EXPENSE'].includes(type)) throw invalid('type')
    // 같은 유형에 같은 이름(기본 카테고리 포함)이 있으면 409
    if (db.categories.some((c) => c.type === type && c.name === name && (c.user_id === null || c.user_id === uid))) {
      throw new ApiError(409, '이미 존재하는 카테고리입니다.')
    }
    const cat = { id: db.nextId.category++, user_id: uid, name, type }
    db.categories.push(cat)
    return pubCategory(cat)
  },
}

// ---------- transactions ----------
function validateTransaction(uid, body, partial = false) {
  const { type, amount_krw, occurred_on, category_id } = body
  if (!partial || type !== undefined) {
    if (!['INCOME', 'EXPENSE'].includes(type)) throw invalid('type')
  }
  if (!partial || amount_krw !== undefined) checkAmount(amount_krw)
  if (!partial || occurred_on !== undefined) checkDate(occurred_on, 'occurred_on')
  if (!partial || category_id !== undefined) {
    if (!visibleCategory(uid, category_id)) throw new ApiError(422, '사용할 수 없는 카테고리입니다.')
  }
}

export const mockTransactions = {
  async list(month) {
    await wait()
    const uid = currentUserId()
    checkMonth(month)
    return db.transactions
      .filter((t) => t.user_id === uid && t.occurred_on.startsWith(month))
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.id - a.id)
      .map(pubItem)
  },
  async create(body) {
    await wait()
    const uid = currentUserId()
    validateTransaction(uid, body)
    if (visibleCategory(uid, body.category_id).type !== body.type) {
      throw new ApiError(422, '거래 유형과 카테고리 유형이 일치해야 합니다.')
    }
    const now = new Date().toISOString()
    const tx = {
      id: db.nextId.transaction++,
      user_id: uid,
      type: body.type,
      amount_krw: body.amount_krw,
      occurred_on: body.occurred_on,
      category_id: body.category_id,
      merchant: body.merchant || null,
      memo: body.memo || null,
      created_at: now,
      updated_at: now,
    }
    db.transactions.push(tx)
    return pubItem(tx)
  },
  async update(id, body) {
    await wait()
    const uid = currentUserId()
    const tx = db.transactions.find((t) => t.id === id && t.user_id === uid)
    if (!tx) throw new ApiError(404, '거래를 찾을 수 없습니다.')
    validateTransaction(uid, body, true)
    const next = { ...tx, ...body }
    if (visibleCategory(uid, next.category_id).type !== next.type) {
      throw new ApiError(422, '거래 유형과 카테고리 유형이 일치해야 합니다.')
    }
    Object.assign(tx, next, { merchant: next.merchant || null, memo: next.memo || null, updated_at: new Date().toISOString() })
    return pubItem(tx)
  },
  async remove(id) {
    await wait()
    const uid = currentUserId()
    const idx = db.transactions.findIndex((t) => t.id === id && t.user_id === uid)
    if (idx < 0) throw new ApiError(404, '거래를 찾을 수 없습니다.')
    db.transactions.splice(idx, 1)
    return null
  },
}

// ---------- subscriptions ----------
export const mockSubscriptions = {
  async list() {
    await wait()
    const uid = currentUserId()
    return db.subscriptions.filter((s) => s.user_id === uid).sort((a, b) => b.id - a.id).map(pubItem)
  },
  async create(body) {
    await wait()
    const uid = currentUserId()
    if (!body.name || body.name.length > 120) throw invalid('name')
    checkAmount(body.amount_krw)
    if (!['WEEKLY', 'MONTHLY', 'YEARLY'].includes(body.billing_cycle)) {
      throw invalid('billing_cycle')
    }
    checkDate(body.billing_anchor_date, 'billing_anchor_date')
    const cat = visibleCategory(uid, body.category_id)
    if (!cat || cat.type !== 'EXPENSE') throw new ApiError(422, 'EXPENSE 유형의 카테고리만 사용할 수 있습니다.')
    const sub = {
      id: db.nextId.subscription++,
      user_id: uid,
      name: body.name,
      category_id: body.category_id,
      amount_krw: body.amount_krw,
      billing_cycle: body.billing_cycle,
      billing_anchor_date: body.billing_anchor_date,
      memo: body.memo || null,
      created_at: new Date().toISOString(),
    }
    db.subscriptions.push(sub)
    return pubItem(sub)
  },
  async remove(id) {
    await wait()
    const uid = currentUserId()
    const idx = db.subscriptions.findIndex((s) => s.id === id && s.user_id === uid)
    if (idx < 0) throw new ApiError(404, '정기결제를 찾을 수 없습니다.')
    db.subscriptions.splice(idx, 1)
    return null
  },
}

// ---------- dashboard (transactions만 집계, 정기결제 제외) ----------
export const mockDashboard = {
  async get(month) {
    await wait()
    const uid = currentUserId()
    checkMonth(month)
    const mine = db.transactions.filter((t) => t.user_id === uid)
    const sum = (list, type) => list.filter((t) => t.type === type).reduce((s, t) => s + t.amount_krw, 0)

    const inMonth = mine.filter((t) => t.occurred_on.startsWith(month))
    const income = sum(inMonth, 'INCOME')
    const expense = sum(inMonth, 'EXPENSE')

    const byCat = new Map()
    inMonth
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + t.amount_krw))
    const expense_by_category = [...byCat.entries()]
      .map(([category_id, amount_krw]) => ({
        category_id,
        name: db.categories.find((c) => c.id === category_id).name,
        amount_krw,
      }))
      .sort((a, b) => b.amount_krw - a.amount_krw)

    // 선택 월을 마지막으로 하는 최근 6개월, 오래된 달 → 최신 달 순
    const monthly_compare = Array.from({ length: 6 }, (_, i) => {
      const m = shiftMonth(month, i - 5)
      const list = mine.filter((t) => t.occurred_on.startsWith(m))
      return { month: m, income_krw: sum(list, 'INCOME'), expense_krw: sum(list, 'EXPENSE') }
    })

    return {
      month,
      summary: { income_krw: income, expense_krw: expense, balance_krw: income - expense },
      expense_by_category,
      monthly_compare,
    }
  },
}

// ---------- chat (POST /api/chat 목: 선택 월 데이터로 간단한 일반 텍스트 답변. 줄바꿈과 "- " 목록 포함) ----------
const won = (n) => `${new Intl.NumberFormat('ko-KR').format(n)}원`
const CYCLE_KO = { WEEKLY: '매주', MONTHLY: '매월', YEARLY: '매년' }

export const mockChat = {
  async send({ month, messages }) {
    await wait(900)
    const uid = currentUserId()
    checkMonth(month)
    const list = Array.isArray(messages) ? messages : []
    const bad = list.length < 1 || list.length > 10 || list.at(-1)?.role !== 'user' || list.some((m) => !String(m.content ?? '').trim() || m.content.length > 1000)
    if (bad) throw invalid('messages')

    const q = list.at(-1).content
    const label = `${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월`
    const cur = await mockDashboard.get(month)

    if (/절약|팁|대안/.test(q)) {
      // 선택 월 포함 최근 3개월 기록으로 지출이 늘어난 항목을 짚고 일반적인 절약 팁을 준다
      const months = [shiftMonth(month, -2), shiftMonth(month, -1), month]
      const dashes = await Promise.all(months.map((m) => mockDashboard.get(m)))
      const total = dashes.reduce((a, d) => a + d.summary.expense_krw, 0)
      if (total === 0) return { reply: `최근 3개월(${months[0]} ~ ${month})에 지출 기록이 없어서 팁을 드리기 어려워요. 거래를 먼저 기록해 보세요.` }
      const amountOf = (d, name) => d.expense_by_category.find((c) => c.name === name)?.amount_krw ?? 0
      const names = [...new Set(dashes.flatMap((d) => d.expense_by_category.map((c) => c.name)))]
      const rows = names.map((name) => ({ name, first: amountOf(dashes[0], name), last: amountOf(dashes[2], name), sum: dashes.reduce((a, d) => a + amountOf(d, name), 0) }))
      const top = [...rows].sort((a, b) => b.sum - a.sum)[0]
      const up = [...rows].sort((a, b) => b.last - b.first - (a.last - a.first))[0]
      const lines = ['■ 최근 3개월 동향', `최근 3개월 지출은 월평균 ${won(Math.round(total / 3))}이에요. 가장 비중이 큰 카테고리는 ${top.name}(3개월 ${won(top.sum)})입니다.`]
      if (up && up.last > up.first) lines.push(`${up.name}은(는) ${won(up.first)}에서 ${won(up.last)}으로 늘었어요.`)
      lines.push('', '■ 절약 팁과 대안')
      lines.push(`- ${top.name}: 한 달 상한을 정해 두고 주 단위로 쓴 금액을 확인해 보세요.`)
      if (up && up.last > up.first && up.name !== top.name) lines.push(`- ${up.name}: 늘어난 이유(충동구매·반복 지출)를 거래 메모로 확인하고 횟수를 줄여 보세요.`)
      lines.push('- 쓰지 않는 정기결제는 해지하거나 더 저렴한 요금제로 바꿔 보세요.')
      return { reply: lines.join('\n') }
    }
    if (/정기|구독/.test(q)) {
      const subs = db.subscriptions.filter((s) => s.user_id === uid)
      if (!subs.length) return { reply: '등록된 정기결제가 없어요.' }
      const lines = subs.map((s) => `- ${s.name}: ${CYCLE_KO[s.billing_cycle]} ${won(s.amount_krw)}`)
      const top = [...subs].sort((a, b) => b.amount_krw - a.amount_krw)[0]
      return { reply: `정기결제는 ${subs.length}개예요.\n${lines.join('\n')}\n금액이 가장 큰 건 ${top.name}(${won(top.amount_krw)})입니다.` }
    }
    if (/지난달|저번|전월|비교|늘었|줄었/.test(q)) {
      const prev = await mockDashboard.get(shiftMonth(month, -1))
      const diff = cur.summary.expense_krw - prev.summary.expense_krw
      return { reply: `${label} 지출은 ${won(cur.summary.expense_krw)}으로 지난달(${won(prev.summary.expense_krw)})보다 ${won(Math.abs(diff))} ${diff >= 0 ? '늘었어요' : '줄었어요'}.` }
    }
    if (/카테고리|많이|가장/.test(q)) {
      const top = cur.expense_by_category.slice(0, 3)
      if (!top.length) return { reply: `${label}에는 지출 내역이 없어요.` }
      return { reply: `${label}에 가장 많이 쓴 카테고리예요.\n${top.map((c) => `- ${c.name}: ${won(c.amount_krw)}`).join('\n')}` }
    }
    return {
      reply: `${label} 요약이에요.\n- 수입: ${won(cur.summary.income_krw)}\n- 지출: ${won(cur.summary.expense_krw)}\n- 잔액: ${won(cur.summary.balance_krw)}`,
    }
  },
}

// ---------- receipts (POST /api/receipts/analyze 목: 파일 내용은 읽지 않고 샘플 초안을 돌려준다. 저장하지 않음) ----------
export const mockReceipts = {
  async analyze(file) {
    await wait(1500)
    currentUserId()
    if (!(file instanceof File)) throw new ApiError(422, '입력값을 확인해 주세요.')
    if (file.size > 5 * 1024 * 1024) throw new ApiError(413, '파일은 5MB 이하만 올릴 수 있습니다.')
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) {
      throw new ApiError(422, 'JPEG·PNG·WEBP 이미지 또는 PDF 파일만 올릴 수 있습니다.')
    }
    const catId = (name) => db.categories.find((c) => c.user_id === null && c.name === name)?.id ?? null
    const day = (back) => {
      const d = new Date()
      d.setDate(d.getDate() - back)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    const pick = (name, extra) => ({ type: 'EXPENSE', category_id: catId(name), category_name: name, ...extra })
    const items = file.type === 'application/pdf'
      ? [
          pick('식비', { amount_krw: 20300, occurred_on: day(2), merchant: '스타벅스 강남역점', memo: '아메리카노 외 2건' }),
          pick('교통', { amount_krw: 1500, occurred_on: day(3), merchant: '서울교통공사', memo: null }),
          { type: 'EXPENSE', amount_krw: 48900, occurred_on: null, merchant: '온라인 쇼핑몰', memo: null, category_id: null, category_name: null },
        ]
      : [pick('식비', { amount_krw: 20300, occurred_on: day(1), merchant: '스타벅스 강남역점', memo: '아메리카노 외 2건' })]
    const warnings = file.type === 'application/pdf' ? ['10/11 쿠팡 결제취소(-38,900원) 건은 제외했습니다.'] : []
    return { items, warnings }
  },
}

// ---------- reports (명세서 메일 목: 실제 발송 없음. 인증 요청 → pending → 다음 상태 조회 때 verified 로 가정) ----------
const emailState = {} // userId → 'unverified' | 'pending' | 'verified'
const lastMailAt = {} // userId → 마지막 발송 시각(ms), 5분 제한
const maskEmail = (email) => `${email.slice(0, 1)}***@${email.split('@')[1]}`
const emailOf = (uid) => db.users.find((u) => u.id === uid).email

export const mockReports = {
  async status() {
    await wait()
    const uid = currentUserId()
    if (emailState[uid] === 'pending') emailState[uid] = 'verified' // 링크를 눌렀다고 가정
    return { email: maskEmail(emailOf(uid)), status: emailState[uid] ?? 'unverified' }
  },
  async requestVerification() {
    await wait()
    const uid = currentUserId()
    if (!emailState[uid] || emailState[uid] === 'unverified') emailState[uid] = 'pending'
    return { email: maskEmail(emailOf(uid)), status: emailState[uid] }
  },
  async sendMonthly({ month }) {
    await wait(600)
    const uid = currentUserId()
    checkMonth(month)
    if (emailState[uid] !== 'verified') {
      throw new ApiError(409, '받는 메일 주소 인증이 필요합니다. 메일 인증을 먼저 완료하세요.')
    }
    if (lastMailAt[uid] && Date.now() - lastMailAt[uid] < 5 * 60 * 1000) {
      throw new ApiError(429, '명세서 메일은 5분 뒤에 다시 보낼 수 있습니다.')
    }
    lastMailAt[uid] = Date.now()
    return { sent_to: maskEmail(emailOf(uid)) }
  },
}
