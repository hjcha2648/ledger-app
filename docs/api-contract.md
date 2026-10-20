# API 계약 (백엔드 구현 기준, 실제 응답에서 발췌)

> 이 문서는 `backend/`의 실제 동작과 일치한다. 프론트엔드는 이 문서의 필드명·형식을 그대로 사용한다.
> 로컬 Swagger: http://localhost:8000/api/docs

## 공통

- Base path: `/api` (프론트는 상대 경로로 호출)
- 인증: `Authorization: Bearer <access_token>` — `health`, `register`, `login` 외 모든 API 필수
- Content-Type: `application/json`
- 날짜 `"YYYY-MM-DD"`, 월 `"YYYY-MM"`, 금액은 정수(원) — 필드명 `*_krw`
- 일시(`created_at`, `updated_at`)는 **UTC**, 시간대 표기 없이 `"2026-10-19T06:02:23"` 형태
- 목록은 배열 그대로 반환 (페이지네이션·래핑 없음)
- `type`: `"INCOME"` | `"EXPENSE"`, `billing_cycle`: `"WEEKLY"` | `"MONTHLY"` | `"YEARLY"`
- 값이 없는 선택 필드(`merchant`, `memo`)는 `null`

## 오류 형식

항상 `{"detail": ...}`. **`detail`은 문자열 또는 배열**이다.

| 코드 | 의미 | detail |
|---|---|---|
| 401 | 토큰 없음·만료·위조, 로그인 실패 | 문자열 |
| 404 | 자원 없음 **또는 다른 사용자 자원** | 문자열 |
| 409 | 이메일 중복, 카테고리 중복 | 문자열 |
| 422 | 서버 검증 실패 (카테고리 유형 불일치, 월 형식 등) | **문자열** |
| 422 | 형식 검증 실패 (금액 0, 필수 필드 누락, 잘못된 enum 등) | **배열** |
| 500 | 서버 오류 | 문자열 |

```json
{"detail": "INCOME 유형의 카테고리만 사용할 수 있습니다."}
```

```json
{"detail": [{"type": "greater_than_equal", "loc": ["body", "amount_krw"], "msg": "Input should be greater than or equal to 1", "input": 0, "ctx": {"ge": 1}}]}
```

프론트 처리 권장: `typeof detail === "string"`이면 그대로 표시, 배열이면 `loc`의 마지막 값(필드명)으로 해당 입력칸에 "입력값을 확인해주세요" 표시.

---

## 인증

### POST `/api/auth/register` — 회원가입

요청 (`password` 8~64자):
```json
{"email": "user@example.com", "password": "password123"}
```
응답 `201`:
```json
{"id": 20, "email": "user@example.com", "created_at": "2026-10-19T06:02:22"}
```
- 이메일은 소문자로 저장. 중복 시 `409`, 형식 오류 `422`
- 가입 후 토큰은 발급되지 않음 → 로그인 API를 이어서 호출

### POST `/api/auth/login` — 로그인

요청 (JSON, form 아님):
```json
{"email": "user@example.com", "password": "password123"}
```
응답 `200`:
```json
{"access_token": "eyJhbGciOi...", "token_type": "bearer", "expires_in": 3600}
```
- 실패 시 `401 {"detail": "이메일 또는 비밀번호가 올바르지 않습니다."}`
- 토큰 유효기간 60분, 리프레시 토큰 없음. **어떤 API든 401을 받으면 토큰 삭제 후 `/login`으로 이동**
- 로그아웃 API 없음 (클라이언트에서 토큰 삭제)

### GET `/api/auth/me` — 현재 사용자

응답 `200`: `{"id": 20, "email": "user@example.com", "created_at": "2026-10-19T06:02:22"}`

### GET `/api/health` — 서버 상태 (인증 불필요)

응답 `200 {"status": "ok", "db": "ok"}` / DB 실패 시 `503 {"status": "error", "db": "error"}`

---

## 카테고리

### GET `/api/categories`

