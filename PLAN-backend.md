# PLAN — 백엔드(B) 작업 계획

> 기준 문서: PRD v3.2 (EC2 MariaDB · 정기결제 목록 관리형)
> 담당: B — 백엔드·DB / 브랜치: `feat/backend`
> 목표: FastAPI + SQLAlchemy + MariaDB로 인증·카테고리·거래·정기결제(C/R/D)·대시보드 API를 완성하고, A가 EC2에 그대로 배포할 수 있는 상태로 넘긴다.

### 진행 현황 (2026-10-20 기준)

| 상태 | STEP |
|---|---|
| ✅ 완료 | 0~11, 13 (EC2 내부 smoke 51개 PASS) / 14 중 오류 형식 정리·README·시연 데이터 스크립트(`app/seed_demo.py`) / PR #1~#6 `main` 병합 (프론트 포함) |
| 🔜 바로 가능 | C 화면과 로컬 연동 테스트 (STEP 8·12, 프론트 `main` 병합 완료) |
| ⏳ 팀 대기 | 12 (CloudFront), 14 나머지 (EC2 시연 데이터·백업·리허설) |
| ✔️ 결정됨 | `created_at` 등 UTC 시각은 `Z` 없이 표기 (`docs/api-contract.md`) |

- API 14개 구현 완료, 로컬 스모크 테스트 51개 PASS

---

## 0. 완료 기준 (백엔드 관점 DoD)

- [x] PRD §5의 API 14개가 모두 동작한다 (`PATCH /api/subscriptions/{id}`는 만들지 않음).
- [x] 모든 업무 API는 Bearer JWT 필수이며, `user_id`는 JWT에서만 가져온다.
- [x] 다른 사용자의 거래·정기결제·카테고리는 조회·수정·삭제 시 **404**.
- [x] 대시보드는 `transactions`만 집계한다 (정기결제 금액 미포함).
- [x] `python -m app.init_db` 한 번으로 테이블 생성 + 기본 카테고리 시드가 끝난다 (여러 번 실행해도 안전).
- [x] 로컬(WSL MariaDB)과 EC2(내부 MariaDB) 양쪽에서 `.env`만 바꿔 동일하게 실행된다.

---

## 1. 기술 스택 / 의존성

| 용도 | 패키지 |
|---|---|
| 웹 프레임워크 | `fastapi`, `uvicorn[standard]` |
| ORM / DB 드라이버 | `sqlalchemy>=2.0`, `pymysql` |
| 설정 | `pydantic-settings` |
| 입력 검증 | `pydantic>=2`, `email-validator` |
| 비밀번호 해시 | `argon2-cffi` |
| JWT | `PyJWT` |

- `requirements.txt`에 버전을 고정한다 (`pip freeze`로 확정 후 커밋).
- 로컬 venv는 **Python 3.14**. EC2의 Python 버전이 다르면 A와 맞춘다 (최소 3.11 이상 권장, 의존성 설치 여부를 Day 2에 EC2에서 확인).

---

## 2. 디렉터리 구조

```text
ledger-app/
├─ backend/
│  ├─ app/
│  │  ├─ main.py            # FastAPI 앱, 라우터 등록, CORS, /api/health
│  │  ├─ config.py          # Settings (pydantic-settings, .env 로드)
│  │  ├─ database.py        # engine, SessionLocal, Base, get_db
│  │  ├─ models.py          # User, Category, Transaction, Subscription
│  │  ├─ security.py        # Argon2 해시/검증, JWT 발급/검증
│  │  ├─ deps.py            # get_current_user (HTTPBearer)
│  │  ├─ utils.py           # parse_month("YYYY-MM") → (start, end)
│  │  ├─ init_db.py         # create_all + 기본 카테고리 시드
│  │  ├─ schemas/           # auth.py, category.py, transaction.py, subscription.py, dashboard.py
│  │  └─ routers/           # auth.py, categories.py, transactions.py, subscriptions.py, dashboard.py
│  ├─ requirements.txt
│  ├─ .env.example
│  └─ scripts/smoke.sh      # curl 기반 수동 테스트 보조 스크립트
└─ .gitignore               # .env, .venv, __pycache__
```

---

## 3. 환경 변수 (`.env.example`)

