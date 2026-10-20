// 모든 API 호출이 거치는 fetch 래퍼.
// - 항상 상대경로 /api/... 사용 (개발: Vite 프록시, 배포: CloudFront /api/*)
// - 토큰은 sessionStorage에 보관 (탭을 닫으면 로그아웃)

const TOKEN_KEY = 'ledger_token'

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* 저장소 사용 불가 시 메모리 상태만 사용 */
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* noop */
  }
}

let unauthorizedHandler = null

// AuthContext가 등록한다. 401 응답 시 호출되어 로그아웃 처리.
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

export class ApiError extends Error {
  // fields: 422 형식 검증 오류의 필드별 메시지 { 서버필드명: 메시지 } (없으면 null)
  constructor(status, message, fields = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

const INVALID_INPUT = '입력값을 확인해 주세요.'

// API 계약(docs/api-contract.md): detail 은 문자열 또는 배열이다.
// - 문자열: 그대로 표시
// - 배열(422 형식 검증): loc 의 마지막 값(필드명)을 모아 fields 로 돌려주고, 메시지는 "입력값을 확인해 주세요."
function parseDetail(detail) {
  if (typeof detail === 'string') return { message: detail, fields: null }
  if (Array.isArray(detail)) {
    const fields = {}
    detail.forEach((d) => {
      const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null
      if (typeof field === 'string') fields[field] = INVALID_INPUT
    })
    return { message: INVALID_INPUT, fields: Object.keys(fields).length ? fields : null }
  }
  return { message: '요청을 처리하지 못했습니다.', fields: null }
}

function buildQuery(params) {
  if (!params) return ''
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v)
  })
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function request(method, path, { params, body } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  // FormData(파일 업로드)는 Content-Type 을 직접 넣지 않는다 — 브라우저가 boundary 를 포함해 설정한다
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(`/api${path}${buildQuery(params)}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없습니다.')
  }

  if (res.status === 204) return null

  let data = null
  try {
    data = await res.json()
  } catch {
    /* JSON이 아닌 응답 */
  }

  if (!res.ok) {
    // 토큰이 있는 상태의 401만 세션 만료로 처리 (로그인 실패 401과 구분)
    if (res.status === 401 && token && unauthorizedHandler) unauthorizedHandler()
    const { message, fields } = parseDetail(data?.detail)
    throw new ApiError(res.status, message, fields)
  }
  return data
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  upload: (path, formData) => request('POST', path, { body: formData }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
}
