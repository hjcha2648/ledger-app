#!/usr/bin/env bash
# 백엔드 스모크 테스트: 핵심 API 흐름과 사용자 격리를 curl로 검증한다.
#
# 사용법:
#   ./scripts/smoke.sh                                  # 로컬 (http://localhost:8000)
#   ./scripts/smoke.sh http://127.0.0.1:8000            # EC2 내부
#   ./scripts/smoke.sh https://xxxx.cloudfront.net      # CloudFront 경유
#
# 필요: curl, python3 (JSON 파싱용)
# 실행할 때마다 smoke-<시각>-a/b@example.com 테스트 계정 2개를 새로 만든다.
# 만든 거래·정기결제는 마지막에 삭제하지만, 계정·개인 카테고리는 삭제 API가 없어 남는다.

set -u

BASE="${1:-http://localhost:8000}"
BASE="${BASE%/}"
API="$BASE/api"
RUN_ID="$(date +%Y%m%d%H%M%S)"
EMAIL_A="smoke-$RUN_ID-a@example.com"
EMAIL_B="smoke-$RUN_ID-b@example.com"
PASSWORD="smoke-password-123"
MONTH="2026-02"

PASS=0
FAIL=0
BODY=""
CODE=""
CTYPE=""

# req METHOD PATH [TOKEN] [JSON]  → BODY, CODE, CTYPE 설정
req() {
  local method="$1" path="$2" token="${3:-}" data="${4:-}"
  # 마지막 줄에 "상태코드 content-type"을 붙여 받는다 (204처럼 본문이 비어도 위치가 고정되도록 한 줄로)
  local args=(-s -X "$method" "$API$path" -w $'\n%{http_code} %{content_type}' --max-time 15)
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ] && args+=(-H "Content-Type: application/json" -d "$data")
  local out last
  out="$(curl "${args[@]}")" || { BODY=""; CODE="000"; CTYPE=""; return; }
  last="$(printf '%s' "$out" | tail -n 1)"
  CODE="${last%% *}"
  CTYPE="${last#* }"
  BODY="$(printf '%s' "$out" | head -n -1)"
}

# jget '<python 식, d = 응답 JSON>'  예: jget 'd["id"]'
jget() {
  printf '%s' "$BODY" | python3 -c "import sys,json
try:
    d=json.load(sys.stdin); print($1)
except Exception:
    print('<parse-error>')"
}

check() {  # check 이름 실제값 기대값
  if [ "$2" = "$3" ]; then
    PASS=$((PASS + 1)); printf '  \033[32mPASS\033[0m %s\n' "$1"
  else
    FAIL=$((FAIL + 1)); printf '  \033[31mFAIL\033[0m %s (got: %s, want: %s)\n' "$1" "$2" "$3"
  fi
}

section() { printf '\n[%s]\n' "$1"; }

echo "Smoke test → $API"

# ---------------------------------------------------------------- 헬스
section "health"
req GET /health
check "GET /health 200" "$CODE" 200
check "db ok" "$(jget 'd.get("db")')" ok
if [ "$CODE" != 200 ]; then
  echo "서버에 연결할 수 없어 중단합니다. (주소/서비스 상태 확인)"; exit 1
fi

req GET /does-not-exist
check "없는 /api 경로 404" "$CODE" 404
check "404가 JSON으로 응답 (index.html 치환 아님)" "${CTYPE%%;*}" application/json

# ---------------------------------------------------------------- 인증
section "auth"
req POST /auth/register "" "{\"email\":\"$EMAIL_A\",\"password\":\"$PASSWORD\"}"
check "회원가입 A 201" "$CODE" 201
req POST /auth/register "" "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD\"}"
check "회원가입 B 201" "$CODE" 201
req POST /auth/register "" "{\"email\":\"$EMAIL_A\",\"password\":\"$PASSWORD\"}"
check "중복 가입 409" "$CODE" 409

req POST /auth/login "" "{\"email\":\"$EMAIL_A\",\"password\":\"wrong-password\"}"
check "틀린 비밀번호 401" "$CODE" 401
req POST /auth/login "" "{\"email\":\"$EMAIL_A\",\"password\":\"$PASSWORD\"}"
check "로그인 A 200" "$CODE" 200
TOKEN_A="$(jget 'd["access_token"]')"
req POST /auth/login "" "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD\"}"
TOKEN_B="$(jget 'd["access_token"]')"

