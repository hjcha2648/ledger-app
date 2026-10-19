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