```dotenv
DATABASE_URL=mysql+pymysql://app_user:<password>@127.0.0.1:3306/ledger_db?charset=utf8mb4
JWT_SECRET_KEY=<openssl rand -hex 32 로 생성>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5173
ENABLE_DOCS=true
```

- `.env`는 절대 커밋하지 않는다. 값은 Git·AI 프롬프트에 넣지 않는다.
- EC2에서는 A가 제한 권한 파일(예: `/etc/ledger/backend.env`, `chmod 600`)로 관리하고 systemd `EnvironmentFile=`로 주입.
- 운영(CloudFront)에서는 프론트와 API가 같은 도메인이라 CORS가 필요 없다. `CORS_ORIGINS`는 로컬 개발용.
- `ENABLE_DOCS=false`면 Swagger 비활성화. 켤 때 경로는 CloudFront `/api/*`로 접근 가능하도록 `docs_url="/api/docs"`, `openapi_url="/api/openapi.json"`.

---

## 4. DB 모델 (PRD §4 그대로, 구현 세부)

공통: 테이블 charset `utf8mb4`, 시간은 UTC(`datetime.now(timezone.utc)`, naive로 저장), PK `BIGINT AUTO_INCREMENT`.

| 테이블 | 핵심 컬럼 / 제약 | 인덱스 |
|---|---|---|
| `users` | `email` UNIQUE NOT NULL, `password_hash` | `email` UNIQUE |
| `categories` | `user_id` NULL(=시스템), `name` VARCHAR(30), `type` INCOME/EXPENSE | `(user_id)` |
| `transactions` | `user_id`, `type`, `amount_krw` INT ≥1, `occurred_on` DATE, `category_id`, `merchant`, `memo`, `created_at`, `updated_at` | `(user_id, occurred_on)` |
| `subscriptions` | `user_id`, `name` VARCHAR(120), `category_id`, `amount_krw` ≥1, `billing_cycle` WEEKLY/MONTHLY/YEARLY, `billing_anchor_date` DATE, `memo` | `(user_id)` |

- `subscriptions` ↔ `transactions` **관계·FK 없음**. `registered_on`, `synced_through`, `subscription_id`, `due_date` 컬럼 만들지 않음 (PRD §14).
- enum 성격 컬럼은 DB에서는 `VARCHAR(10)`, 검증은 Pydantic `Literal[...]`로.
- 기본 카테고리 시드 (`user_id=NULL`, 이미 있으면 건너뜀):
  - EXPENSE: 식비, 교통, 주거·통신, 쇼핑, 여가·문화, 의료·건강, 교육, 구독·정기결제, 기타지출
  - INCOME: 급여, 용돈, 부수입, 기타수입
- 스키마 변경 시: `create_all`은 기존 테이블을 바꾸지 않음 → 로컬은 DB 재생성, EC2는 `ALTER TABLE`을 README에 기록 후 적용. **EC2 DB에 임의 DROP 금지.**

---

## 5. API 계약 (Day 1에 C와 확정할 초안)

### 5.1 공통 규칙

- 접두어 `/api`. 인증 필요 API는 `Authorization: Bearer <token>`.
- 날짜 `YYYY-MM-DD`, 월 `YYYY-MM`, 일시 ISO 8601(UTC), 금액은 정수(원) — 필드명 `*_krw`.
- 목록 응답은 **배열 그대로** 반환 (페이지네이션 없음).
- 오류는 `{"detail": "..."}`. 단, Pydantic 자동 검증 422는 `detail`이 배열임을 C에게 공유 (프론트는 422면 "입력값 확인" 메시지로 처리).

| 코드 | 상황 |
|---|---|
| 401 | 토큰 없음/만료/위조, 로그인 실패 |
| 404 | 자원 없음 **또는 타 사용자 자원** (존재 여부 노출 안 함) |
| 409 | 이메일 중복, 동일 개인 카테고리 중복 |
| 422 | 입력 형식 오류, 금액 < 1, 잘못된 월 형식, 유형-카테고리 불일치, 사용 불가 카테고리 |

### 5.2 엔드포인트별 요청/응답

