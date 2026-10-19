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
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// FastAPI 오류 {"detail": "문자열"} 또는 422의 [{loc, msg}, ...] 를 문자열로 변환
function parseDetail(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null
        return field ? `${field}: ${d.msg}` : d.msg
      })
      .join('\n')
  }
  return '요청을 처리하지 못했습니다.'
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
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(`/api${path}${buildQuery(params)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
    throw new ApiError(res.status, parseDetail(data?.detail))
  }
  return data
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
}