req GET /auth/me "$TOKEN_A"
check "/auth/me 200" "$CODE" 200
check "/auth/me 이메일 일치" "$(jget 'd["email"]')" "$EMAIL_A"
req GET /auth/me
check "토큰 없이 401" "$CODE" 401
req GET /auth/me "${TOKEN_A}tampered"
check "위조 토큰 401" "$CODE" 401

# ---------------------------------------------------------------- 카테고리
section "categories"
req GET /categories "$TOKEN_A"
check "카테고리 조회 200" "$CODE" 200
check "기본 카테고리 13개" "$(jget 'sum(c["is_default"] for c in d)')" 13
FOOD="$(jget '[c["id"] for c in d if c["name"]=="식비"][0]')"
SALARY="$(jget '[c["id"] for c in d if c["name"]=="급여"][0]')"
SUBCAT="$(jget '[c["id"] for c in d if c["name"]=="구독·정기결제"][0]')"

req POST /categories "$TOKEN_A" '{"name":"스모크전용","type":"EXPENSE"}'
check "개인 카테고리 추가 201" "$CODE" 201
MYCAT="$(jget 'd["id"]')"
req POST /categories "$TOKEN_A" '{"name":"스모크전용","type":"EXPENSE"}'
check "개인 카테고리 중복 409" "$CODE" 409
req GET /categories "$TOKEN_B"
check "B에게 A의 개인 카테고리 안 보임" "$(jget "any(c['id']==$MYCAT for c in d)")" False

# ---------------------------------------------------------------- 거래
section "transactions"
req POST /transactions "$TOKEN_A" "{\"type\":\"INCOME\",\"amount_krw\":3000000,\"occurred_on\":\"$MONTH-01\",\"category_id\":$SALARY}"
check "수입 등록 201" "$CODE" 201
TX_INCOME="$(jget 'd["id"]')"
req POST /transactions "$TOKEN_A" "{\"type\":\"EXPENSE\",\"amount_krw\":12000,\"occurred_on\":\"$MONTH-28\",\"category_id\":$FOOD,\"merchant\":\"스모크식당\"}"
check "지출 등록 201" "$CODE" 201
TX_EXPENSE="$(jget 'd["id"]')"
req POST /transactions "$TOKEN_A" "{\"type\":\"EXPENSE\",\"amount_krw\":8000,\"occurred_on\":\"$MONTH-15\",\"category_id\":$MYCAT}"
check "개인 카테고리로 지출 등록 201" "$CODE" 201
TX_MYCAT="$(jget 'd["id"]')"

req POST /transactions "$TOKEN_A" "{\"type\":\"INCOME\",\"amount_krw\":1000,\"occurred_on\":\"$MONTH-01\",\"category_id\":$FOOD}"
check "유형-카테고리 불일치 422" "$CODE" 422
req POST /transactions "$TOKEN_A" "{\"type\":\"EXPENSE\",\"amount_krw\":0,\"occurred_on\":\"$MONTH-01\",\"category_id\":$FOOD}"
check "금액 0 → 422" "$CODE" 422
req POST /transactions "$TOKEN_B" "{\"type\":\"EXPENSE\",\"amount_krw\":1000,\"occurred_on\":\"$MONTH-01\",\"category_id\":$MYCAT}"
check "B가 A의 개인 카테고리 사용 422" "$CODE" 422
req GET "/transactions?month=2026-13" "$TOKEN_A"
check "잘못된 month 422" "$CODE" 422

req GET "/transactions?month=$MONTH" "$TOKEN_A"
check "월별 조회 3건" "$(jget 'len(d)')" 3

req PATCH "/transactions/$TX_EXPENSE" "$TOKEN_A" '{"amount_krw":15000}'
check "거래 수정 200" "$CODE" 200
check "수정 금액 반영" "$(jget 'd["amount_krw"]')" 15000

req PATCH "/transactions/$TX_EXPENSE" "$TOKEN_B" '{"amount_krw":1}'
check "B가 A 거래 수정 404" "$CODE" 404
req DELETE "/transactions/$TX_EXPENSE" "$TOKEN_B"
check "B가 A 거래 삭제 404" "$CODE" 404
req GET "/transactions?month=$MONTH" "$TOKEN_B"
check "B 거래 목록 0건" "$(jget 'len(d)')" 0

