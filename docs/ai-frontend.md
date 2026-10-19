# 프론트엔드 AI 컨텍스트

> 프론트엔드 작업 시 AI 도우미에게 이 문서와 [api-contract.md](api-contract.md)를 함께 제공한다.
> 공통 규칙은 [AGENTS.md](../AGENTS.md).

## 현재 상태

- 백엔드 API 14개 구현·테스트 완료 (`main` 브랜치). 목 데이터 대신 실제 API로 바로 연동 가능.
- API 형식은 [api-contract.md](api-contract.md)가 기준. **필드명을 바꾸거나 추측하지 말 것.**

## 기술 스택

React + Vite + Tailwind CSS + Recharts (+ React Router). 상태 관리 라이브러리·UI 프레임워크 추가는 최소화.

## 화면 (PRD §3.7)

| 경로 | 내용 | 사용하는 API |
|---|---|---|
| `/login` | 로그인 폼 | `POST /api/auth/login` |
| `/register` | 회원가입 폼 → 성공 시 자동 로그인 또는 `/login` 이동 | `POST /api/auth/register` (+ login) |
| `/dashboard` | 월 선택, 요약 카드 3개(수입·지출·잔액), 카테고리별 지출 원형 차트, 최근 6개월 수입·지출 막대 차트 | `GET /api/dashboard?month=` |
| `/transactions` | 월 선택, 거래 테이블, 등록·수정 모달, 삭제 확인 | `GET/POST/PATCH/DELETE /api/transactions`, `GET/POST /api/categories` |
| `/subscriptions` | 정기결제 목록, 등록 모달, 삭제 확인 | `GET/POST/DELETE /api/subscriptions`, `GET /api/categories` |

- 상단 내비게이션 + 로그아웃 버튼, 기본 반응형. 사이드바·애니메이션·모바일 전용 레이아웃 없음.
- 로그인 안 된 상태로 보호 페이지 접근 시 `/login`으로 이동.

## 반드시 지킬 것

1. **API 호출은 상대 경로 `/api/...`만 사용.** `http://localhost:8000` 같은 절대 주소를 코드에 넣지 않는다.
   - 로컬: `vite.config`에 프록시 설정
     ```js
     server: { proxy: { '/api': 'http://localhost:8000' } }
     ```
   - 운영: CloudFront가 같은 도메인에서 `/api/*`를 EC2로 전달하므로 그대로 동작
2. **API 호출은 공통 모듈 하나로 모은다** (예: `src/api/client.js`)
   - `Authorization: Bearer <token>` 자동 첨부
   - **401 응답이면 토큰 삭제 후 `/login` 이동**
   - `204` 응답은 본문이 없으므로 JSON 파싱하지 않음
   - 오류 시 `detail`이 문자열이면 그대로, 배열이면 필드별 메시지로 변환
3. **토큰 저장**: 장기 보관용 localStorage 대신 메모리 + `sessionStorage` 권장 (PRD §3.1, XSS 고려). 토큰 유효기간 60분, 리프레시 없음.
4. **카테고리 id 하드코딩 금지.** `GET /api/categories` 결과에서 이름·유형으로 찾는다.
5. 거래 폼: 선택한 `type`(수입/지출)에 맞는 카테고리만 드롭다운에 표시. `type`을 바꾸면 카테고리 선택 초기화.
6. 거래 수정(PATCH)은 변경된 필드만 보내도 되지만, 모달 전체 값을 보내도 문제없음.
7. 정기결제 화면: **목록 · 등록 폼 · 삭제 확인만.** 수정 버튼, "가계부에 추가" 버튼, 다음 결제일·D-day 계산 **만들지 않음**. 카테고리는 지출(EXPENSE)만 표시, 기본값 "구독·정기결제".
8. 금액 표시는 `toLocaleString('ko-KR')` + "원". 입력은 정수만(1 이상).
9. 대시보드
   - 월 선택 기본값은 이번 달 (`YYYY-MM`)
   - `expense_by_category`가 빈 배열이면 "이번 달 지출이 없습니다" 같은 빈 상태 표시
   - `monthly_compare`는 항상 6개 → 그대로 막대 차트 데이터로 사용 (X축 `month`, 막대 `income_krw`/`expense_krw`)
   - 정기결제 금액을 합산하거나 별도 표시하지 않음
10. `created_at` 등 일시는 UTC 문자열(시간대 표기 없음). 화면에 꼭 필요하지 않으면 표시하지 않아도 됨.

## 로컬에서 백엔드 띄우기

```bash
git pull origin main
# 저장소 루트
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && cp .env.example .env     # DB 접속 정보 입력 (로컬 MariaDB 필요)
python -m app.init_db
python -m app.seed_demo --email demo@example.com --password '<원하는 비밀번호>'   # 차트 확인용 6개월 가상 데이터
uvicorn app.main:app --reload --port 8000
```
- 로컬 MariaDB 설정은 [README.md](../README.md)의 Backend 섹션 참고
- API 직접 확인: http://localhost:8000/api/docs

## AI에게 줄 프롬프트 예시

```text
이 저장소의 AGENTS.md, docs/ai-frontend.md, docs/api-contract.md를 먼저 읽어줘.
frontend/ 폴더에 Vite + React + Tailwind 프로젝트로 <작업 내용>을 만들어줘.
API 필드명과 경로는 docs/api-contract.md를 그대로 따르고, backend/ 폴더는 수정하지 마.
```

예시 작업:
- "API 공통 클라이언트(`src/api/client.js`)와 인증 상태 관리, 보호 라우트를 만들어줘"
- "`/transactions` 화면: 월 선택, 거래 테이블, 등록·수정 모달, 삭제 확인을 만들어줘"
- "`/dashboard` 화면: 요약 카드 3개와 Recharts 원형·막대 차트를 만들어줘"
