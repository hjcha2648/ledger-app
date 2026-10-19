# API 계약 (프론트엔드 참고)

API 계약의 **기준 문서는 저장소 루트의 [docs/api-contract.md](../../docs/api-contract.md)** 이다(백엔드 구현과 일치). 필드명·경로·상태 코드는 그 문서를 따르며, 프론트에서 추측하거나 바꾸지 않는다. (AGENTS.md 규칙 1)

이 파일은 초기에 프론트가 가정했던 계약을 담고 있었으나 루트 문서와 중복되어 내용을 제거했다. 아래는 루트 계약을 프론트가 **어떻게 처리하는지**만 정리한 것이다.

## 프론트의 처리 방식

| 계약 내용 | 프론트 처리 | 위치 |
|---|---|---|
| 모든 경로는 `/api` 접두어, 상대 경로 호출 | `fetch('/api...')` 만 사용. 개발은 Vite 프록시, 운영은 CloudFront | `src/api/client.js`, `vite.config.js` |
| `Authorization: Bearer` | 토큰을 `sessionStorage`에 저장하고 자동 첨부 | `src/api/client.js` |
| 401 (만료·위조) | 토큰 삭제 후 `/login` 이동. 로그인 실패 401은 일반 오류로 표시 | `client.js`, `AuthContext.jsx` |
| `detail` 문자열 | 그대로 표시 | `client.js` |
| 422 `detail` 배열 | `loc` 마지막 값(필드명)을 입력칸 오류로 표시, 전체 메시지는 "입력값을 확인해 주세요." | `client.js`, `utils/formErrors.js` |
| 204 (DELETE) | 본문 파싱 없이 `null` 반환 | `client.js` |
| 비밀번호 8~64자 | 회원가입 폼에서 같은 범위로 검증 | `RegisterPage.jsx` |
| 거래·정기결제 응답의 `category_name` | 표에 우선 사용, 없으면 카테고리 목록과 조인 | `TransactionsPage.jsx`, `SubscriptionsPage.jsx` |
| 카테고리 `is_default`, 정렬(EXPENSE → INCOME) | 서버 순서 그대로 사용, 폼에서는 선택한 유형만 필터 | `TransactionForm.jsx` |
| 카테고리 id 하드코딩 금지 | 이름·유형으로 찾음 ("구독·정기결제" 기본 선택) | `SubscriptionForm.jsx` |
| `monthly_compare` 항상 6개 | 그대로 막대 차트 데이터로 사용 | `MonthlyBarChart.jsx` |
| `expense_by_category` 빈 배열 가능 | 빈 상태 메시지 표시 | `CategoryPieChart.jsx` |
| 회원가입 후 토큰 없음 | 가입 성공 후 `/login`으로 이동 | `RegisterPage.jsx` |

## 목 서버

`VITE_USE_MOCK=true`일 때 쓰는 `src/api/mock/index.js`는 위 계약의 응답 모양(필드, 상태 코드, 422 필드 오류, `category_name`, `is_default`, `expires_in`, 이메일 소문자 저장, 카테고리 409 등)을 따른다. 계약이 바뀌면 목 서버도 함께 맞춘다.