**Auth**

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, password}` (password 8~64자) | 201 `{id, email, created_at}` |
| POST | `/api/auth/login` | `{email, password}` (JSON) | 200 `{access_token, token_type: "bearer", expires_in}` |
| GET | `/api/auth/me` | — | `{id, email, created_at}` |
| GET | `/api/health` | — | `{status: "ok", db: "ok"}` (`SELECT 1` 포함) |

- 로그인 실패는 이메일 존재 여부와 관계없이 동일한 401 메시지.
- 로그아웃은 서버 API 없음 (클라이언트 토큰 삭제).
- JWT payload: `sub`(user id, 문자열), `exp`, `iat`. 만료 60분, 리프레시 토큰 없음.

**Categories**

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/categories` | — | `[{id, name, type, is_default}]` (기본 + 내 것, type→id 순) |
| POST | `/api/categories` | `{name(1~30), type}` | 201 `{id, name, type, is_default:false}` |

**Transactions**

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/transactions?month=YYYY-MM` | — | `[Transaction]` (occurred_on desc, id desc) |
| POST | `/api/transactions` | `{type, amount_krw, occurred_on, category_id, merchant?, memo?}` | 201 `Transaction` |
| PATCH | `/api/transactions/{id}` | 위 필드 중 일부 | 200 `Transaction` |
| DELETE | `/api/transactions/{id}` | — | 204 |

`Transaction = {id, type, amount_krw, occurred_on, category_id, category_name, merchant, memo, created_at, updated_at}`

- `month` 미지정 시 422 (프론트가 항상 보내도록 합의). 필터·검색 쿼리는 없음.
- PATCH는 변경 후 최종 `type`과 `category_id`의 조합으로 다시 검증.

**Subscriptions** (C/R/D만)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/subscriptions` | — | `[Subscription]` (created_at desc) |
| POST | `/api/subscriptions` | `{name(1~120), amount_krw, billing_cycle, billing_anchor_date, category_id, memo?}` | 201 `Subscription` |
| DELETE | `/api/subscriptions/{id}` | — | 204 |

`Subscription = {id, name, amount_krw, billing_cycle, billing_anchor_date, category_id, category_name, memo, created_at}`

- `category_id`는 **EXPENSE 유형**이어야 함 (아니면 422).
- 등록·삭제 시 `transactions`를 절대 건드리지 않음.

**Dashboard**

| Method | Path | Response |
|---|---|---|
| GET | `/api/dashboard?month=YYYY-MM` | PRD §5 예시 형식 |

```json
{
  "month": "2026-10",
  "summary": {"income_krw": 1000000, "expense_krw": 350000, "balance_krw": 650000},
  "expense_by_category": [{"category_id": 1, "name": "식비", "amount_krw": 120000}],
  "monthly_compare": [{"month": "2026-05", "income_krw": 900000, "expense_krw": 400000}]
}
```

- `expense_by_category`: 선택 월 EXPENSE를 카테고리별 합산, 금액 내림차순, 0원 카테고리 제외.
- `monthly_compare`: 선택 월 포함 **최근 6개월, 오래된 달 → 최근 달 순**, 거래 없는 달은 0으로 채워 항상 6개.
- `SUM()` 결과(Decimal/None)는 `int(x or 0)`로 변환.

---

## 6. 핵심 구현 규칙

1. **소유권**: 단건 조회/수정/삭제는 `WHERE id = :id AND user_id = :current_user_id`로 한 번에 조회 → 없으면 404. 요청 본문의 `user_id`는 스키마에 아예 두지 않는다.
2. **카테고리 사용 가능 여부** (`get_usable_category(db, user_id, category_id, required_type)` 헬퍼 하나로 공통화):
   - `category.user_id IS NULL OR category.user_id = current_user_id` 아니면 422
   - `category.type != required_type`이면 422
3. **월 파싱**: `^\d{4}-(0[1-9]|1[0-2])$` 검증 → `[해당 월 1일, 다음 달 1일)` 범위로 조회 (인덱스 활용).
4. **금액**: `conint(ge=1, le=2_147_483_647)` (INT 범위).
5. **문자열**: 앞뒤 공백 제거, 빈 문자열 선택 필드는 `None`으로 저장.
6. **비밀번호**: `argon2.PasswordHasher` 사용, 해시만 저장, 응답·로그에 비밀번호/해시/토큰 출력 금지.
7. 정기결제 관련 날짜 계산·스케줄러·백그라운드 작업 **만들지 않음**.