시스템 기본 13개 + 내 개인 카테고리. 정렬: `type`(EXPENSE → INCOME), `id` 순.
```json
[
  {"id": 1, "name": "식비", "type": "EXPENSE", "is_default": true},
  {"id": 2, "name": "교통", "type": "EXPENSE", "is_default": true},
  {"id": 13, "name": "기타수입", "type": "INCOME", "is_default": true}
]
```
- 기본 지출: 식비, 교통, 주거·통신, 쇼핑, 여가·문화, 의료·건강, 교육, 구독·정기결제, 기타지출
- 기본 수입: 급여, 용돈, 부수입, 기타수입
- **id 값을 하드코딩하지 말고** 이 API 결과에서 찾아 쓸 것
- 거래 폼에서는 선택한 `type`과 같은 카테고리만 보여줄 것

### POST `/api/categories` — 개인 카테고리 추가

요청 (`name` 1~30자): `{"name": "반려동물", "type": "EXPENSE"}`
응답 `201`: `{"id": 14, "name": "반려동물", "type": "EXPENSE", "is_default": false}`
- 같은 유형에 같은 이름(기본 포함)이 있으면 `409`
- 카테고리 수정·삭제 API 없음

---

## 거래

### GET `/api/transactions?month=YYYY-MM`

`month` 필수. 정렬: 거래일 최신순 → id 최신순. 필터·검색 파라미터 없음.

```json
[
  {
    "id": 537,
    "type": "EXPENSE",
    "amount_krw": 12000,
    "occurred_on": "2026-10-05",
    "category_id": 1,
    "category_name": "식비",
    "merchant": "김밥천국",
    "memo": null,
    "created_at": "2026-10-19T06:02:23",
    "updated_at": "2026-10-19T06:02:23"
  }
]
```
- 잘못된 월(`2026-13`, `2026-1`, 누락) → `422`

### POST `/api/transactions` — 등록

```json
{
  "type": "EXPENSE",
  "amount_krw": 12000,
  "occurred_on": "2026-10-05",
  "category_id": 1,
  "merchant": "김밥천국",
  "memo": null
}
```
- 필수: `type`, `amount_krw`(1 이상 정수), `occurred_on`, `category_id`
- 선택: `merchant`(≤100자), `memo`(≤500자) — 빈 문자열은 `null`로 저장됨
- `type`과 카테고리 유형이 다르면 `422`
- 응답 `201`: 위 목록 항목과 같은 형태

### PATCH `/api/transactions/{id}` — 수정

**바꿀 필드만** 보낸다. 예: `{"amount_krw": 15000}`
- `merchant`/`memo`를 지우려면 `null` 전송
- `type`을 바꿀 때는 맞는 `category_id`도 함께 보내야 함 (불일치 시 `422`)
- 응답 `200`: 수정된 거래 객체. 다른 사용자 거래면 `404`

### DELETE `/api/transactions/{id}` — 삭제

응답 `204` (본문 없음 → `res.json()` 호출 금지)

---

## 정기결제 (목록 관리만)

> 등록·조회·삭제만 있다. **수정 API 없음**, 거래를 자동으로 만들지 않음, 대시보드 합계에 포함되지 않음.

### GET `/api/subscriptions`

정렬: 최근 등록순.
```json
[
  {
    "id": 20,
    "name": "넷플릭스",
    "amount_krw": 17000,
    "billing_cycle": "MONTHLY",
    "billing_anchor_date": "2026-10-15",
    "category_id": 8,
    "category_name": "구독·정기결제",
    "memo": null,
    "created_at": "2026-10-19T06:02:23"
  }
]
```

### POST `/api/subscriptions` — 등록

```json
{
  "name": "넷플릭스",
  "amount_krw": 17000,
  "billing_cycle": "MONTHLY",
  "billing_anchor_date": "2026-10-15",
  "category_id": 8,
  "memo": null
}
```
- 필수: `name`(1~120자), `amount_krw`, `billing_cycle`, `billing_anchor_date`, `category_id`
- **카테고리는 EXPENSE 유형만** (INCOME이면 `422`) — 폼에는 지출 카테고리만 표시, 기본 선택은 "구독·정기결제" 권장
- 응답 `201`: 위 목록 항목과 같은 형태

### DELETE `/api/subscriptions/{id}` — 삭제

응답 `204` (본문 없음). 기존 거래에는 영향 없음.

---

## 대시보드

### GET `/api/dashboard?month=YYYY-MM`

`transactions`에 직접 입력한 수입·지출만 집계.

