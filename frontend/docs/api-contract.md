# 프론트엔드가 가정한 API 계약 (B와 Day 1 합의용)

프론트는 아래 형식을 기준으로 구현했다. 다르면 B가 알려주거나 프론트가 `src/api/*.js`만 수정한다.
목 서버(`src/api/mock/index.js`)도 같은 형식을 따른다.

## 공통
- 모든 경로는 `/api` 접두어, 인증 API 외에는 `Authorization: Bearer <token>`.
- 목록 응답은 **`{items: [...]}`가 아닌 순수 배열**.
- 날짜 `YYYY-MM-DD`, 월 `YYYY-MM`, 필드명 snake_case, 유형 `INCOME`/`EXPENSE`.
- 오류는 `{"detail": "문자열"}` 또는 422의 `{"detail": [{"loc": [...], "msg": "..."}]}` 둘 다 처리한다.
- 401(토큰 만료·변조) 시 프론트는 자동 로그아웃한다.
- DELETE 성공은 `204 No Content` (본문 없음). 200 + JSON이어도 무방.

## 인증
| 요청 | 본문 | 응답 |
|---|---|---|
| POST `/auth/register` | `{email, password}` | `201 {id, email}` — 중복이면 409 |
| POST `/auth/login` | `{email, password}` (**JSON**, OAuth2 form 아님) | `{access_token, token_type}` — 실패 시 401 |
| GET `/auth/me` | — | `{id, email}` (선택 구현. 없어도 프론트는 사용하지 않음) |

- 비밀번호 최소 길이: 8자 (프론트 검증과 서버 검증을 맞출 것).
- 회원가입 후 프론트는 로그인 화면으로 이동한다(자동 로그인 없음).

## 카테고리
- GET `/categories` → `[{id, user_id, name, type, created_at}]` (기본 + 내 것, `user_id`는 기본이면 null)
- POST `/categories` `{name, type}` → 생성된 카테고리

## 거래
- GET `/transactions?month=YYYY-MM` → **최신순**(`occurred_on` desc, `id` desc) 배열
  `[{id, type, amount_krw, occurred_on, category_id, merchant, memo, created_at, updated_at}]`
- 응답에 `category_name`은 **없다고 가정**하고 프론트가 `/categories`와 조인한다. 포함해 주면 조인을 생략한다.
- POST `/transactions` `{type, amount_krw, occurred_on, category_id, merchant?, memo?}` → 생성된 거래
- PATCH `/transactions/{id}` 일부 필드 → 수정된 거래
- DELETE `/transactions/{id}`
- 타 사용자 자원은 404, 유형·카테고리 불일치는 422.

## 정기결제 (목록 관리만)
- GET `/subscriptions` → `[{id, name, category_id, amount_krw, billing_cycle, billing_anchor_date, memo, created_at}]`
- POST `/subscriptions` `{name, amount_krw, billing_cycle, billing_anchor_date, category_id, memo?}`
  (`billing_cycle`: `WEEKLY`/`MONTHLY`/`YEARLY`, 카테고리는 EXPENSE만)
- DELETE `/subscriptions/{id}`

## 대시보드
GET `/dashboard?month=YYYY-MM`
```json
{
  "month": "2026-10",
  "summary": {"income_krw": 0, "expense_krw": 0, "balance_krw": 0},
  "expense_by_category": [{"category_id": 1, "name": "식비", "amount_krw": 0}],
  "monthly_compare": [{"month": "2026-05", "income_krw": 0, "expense_krw": 0}]
}
```
- `monthly_compare`는 **선택 월을 마지막으로 하는 최근 6개월, 오래된 달 → 최신 달 순, 데이터가 없는 달도 0으로 포함**.
- `expense_by_category`는 금액 내림차순, 지출이 없으면 빈 배열.
- 정기결제 금액은 집계에 포함하지 않는다.