---

## 7. 일정별 작업 (4일 × 8시간)

### Day 1 — 기반 + 인증 + API 계약 확정

- [x] `backend/` 구조 생성, `requirements.txt`, `.env.example`, `.gitignore`
- [x] WSL MariaDB에 `ledger_db`(utf8mb4) + `app_user` 생성, 권한은 `ledger_db.*`에만
- [x] `config.py`, `database.py` (`pool_pre_ping=True`, `pool_recycle=3600`)
- [x] 4개 모델 작성 + `init_db.py` (create_all + 시드, 재실행 안전)
- [x] `security.py`, `deps.py`, `/api/auth/register|login|me`, `/api/health`
- [x] **§5 API 계약을 C와 확정** → 변경 사항 반영 후 팀 공유 (C는 이걸로 목 데이터 작업)
- [x] A에게 실행 명령/포트/환경 변수 목록 전달 (§8) — `docs/agent-infra.md`
- 종료 조건: 로컬에서 회원가입 → 로그인 → `/api/auth/me` 성공, 중복 가입 409

### Day 2 — 카테고리 + 거래 CRUD

- [x] `GET/POST /api/categories` (기본 + 내 카테고리, 중복 409)
- [x] `get_usable_category` 헬퍼
- [x] 거래 `GET(month)/POST/PATCH/DELETE`
- [ ] Swagger로 전 엔드포인트 수동 확인, C의 거래 화면과 로컬 연동 (Vite proxy `/api` → `localhost:8000`)
- [x] A와 EC2에서 venv + 의존성 설치 + `init_db` + systemd 기동 확인 지원
- 종료 조건: 거래 등록/월별 조회/수정/삭제 동작, 타 계정 거래 404

### Day 3 — 정기결제 + 대시보드 + E2E

- [x] 정기결제 `GET/POST/DELETE` (EXPENSE 카테고리만, 거래 미연동)
- [x] 대시보드 집계 API (summary / expense_by_category / monthly_compare)
- [ ] C의 정기결제·차트 화면과 연동, 필드명 불일치 즉시 수정
- [ ] EC2 배포본 갱신(`git pull` → 재시작) 후 CloudFront `/api/*` 경유 호출 확인 (A와 함께)
- [x] `scripts/smoke.sh` 작성 (가입→로그인→거래→정기결제→대시보드 curl 흐름)
- 종료 조건: 로컬·CloudFront 양쪽에서 핵심 기능 E2E 연결

### Day 4 — 검증·버그 수정 (신규 기능 금지)

- [ ] §9 체크리스트 전체 수동 검증 (특히 사용자 격리, 집계 수치)
- [x] 오류 응답 형식/상태 코드 일관성 점검
- [x] README 백엔드 섹션 작성 (로컬 실행, 환경 변수 키, DB 초기화, 스키마 변경 절차)
- [ ] EC2에 시연 계정·가상 데이터 등록, A의 `mariadb-dump` 백업·복원 확인 지원
- [ ] 오후: 버그 수정만, `main` 병합 후 최종 배포
- 종료 조건: CloudFront 주소에서 전체 시연 성공

---

## 8. 팀 인터페이스

**→ C (프론트엔드)**
- §5 API 계약 (Day 1 확정, 이후 변경 시 즉시 공유)
- 로컬 개발: Vite `server.proxy`로 `/api` → `http://localhost:8000` (CORS 없이 운영과 동일 경로)
- 401 수신 시 토큰 삭제 후 `/login` 이동, 422는 `detail`이 배열일 수 있음
- 토큰 저장 방식은 C가 결정하되, 만료 60분 단기 토큰임을 공유