```json
{
  "month": "2026-02",
  "summary": {"income_krw": 3000000, "expense_krw": 395000, "balance_krw": 2605000},
  "expense_by_category": [
    {"category_id": 4, "name": "쇼핑", "amount_krw": 200000},
    {"category_id": 1, "name": "식비", "amount_krw": 150000},
    {"category_id": 2, "name": "교통", "amount_krw": 45000}
  ],
  "monthly_compare": [
    {"month": "2025-09", "income_krw": 100000, "expense_krw": 0},
    {"month": "2025-10", "income_krw": 0, "expense_krw": 0},
    {"month": "2025-11", "income_krw": 0, "expense_krw": 0},
    {"month": "2025-12", "income_krw": 0, "expense_krw": 20000},
    {"month": "2026-01", "income_krw": 0, "expense_krw": 5000},
    {"month": "2026-02", "income_krw": 3000000, "expense_krw": 395000}
  ]
}
```
- `summary` → 요약 카드 3개 (`balance_krw`는 음수 가능)
- `expense_by_category` → 원형 차트. 금액 큰 순, 지출 0원 카테고리는 없음, **빈 배열 가능** (빈 상태 UI 필요)
- `monthly_compare` → 막대 차트. **항상 6개**, 오래된 달 → 선택 월 순, 거래 없는 달은 0

---

## AI 챗봇 ([PLAN.md](../PLAN.md))

### POST `/api/chat` — 가계부 질문 (Bearer JWT 필수)

로그인한 사용자 **본인 데이터만** 근거로 답한다 (선택 월 요약·카테고리별 지출·지난달 카테고리별 지출·최근 6개월·해당 월 거래 최근 50건·정기결제 목록). 조회 전용이며 거래를 바꾸지 않고, 대화는 저장하지 않는다.

```json
{
  "month": "2026-10",
  "messages": [
    {"role": "user", "content": "정기결제 뭐뭐 있어?"},
    {"role": "assistant", "content": "넷플릭스, 유튜브 프리미엄 ... 가 있어요."},
    {"role": "user", "content": "그중 제일 비싼 건?"}
  ]
}
```
- `messages`: 최근 대화를 **오래된 순서로**, 1~10개, **마지막은 `user`**, `role`은 `user`/`assistant`, `content`는 앞뒤 공백 제거 후 1~1000자
- `month`: `YYYY-MM` — 어느 달 데이터를 근거로 답할지

응답 `200`
```json
{"reply": "이번 달(2026년 10월) 잔액은 1,805,400원입니다."}
```
- `reply`는 일반 텍스트(마크다운 없음). 줄바꿈(`\n`)과 `- ` 목록이 올 수 있으니 `white-space: pre-line` 등으로 표시
- 응답까지 보통 3~6초 → 전송 중 표시 필요

| 코드 | 경우 | `detail` |
|---|---|---|
| 401 | 토큰 없음·만료 | `인증이 필요합니다.` |
| 422 | `messages` 형식·개수·길이 위반 (FastAPI 기본 배열 형식), 잘못된 `month` (문자열) | 배열 또는 문자열 |
| 429 | 사용자별 1분 호출 제한 초과 (기본 10회) | `질문이 너무 많습니다. 잠시 후 다시 시도하세요.` |
| 503 | 챗봇 꺼짐(`CHAT_ENABLED=false`) 또는 Bedrock 호출 실패·시간 초과 | `챗봇을 지금 사용할 수 없습니다. 잠시 후 다시 시도하세요.` |

---

## 월간 명세서 메일 ([PLAN.md](../PLAN.md) 기능 2)

### POST `/api/reports/monthly-email` — 선택 월 명세서를 내 메일로 발송 (Bearer JWT 필수)

받는 주소는 **로그인한 사용자 본인 이메일로 고정**(요청으로 바꿀 수 없음). 내용: 수입·지출·잔액, 카테고리별 지출(비율·지난달 대비, 지난달에 없던 카테고리는 "신규"), 최근 6개월, 해당 월 거래 내역(최대 200건), 등록된 정기결제.

요청
```json
{"month": "2026-10"}
```

응답 `202`
```json
{"sent_to": "u***@gmail.com"}
```
- `sent_to`는 앞 한 글자만 남기고 가린 주소 → 확인 창·완료 안내에 그대로 표시
- 202는 SES가 발송을 접수했다는 뜻. 도착까지 몇 초~몇 분, 스팸함에 갈 수 있음