# ---------------------------------------------------------------- 정기결제
section "subscriptions"
req POST /subscriptions "$TOKEN_A" "{\"name\":\"스모크플릭스\",\"amount_krw\":17000,\"billing_cycle\":\"MONTHLY\",\"billing_anchor_date\":\"$MONTH-05\",\"category_id\":$SUBCAT}"
check "정기결제 등록 201" "$CODE" 201
SUB_ID="$(jget 'd["id"]')"
req POST /subscriptions "$TOKEN_A" "{\"name\":\"x\",\"amount_krw\":1000,\"billing_cycle\":\"MONTHLY\",\"billing_anchor_date\":\"$MONTH-05\",\"category_id\":$SALARY}"
check "수입 카테고리로 정기결제 422" "$CODE" 422
req GET /subscriptions "$TOKEN_A"
check "정기결제 목록 1건" "$(jget 'len(d)')" 1
req GET /subscriptions "$TOKEN_B"
check "B 정기결제 목록 0건" "$(jget 'len(d)')" 0
req DELETE "/subscriptions/$SUB_ID" "$TOKEN_B"
check "B가 A 정기결제 삭제 404" "$CODE" 404
req GET "/transactions?month=$MONTH" "$TOKEN_A"
check "정기결제 등록 후에도 거래 3건 그대로" "$(jget 'len(d)')" 3

# ---------------------------------------------------------------- 대시보드
section "dashboard"
req GET "/dashboard?month=$MONTH" "$TOKEN_A"
check "대시보드 200" "$CODE" 200
check "수입 합계" "$(jget 'd["summary"]["income_krw"]')" 3000000
check "지출 합계 (정기결제 미포함)" "$(jget 'd["summary"]["expense_krw"]')" 23000
check "잔액" "$(jget 'd["summary"]["balance_krw"]')" 2977000
check "원형 차트 합 = 지출" "$(jget 'sum(c["amount_krw"] for c in d["expense_by_category"])')" 23000
check "막대 차트 6개월" "$(jget 'len(d["monthly_compare"])')" 6
check "막대 마지막 달 = 선택 월" "$(jget 'd["monthly_compare"][-1]["month"]')" "$MONTH"
req GET "/dashboard?month=$MONTH" "$TOKEN_B"
check "B 대시보드 지출 0" "$(jget 'd["summary"]["expense_krw"]')" 0

# ---------------------------------------------------------------- 챗봇 (모델 호출 없이 인증·검증만, 비용 0)
section "chat"
req POST "/chat" "" '{"month":"'"$MONTH"'","messages":[{"role":"user","content":"hi"}]}'
check "챗봇 토큰 없이 401" "$CODE" 401
req POST "/chat" "$TOKEN_A" '{"month":"'"$MONTH"'","messages":[{"role":"assistant","content":"hi"}]}'
check "챗봇 마지막 메시지 assistant → 422" "$CODE" 422

# ---------------------------------------------------------------- 명세서 메일 (실제 발송 없이 인증·검증만)
section "reports"
req POST "/reports/monthly-email" "" '{"month":"'"$MONTH"'"}'
check "명세서 메일 토큰 없이 401" "$CODE" 401
req POST "/reports/monthly-email" "$TOKEN_A" '{}'
check "명세서 메일 month 누락 422" "$CODE" 422
req GET "/reports/email-status" ""
check "메일 인증 상태 토큰 없이 401" "$CODE" 401

# ---------------------------------------------------------------- 정리
section "cleanup"
req DELETE "/subscriptions/$SUB_ID" "$TOKEN_A"
check "정기결제 삭제 204" "$CODE" 204
req GET "/transactions?month=$MONTH" "$TOKEN_A"
check "정기결제 삭제 후에도 거래 3건 그대로" "$(jget 'len(d)')" 3
for id in "$TX_INCOME" "$TX_EXPENSE" "$TX_MYCAT"; do
  req DELETE "/transactions/$id" "$TOKEN_A"
  check "거래 $id 삭제 204" "$CODE" 204
done
req DELETE "/transactions/$TX_INCOME" "$TOKEN_A"
check "삭제된 거래 재삭제 404" "$CODE" 404

# ---------------------------------------------------------------- 결과
printf '\n결과: \033[32m%d passed\033[0m, ' "$PASS"
if [ "$FAIL" -eq 0 ]; then
  printf '0 failed\n'
else
  printf '\033[31m%d failed\033[0m\n' "$FAIL"
fi
echo "남은 테스트 계정: $EMAIL_A, $EMAIL_B (삭제 API 없음)"
[ "$FAIL" -eq 0 ]