**→ A (인프라)**
- 실행 명령: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers` (작업 디렉터리 `backend/`, venv의 uvicorn 사용)
- 포트·바인딩 주소는 A의 CloudFront 원본 구성에 맞춰 확정 (보안 그룹은 CloudFront 대상만 허용 권장)
- 필요한 환경 변수 키: §3 목록 (값은 A가 EC2에서 직접 생성)
- 최초 배포 1회: `python -m app.init_db`
- 헬스체크: `GET /api/health` (DB 연결까지 확인)
- CloudFront `/api/*`: 캐시 비활성화, `GET/POST/PATCH/DELETE/OPTIONS` 허용, `Authorization` 헤더·쿼리 전달, 오류 페이지를 `index.html`로 치환하지 않기

---

## 9. 백엔드 수동 테스트 체크리스트

- [x] 회원가입 성공 / 같은 이메일 재가입 409 / 잘못된 이메일 형식 422
- [x] 로그인 성공 / 틀린 비밀번호 401 / 토큰 없이·만료·위조 토큰으로 보호 API 401
- [x] 카테고리: 기본 13개 조회, 개인 카테고리 추가, 계정 B에서 A의 개인 카테고리 안 보임
- [x] 거래: 수입·지출 등록, 월별 조회(월 경계 1일/말일 포함), 수정, 삭제
- [x] 거래: 유형-카테고리 불일치 422, 타인 개인 카테고리 사용 422, 금액 0 → 422
- [x] 계정 B가 A의 거래/정기결제 ID로 PATCH/DELETE → 404, A 데이터 그대로
- [x] 정기결제: WEEKLY/MONTHLY/YEARLY 등록·목록·삭제, INCOME 카테고리 사용 시 422
- [x] 정기결제 등록·삭제 전후로 `transactions` 건수·대시보드 수치 변화 없음
- [x] 대시보드: summary 합계 = 거래 목록 합계, 원형 차트 합 = 지출 합계, 6개월 막대 항상 6개
- [x] 잘못된 `month` (`2026-13`, `2026-1`, 누락) → 422
- [ ] EC2 재시작 후 서비스 자동 기동, `/api/health` 정상, 데이터 유지

---

## 10. 리스크 & 대응

| 리스크 | 대응 |
|---|---|
| 프론트/백 필드명 불일치 | Day 1 계약 확정, 변경 시 이 문서 §5 수정 + 팀 공지 |
| 사용자 격리 누락 | 모든 쿼리에 `user_id` 조건, 단건 조회 헬퍼로 통일, Day 4 교차 계정 테스트 |
| `create_all`이 스키마 변경 미반영 | Day 1에 모델 최대한 확정, 변경 시 `ALTER TABLE` 기록 |
| CloudFront 경유 시 경로/헤더 문제 | 라우트를 `/api` 접두어로 통일, Day 3 오전에 조기 연결 테스트 |
| MariaDB 연결 끊김(장시간 유휴) | `pool_pre_ping`, `pool_recycle` 설정 |
| 한글 깨짐 | DB·테이블·연결 모두 `utf8mb4` |
| 일정 지연 | 우선순위: 인증 → 거래 → 정기결제 → 대시보드. `/api/auth/me`는 선택 구현이라 밀리면 생략 |

---

## 11. 단계별 진행 순서

> 위에서부터 차례대로 진행한다. 각 단계는 **작업 → 확인 → 커밋** 순서로 끝내고 다음 단계로 넘어간다.
> venv는 저장소 루트의 `.venv`를 사용한다 (`source .venv/bin/activate`).

### STEP 0. 작업 환경 준비 — Day 1 오전

```bash
cd ~/ledger-app
git checkout feat/backend
git pull origin main          # main 최신 내용 반영
source .venv/bin/activate
```

- [x] 브랜치·venv 확인 (`git branch`, `which python`)

### STEP 1. 로컬 MariaDB DB·계정 생성 — Day 1 오전

```bash
sudo service mariadb start    # WSL에서 MariaDB 실행
sudo mariadb
```

```sql
CREATE DATABASE ledger_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'app_user'@'localhost' IDENTIFIED BY '<로컬용 비밀번호>';
CREATE USER 'app_user'@'127.0.0.1' IDENTIFIED BY '<로컬용 비밀번호>';
GRANT ALL PRIVILEGES ON ledger_db.* TO 'app_user'@'localhost';
GRANT ALL PRIVILEGES ON ledger_db.* TO 'app_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

- [x] 확인: `mariadb -u app_user -p -h 127.0.0.1 ledger_db` 접속 성공

### STEP 2. 프로젝트 골격 + 의존성 — Day 1 오전

- [x] `backend/app/`, `schemas/`, `routers/`, `scripts/` 폴더와 빈 `__init__.py` 생성 (§2 구조)
- [x] `.gitignore`에 `.env`, `.venv/`, `__pycache__/` 추가
- [x] 의존성 설치 후 버전 고정

```bash
cd backend
pip install fastapi "uvicorn[standard]" "sqlalchemy>=2.0" pymysql pydantic-settings email-validator argon2-cffi PyJWT
pip freeze > requirements.txt
```

- [x] `.env.example` 작성 (§3), 이를 복사해 `.env`에 실제 값 입력
- [x] 커밋: `chore(backend): 프로젝트 구조 및 의존성 설정`

### STEP 3. 설정·DB 연결·헬스체크 — Day 1 오전

- [x] `config.py` — `Settings` 클래스로 `.env` 로드
- [x] `database.py` — `engine`(`pool_pre_ping`, `pool_recycle`), `SessionLocal`, `Base`, `get_db`
- [x] `main.py` — FastAPI 앱, CORS, docs 경로(`/api/docs`), `GET /api/health` (`SELECT 1`)
- [x] 확인:

```bash
uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/api/health   # {"status":"ok","db":"ok"}
```

- [x] 커밋: `feat(backend): DB 연결 및 헬스체크 API`

### STEP 4. 모델 + DB 초기화 스크립트 — Day 1 오후

- [x] `models.py` — `User`, `Category`, `Transaction`, `Subscription` (§4, 인덱스 포함)
- [x] `init_db.py` — `create_all()` + 기본 카테고리 13개 시드 (이미 있으면 건너뜀)
- [x] 확인:

```bash
python -m app.init_db
python -m app.init_db          # 두 번 실행해도 중복 없음
mariadb -u app_user -p -h 127.0.0.1 ledger_db -e "SHOW TABLES; SELECT COUNT(*) FROM categories;"   # 4개 테이블, 13
```

- [x] 커밋: `feat(backend): DB 모델 및 초기화/시드 스크립트`

### STEP 5. 인증 (회원가입·로그인·me) — Day 1 오후

- [x] `security.py` — Argon2 해시/검증, JWT 발급/디코드
- [x] `deps.py` — `HTTPBearer` + `get_current_user` (실패 시 401)
- [x] `schemas/auth.py`, `routers/auth.py` — `register`, `login`, `me`
- [x] 확인 (Swagger `http://localhost:8000/api/docs`):
  - 가입 201 → 같은 이메일 재가입 409
  - 로그인 → 토큰 받기 → `/api/auth/me` 200
  - 틀린 비밀번호 401, 토큰 없이 `/api/auth/me` 401
- [x] 커밋: `feat(backend): 회원가입/로그인/JWT 인증`

### STEP 6. API 계약 확정·공유 — Day 1 종료 전

- [x] §5 내용을 C와 함께 검토, 바뀐 필드명/형식을 이 문서에 반영 — `docs/api-contract.md`
- [x] A에게 §8 전달 (실행 명령, 포트, 환경 변수 키, `init_db` 명령)
- [x] `feat/backend` 푸시 → `main`으로 PR 생성·병합 (인증까지 동작하는 상태)

### STEP 7. 카테고리 API — Day 2 오전

- [x] `schemas/category.py`, `routers/categories.py` — `GET`(기본+내 것, `is_default`), `POST`(중복 409)
- [x] 공통 헬퍼 `get_usable_category(db, user_id, category_id, required_type)` 작성
- [x] 확인: 계정 A가 추가한 카테고리가 계정 B 목록에 안 보임
- [x] 커밋: `feat(backend): 카테고리 조회/추가 API`

### STEP 8. 거래 CRUD — Day 2 오전~오후

- [x] `utils.py` — `parse_month("YYYY-MM")` → `(시작일, 다음 달 1일)`, 형식 오류 422
- [x] `schemas/transaction.py` — Create / Update(전부 Optional) / Response(`category_name` 포함)
- [x] `routers/transactions.py` — `GET ?month`, `POST`, `PATCH /{id}`, `DELETE /{id}`
  - 단건은 `id + user_id`로 조회, 없으면 404
  - POST/PATCH 모두 최종 `type`·`category_id` 조합을 `get_usable_category`로 검증
- [x] 확인: 등록 → 월별 조회(1일·말일 경계) → 수정 → 삭제, 금액 0·유형 불일치 422, 계정 B로 A 거래 수정/삭제 404
- [ ] C의 거래 화면과 로컬 연동 테스트
- [x] 커밋: `feat(backend): 거래 CRUD 및 월별 조회 API` → PR 병합

### STEP 9. EC2 최초 배포 지원 — Day 2 오후

- [x] A와 함께 EC2에서 `git clone/pull` → venv → `pip install -r backend/requirements.txt` — 실제 경로 `/home/ubuntu/vibe-lab/ledger-app`
- [x] EC2 환경 파일 값 확인 (A가 입력), `python -m app.init_db` 실행
- [x] systemd 기동 후 EC2 내부에서 `curl http://127.0.0.1:8000/api/health` 확인
- [x] 의존성 설치·Python 버전 문제 있으면 `requirements.txt` 수정 — 문제 없음 (Python 3.14.4)

### STEP 10. 정기결제 C/R/D — Day 3 오전

- [x] `schemas/subscription.py` — `billing_cycle: Literal["WEEKLY","MONTHLY","YEARLY"]`
- [x] `routers/subscriptions.py` — `GET`, `POST`(EXPENSE 카테고리만), `DELETE /{id}` (**PATCH 없음**)
- [x] 확인: 3가지 주기 등록·목록·삭제, INCOME 카테고리 422, 등록/삭제 전후 거래 건수 변화 없음
- [x] 커밋: `feat(backend): 정기결제 등록/조회/삭제 API`

### STEP 11. 대시보드 집계 — Day 3 오전~오후

- [x] `schemas/dashboard.py`, `routers/dashboard.py`
  - `summary`: 선택 월 INCOME/EXPENSE 합계, 잔액
  - `expense_by_category`: 카테고리별 지출 합 내림차순
  - `monthly_compare`: 최근 6개월, 빈 달 0 채움, 오래된 달부터
- [x] 확인: 거래 목록 합계와 summary 일치, 원형 합 = 지출 합, 막대 항상 6개, 정기결제 금액 미포함
- [x] 커밋: `feat(backend): 대시보드 집계 API` → PR 병합

### STEP 12. CloudFront 경유 E2E 연결 — Day 3 오후

- [ ] EC2에서 `git pull` → `sudo systemctl restart <service>` → `journalctl`로 오류 확인
- [ ] CloudFront URL로 `/api/health`, 로그인, 거래 등록 확인 (Authorization 헤더 전달 여부)
- [ ] C와 정기결제·대시보드 화면 연동하며 필드명 불일치 즉시 수정

### STEP 13. 수동 테스트 보조 스크립트 — Day 3 종료 전

- [x] `scripts/smoke.sh` — `BASE_URL`을 인자로 받아 가입 → 로그인 → 거래 등록 → 정기결제 등록 → 대시보드 조회를 curl로 실행
- [ ] 로컬(`http://localhost:8000`)과 CloudFront URL 양쪽에서 실행 — 로컬·EC2 내부 51개 PASS, CloudFront 대기
- [x] 커밋: `chore(backend): 스모크 테스트 스크립트`

### STEP 14. 최종 검증·문서화·시연 준비 — Day 4

- [ ] 오전: §9 체크리스트 전부 수행 (특히 계정 A/B 교차 테스트, 집계 수치) — EC2 항목 외 완료 (smoke.sh 51개 PASS)
- [x] 오전: 오류 응답 상태 코드·`detail` 형식 일관성 정리
- [x] 오전: README 백엔드 섹션 (로컬 실행, 환경 변수 키, `init_db`, 스키마 변경 시 `ALTER TABLE` 절차)
- [ ] 오후: **신규 기능 금지**, 버그 수정만 → `main` 병합 → EC2 최종 배포
- [ ] 오후: EC2에 시연 계정·가상 데이터 입력, A의 `mariadb-dump` 백업·복원 확인 지원
- [ ] 오후: CloudFront 주소에서 전체 시연 리허설