| 코드 | 경우 | `detail` |
|---|---|---|
| 401 | 토큰 없음·만료 | `인증이 필요합니다.` |
| 422 | `month` 누락(FastAPI 기본 배열 형식), 잘못된 형식(문자열) | 배열 또는 문자열 |
| 429 | 같은 사용자가 5분 안에 다시 요청 | `명세서 메일은 N분 뒤에 다시 보낼 수 있습니다.` |
| 409 | **받는 주소가 SES에 인증되지 않음**(샌드박스) → 아래 메일 인증 흐름으로 안내 | `받는 메일 주소 인증이 필요합니다. 메일 인증을 먼저 완료하세요.` |
| 503 | 기능 꺼짐(`EMAIL_ENABLED=false`), 권한·연결 오류 | `지금은 메일을 보낼 수 없습니다. 잠시 후 다시 시도하세요.` |

### 받는 주소 메일 인증 (SES 샌드박스 대응)

SES가 샌드박스인 동안에는 **받는 주소도 SES 인증이 필요**하다. 페이지에서 본인 주소 인증을 요청할 수 있다. 인증 메일은 **AWS가 영어로 보낸다**("Amazon Web Services – Email Address Verification Request…", 스팸함·프로모션 탭 확인). 링크는 24시간 유효. SES 프로덕션 접근이 승인되면 모든 주소가 `verified`로 나온다.

#### GET `/api/reports/email-status` — 내 주소 상태 (Bearer JWT)
```json
{"email": "h***@gmail.com", "status": "verified"}
```
- `status`: `verified`(바로 받을 수 있음) / `pending`(인증 메일 링크 클릭 대기) / `unverified`(인증 요청 전)

#### POST `/api/reports/email-verification` — 내 주소로 인증 메일 요청 (Bearer JWT, 본문 없음)
- `unverified`일 때만 AWS 인증 메일을 보내고 `202` + `{"email": "...", "status": "pending"}`
- 이미 `pending`·`verified`면 메일을 다시 보내지 않고 `200` + 현재 상태
- 같은 사용자 1분 안 재요청 `429`, 기능 꺼짐·오류 `503`

권장 화면 흐름
```text
[명세서 메일로 받기] → GET email-status
  verified   → 확인 창 → POST monthly-email
  unverified → "메일 인증이 필요해요" [인증 메일 보내기] → POST email-verification → "메일함의 링크를 눌러 주세요"
  pending    → "메일함의 AWS 인증 링크를 눌러 주세요" [인증했어요] → GET email-status 다시 확인
POST monthly-email 이 409면 → GET email-status 로 위 흐름 다시
```

---

## TypeScript 타입 (참고용)

```ts
type TxType = "INCOME" | "EXPENSE";
type BillingCycle = "WEEKLY" | "MONTHLY" | "YEARLY";

interface User { id: number; email: string; created_at: string }
interface TokenResponse { access_token: string; token_type: "bearer"; expires_in: number }
interface Category { id: number; name: string; type: TxType; is_default: boolean }

interface Transaction {
  id: number; type: TxType; amount_krw: number; occurred_on: string;
  category_id: number; category_name: string;
  merchant: string | null; memo: string | null;
  created_at: string; updated_at: string;
}
interface TransactionCreate {
  type: TxType; amount_krw: number; occurred_on: string; category_id: number;
  merchant?: string | null; memo?: string | null;
}
type TransactionUpdate = Partial<TransactionCreate>;

interface Subscription {
  id: number; name: string; amount_krw: number; billing_cycle: BillingCycle;
  billing_anchor_date: string; category_id: number; category_name: string;
  memo: string | null; created_at: string;
}
interface SubscriptionCreate {
  name: string; amount_krw: number; billing_cycle: BillingCycle;
  billing_anchor_date: string; category_id: number; memo?: string | null;
}

interface Dashboard {
  month: string;
  summary: { income_krw: number; expense_krw: number; balance_krw: number };
  expense_by_category: { category_id: number; name: string; amount_krw: number }[];
  monthly_compare: { month: string; income_krw: number; expense_krw: number }[];
}

type ApiError = { detail: string | { loc: (string | number)[]; msg: string; type: string }[] };
```
