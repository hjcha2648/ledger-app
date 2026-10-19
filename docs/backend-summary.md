# 백엔드 작업 정리

- 담당: B (백엔드·DB)
- 작성일: 2026-10-19 (Day 1)
- 브랜치: `feat/backend` → `main` 병합 완료 (PR #1, #2)
- 기준 문서: [PRD v3.2](../PRD.md), [작업 계획 PLAN-backend.md](../PLAN-backend.md)

---

## 1. 요약

| 항목 | 상태 |
|---|---|
| PRD API 14개 | ✅ 전부 구현 (`PATCH /api/subscriptions/{id}`는 PRD상 제외) |
| DB 모델 4개 + 초기화 | ✅ 로컬 WSL MariaDB에서 생성·검증 |
| 사용자별 데이터 격리 | ✅ 모든 조회·수정·삭제를 JWT의 `user_id`로 제한 |
| 스모크 테스트 | ✅ 51개 항목 모두 PASS (로컬) |
| 문서 | ✅ README 백엔드 섹션, API 계약, 팀원 AI용 가이드 |
| EC2·CloudFront 배포 | ⏳ 인프라(A) 준비 대기 |

PRD 일정상 Day 1~3에 걸친 백엔드 작업을 Day 1에 마쳤다. 남은 작업은 배포 연동, 프론트 연동 지원, 시연 준비다.

---

## 2. PRD 범위 대비 구현

| PRD 항목 | 구현 내용 |
|---|---|
| §3.1 회원가입·로그인 | 이메일 + 비밀번호(8~64자), Argon2id 해시, JWT(HS256, 60분) 발급·검증, `/api/auth/me` |
| §3.2 거래 관리 | 등록·월별 조회·수정(부분 수정)·삭제, 유형-카테고리 일치 검증, 금액 1 이상 정수 |
| §3.3 카테고리 | 기본 13개 시드(지출 9 · 수입 4), 개인 카테고리 추가, 사용자별 분리 |
| §3.4 정기결제 | 등록·목록·삭제만, 주기 3종, **지출 카테고리만 허용**, 거래 테이블과 완전 분리 |
| §3.6 대시보드 | 월 요약(수입·지출·잔액), 카테고리별 지출, 최근 6개월 비교 — 거래만 집계 |
| §4 DB 설계 | 테이블·컬럼·인덱스 PRD 그대로 + CHECK 제약 추가 |
| §5 API | 경로·메서드·상태 코드(401/404/409/422) PRD 그대로 |
| §14 간소화 규칙 | 정기결제↔거래 관계 없음, 스케줄러·날짜 계산 없음, 정기결제 PATCH 없음 |

**구현하지 않은 것 (PRD 제외 항목)**: 정기결제 수정·거래 반영·결제일 계산, 거래 필터·검색, 카테고리 수정·삭제, 회원 탈퇴·비밀번호 재설정, Alembic, Pytest, Docker.

---

## 3. 코드 구조

총 약 1,250줄 (Python + 스크립트)

```text
backend/
├─ app/
│  ├─ main.py            앱 생성, 라우터 등록, CORS, /api/health, 500 오류 JSON 처리
│  ├─ config.py          환경 변수 로드 (pydantic-settings, backend/.env)
│  ├─ database.py        SQLAlchemy 엔진·세션, get_db
│  ├─ models.py          User, Category, Transaction, Subscription
│  ├─ security.py        Argon2 해시/검증, JWT 발급/검증
│  ├─ deps.py            get_current_user (Bearer 토큰 → 사용자)
│  ├─ utils.py           parse_month, visible_to, get_usable_category
│  ├─ init_db.py         테이블 생성 + 기본 카테고리 시드
│  ├─ seed_demo.py       시연용 계정·6개월 가상 데이터
│  ├─ schemas/           auth, category, transaction, subscription, dashboard
│  └─ routers/           auth, categories, transactions, subscriptions, dashboard
├─ scripts/smoke.sh      curl 기반 스모크 테스트 (51개 항목)
├─ requirements.txt      의존성 버전 고정
└─ .env.example          환경 변수 키 목록
```

**주요 의존성**: FastAPI 0.146 · SQLAlchemy 2.1.5 · Pydantic 2.14 · PyMySQL 1.2.3 · PyJWT 2.15 · argon2-cffi 25.1 · uvicorn 0.54 (Python 3.14)

---

## 4. DB

| 테이블 | 핵심 | 인덱스·제약 |
|---|---|---|
| `users` | email UNIQUE, password_hash | UNIQUE(email) |
| `categories` | user_id NULL = 시스템 기본 | (user_id), type CHECK |
| `transactions` | type, amount_krw, occurred_on, category_id, merchant, memo | (user_id, occurred_on), amount ≥ 1 CHECK, type CHECK |
| `subscriptions` | name, amount_krw, billing_cycle, billing_anchor_date, category_id, memo | (user_id), amount ≥ 1 CHECK, cycle CHECK |

- 문자셋 utf8mb4, 시간은 UTC로 저장
- `python -m app.init_db`는 여러 번 실행해도 중복 없음
- 스키마 변경 시 `create_all()`은 기존 테이블을 바꾸지 않으므로 `ALTER TABLE`로 반영하고 README에 기록 (현재 변경 이력 없음)

---

## 5. API

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/health` | 서버·DB 상태 |
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인, JWT 발급 |
| GET | `/api/auth/me` | 현재 사용자 |
| GET / POST | `/api/categories` | 카테고리 조회 / 개인 카테고리 추가 |
| GET | `/api/transactions?month=YYYY-MM` | 월별 거래 |
| POST | `/api/transactions` | 거래 등록 |
| PATCH / DELETE | `/api/transactions/{id}` | 거래 수정 / 삭제 |
| GET / POST | `/api/subscriptions` | 정기결제 목록 / 등록 |
| DELETE | `/api/subscriptions/{id}` | 정기결제 삭제 |
| GET | `/api/dashboard?month=YYYY-MM` | 대시보드 통계 |

요청·응답 상세와 실제 예시는 [api-contract.md](api-contract.md).

---

## 6. 설계 결정 (PRD에 명시되지 않아 백엔드에서 정한 것)

| 결정 | 이유 |
|---|---|
| 모든 경로·Swagger를 `/api` 아래에 둠 (`/api/docs`) | CloudFront가 `/api/*`만 EC2로 전달 |
| 로그인 요청은 JSON (`{email, password}`) | 프론트 구현 단순화 (OAuth2 form 미사용) |
| 이메일 소문자 정규화 | 대소문자만 다른 중복 가입 방지 |
| 로그인 실패 시 이메일 존재 여부와 무관하게 같은 메시지·처리 시간 | 계정 존재 여부 노출 방지 |
| 다른 사용자 자원은 403이 아닌 **404** | 자원 존재 여부 노출 방지 (PRD §5) |
| 거래 PATCH는 변경 후 최종 유형·카테고리 조합으로 재검증 | 유형만 바꿔 불일치가 생기는 것 방지 |
| 정기결제는 지출(EXPENSE) 카테고리만 허용 | PRD §3.4 "지출 카테고리(필수)" |
| 개인 카테고리는 기본 카테고리와 같은 이름·유형이면 409 | 드롭다운 중복 방지 |
| 대시보드 6개월 비교는 빈 달을 0으로 채워 항상 6개 | 프론트 차트 처리 단순화 |
| DB에도 CHECK 제약 (금액·유형·주기) | API 검증이 우회돼도 DB에서 차단 |
| 예상치 못한 오류도 `{"detail": ...}` JSON 500 | 오류 형식 일관성, 상세 내용은 서버 로그에만 |
| `pool_pre_ping`, `pool_recycle=3600` | MariaDB 유휴 연결 끊김 대비 |

---

## 7. 테스트

PRD §8 방침에 따라 자동화 테스트(Pytest) 대신 **스모크 스크립트 + 수동 검증**.

**`backend/scripts/smoke.sh` — 51개 항목, 로컬 전부 PASS**

| 구역 | 주요 검증 |
|---|---|
| health | 서버·DB 연결, 없는 `/api` 경로가 JSON 404인지 (CloudFront 오류 페이지 설정 검증용) |
| auth | 가입, 중복 409, 틀린 비밀번호 401, 토큰 없음·위조 401 |
| categories | 기본 13개, 개인 추가·중복 409, 다른 계정에 안 보임 |
| transactions | 등록·월별 조회·수정·삭제, 유형 불일치·금액 0·잘못된 월 422, **다른 계정의 수정·삭제 404** |
| subscriptions | 등록·목록·삭제, 수입 카테고리 422, **등록·삭제해도 거래 변화 없음** |
| dashboard | 합계 = 거래 목록 합, **정기결제 미포함**, 원형 합 = 지출, 막대 6개 |

**단계별 수동 검증에서 추가로 확인한 것**
- 만료 토큰 401, 대소문자만 다른 이메일 중복 409
- 월 경계: 9/30 · 10/1 · 10/31 · 11/1 중 10월 조회 시 10/1, 10/31만
- 연도 경계: 2026-02 대시보드의 6개월이 2025-09 ~ 2026-02로 정확히 이어짐
- 금액 INT 범위 초과, 없는 날짜(2/30), PATCH로 필수 필드를 null로 보내는 경우 422
- 비밀번호가 `$argon2id$` 해시로 저장됨
- `.env`(비밀값)가 Git 기록에 한 번도 포함되지 않음
- GitHub에서 새로 clone한 코드로도 동일하게 동작

---

## 8. 작업 이력

| 시각 | 커밋 | 내용 |
|---|---|---|
| 14:01 | `0f849dc` | 작업 계획(현 PLAN-backend.md) |
| 14:08 | `b1984c3` | 프로젝트 구조, 의존성, `.gitignore`, `.env.example` |
| 14:13 | `1e7e43d` | 설정, DB 연결, 헬스체크 |
| 14:16 | `f4a6d3c` | DB 모델 4개, 초기화·시드 |
| 14:19 | `8f1dfff` | 회원가입·로그인·JWT |
| 14:24 | `560fd33` | 카테고리 API |
| 14:28 | `6b7d1c8` | 거래 CRUD |
| 14:38 | `f7ba75e` | 정기결제 C/R/D |
| 14:40 | `54f3857` | 대시보드 집계 |
| 14:42 | `ae22873` | 스모크 테스트 스크립트 |
| 14:46 | `b70968d` | README, 시연 데이터 스크립트, 500 JSON |
| 14:48 | `7cd1d24` | PLAN 진행 현황 |
| 14:54 | `5b8dbdd` | **PR #1 병합** — 백엔드 전체 |
| 15:05 | `bcc3998` | 팀원 AI용 문서 (AGENTS.md, API 계약, 프론트·인프라 가이드) |
| 15:06 | `ebfccf9` | **PR #2 병합** — AI 문서 |

---

## 9. 개발 중 이슈와 해결

| 이슈 | 원인 | 해결 |
|---|---|---|
| `ALTER: command not found` | SQL을 bash에 입력 | `sudo mariadb`로 접속 후 실행 |
| `[Errno 98] Address already in use` | 다른 프로젝트 서버가 8000 포트 사용 | 해당 프로세스 확인 후 정리 |
| `No module named 'app'` | 저장소 루트에서 실행 | 백엔드 명령은 `backend/`에서 실행 (README에 기록) |
| 루트 `/` 접속 시 `Not Found` | API는 `/api/*`에만 존재 | 정상 동작, README에 안내 |
| 거래 수정 스키마에서 금액이 필수로 처리됨 | Pydantic `Field` 재사용 방식 오류 | `Annotated` 타입으로 변경 후 재검증 |
| 스모크 테스트에서 삭제(204) 4건 FAIL | 본문 없는 응답에서 스크립트의 상태 코드 파싱 위치 어긋남 | 상태 코드를 마지막 한 줄로 받도록 수정 (API 문제 아님) |
| 시연 데이터 당월 수입 0원 | 월급일(25일)이 시연일 이후 | 월급일을 10일로 변경 |

---

## 10. 팀 연계 산출물

| 대상 | 산출물 |
|---|---|
| 프론트(C) | [api-contract.md](api-contract.md) — 실제 응답 예시·TS 타입, [ai-frontend.md](ai-frontend.md) — 화면별 API·구현 규칙 |
| 인프라(A) | [ai-infra.md](ai-infra.md) — EC2 체크리스트·systemd·CloudFront·백업, README 배포 섹션 |
| 전원 | [AGENTS.md](../AGENTS.md) — AI 도우미 공통 규칙, `smoke.sh` — 배포 검증 도구 |

---

## 11. 남은 작업

| 작업 | 선행 조건 | 방법 |
|---|---|---|
| EC2 최초 배포 (STEP 9) | A의 EC2 생성 | [ai-infra.md](ai-infra.md) 체크리스트 → `smoke.sh http://127.0.0.1:8000` |
| CloudFront 경유 검증 (STEP 12) | A의 CloudFront 구성 | `smoke.sh https://<CloudFront 주소>` |
| 프론트 연동 지원 | C의 화면 작업 | 필드명 조정 요청 시 반영, `api-contract.md` 갱신 |
| EC2 시연 데이터 | EC2 배포 | `python -m app.seed_demo`, smoke 테스트 계정 정리 |
| 백업·복원 확인 | EC2 배포 | A와 `mariadb-dump` 복원 검증 |
| 시연 리허설 (Day 4) | 전체 배포 | CloudFront 주소에서 전체 흐름 |

**결정 대기**: 일시 필드(`created_at` 등)에 UTC 표기 `Z`를 붙일지 — 프론트(C) 답변 후 결정.

---

## 12. 관련 문서

- [README.md](../README.md) — 로컬 실행, 환경 변수, 배포, 문제 해결
- [PLAN-backend.md](../PLAN-backend.md) — 백엔드 작업 계획과 진행 현황
- [PLAN-infra.md](../PLAN-infra.md), [db-design.md](db-design.md) — 인프라 계획, DB 설계
- [docs/api-contract.md](api-contract.md) — API 상세
- [PRD.md](../PRD.md) — 요구사항
