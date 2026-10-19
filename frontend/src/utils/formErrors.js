// 서버(422)가 돌려준 필드별 오류를 폼 입력칸 이름으로 바꾼다.
// map: { 서버필드명: 폼필드명 } — 이름이 같으면 생략 가능
export function fieldErrorsFrom(err, map = {}) {
  const out = {}
  if (!err?.fields) return out
  Object.entries(err.fields).forEach(([serverName, message]) => {
    out[map[serverName] ?? serverName] = message
  })
  return out
}
