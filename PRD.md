# 개인 가계부 & 정기결제 관리 웹앱 — 최종 간소화 PRD v3.0

- 작성일: 2026-10-19
- 개발 기간: **4일(하루 8시간)**
- 팀: **3명(A AWS, B 백엔드, C 프론트엔드)**
- 개발 방식: AI 보조 개발 + GitHub 협업
- 최우선 목표: **핵심 기능 구현 → AWS 배포 완료**
- 문서 기준: 기존 `ledger_app_PRD_final.md` v2.0 및 Q1~Q14 최종 선택사항

## 1. 제품 개요 및 완료 기준

사용자가 직접 수입과 지출을 기록하고, 반복 결제 항목을 등록해 다음 방문 시 도래한 결제 건을 자동으로 가계부에 반영하며, 월별 지출을 차트로 확인하는 웹앱.

**완료 기준(DoD)**: CloudFront HTTPS 주소에서 회원가입·로그인 → 거래 CRUD → 정기결제 등록 → 결제일 도래 시 자동 지출 생성 → 대시보드 차트 표시가 동작한다. 데이터는 RDS에 저장되고, 다른 사용자 데이터는 조회·수정·삭제할 수 없다. 수동 테스트와 최종 배포를 완료한다.

### 1.1 범위

| 영역 | 반드시 구현 |
|---|---|
| 인증 | 이메일/아이디 기반 회원가입·로그인·로그아웃, 안전한 비밀번호 해시, JWT |
| 거래 | 수입/지출 등록·월별 조회·수정·삭제 |
| 카테고리 | 시스템 기본 카테고리 + 사용자별 카테고리 추가 |
| 정기결제 | 주간·월간·연간 정기결제 등록·조회·삭제 |
| 자동 반영 | 사용자 업무 API 조회 시 결제일 도래분을 지출 거래로 기록, 중복 방지 |
| 대시보드 | 선택 월 수입·지출·잔액, 카테고리별 지출 원형 차트, 최근 6개월 수입·지출 막대 차트 |
| 배포 | S3 + CloudFront, EC2 + systemd, RDS MariaDB, 수동 배포 |

**제외**: Cognito, Docker/Compose, Alembic, 정기결제 수정, 거래 유형·카테고리 필터/상세 검색, 카테고리 수정·삭제, 결제 완료·취소 관리, 정기결제 월 환산 금액/D-day 대시보드, AI/Bedrock/영수증 인식, Pytest 자동화, CI/CD/GitHub Actions, IaC, EventBridge/cron, 복잡한 UI 애니메이션, 회원 탈퇴/비밀번호 재설정/이메일 인증/소셜 로그인.

## 2. 기술 스택 및 AWS 아키텍처

- **Frontend**: React, Vite, Tailwind CSS, Recharts.
- **Backend**: Python, FastAPI, Pydantic, SQLAlchemy 2.x, PyMySQL, JWT, Argon2 등 안전한 비밀번호 해싱.
- **DB**: Amazon RDS MariaDB.
- **Hosting**: Amazon S3(정적 파일), Amazon CloudFront(HTTPS 진입점), Amazon EC2(FastAPI), Python venv + systemd.
- **협업**: Git/GitHub, 기능별 브랜치, 수동 배포.

```text
사용자 브라우저
  └─ HTTPS ─> CloudFront
                 ├─ /* ─────> S3 (React 정적 빌드)
                 └─ /api/* ─> EC2 (FastAPI + systemd)
                                  └─ RDS MariaDB
```

- 기본 VPC 활용, 별도 복잡한 VPC 구축은 제외.
- RDS 공개 액세스 비활성화. DB 3306 인바운드는 EC2 보안 그룹만 허용. RDS DB 서브넷 그룹은 최소 2개 AZ를 충족하도록 확인.
- CloudFront `/api/*` 동작은 캐시 비활성화, 필요한 HTTP 메서드 허용, `Authorization` 헤더 및 쿼리 전달. `/api/*` 오류를 SPA `index.html`로 치환하지 않는다.
- **중요**: 브라우저↔CloudFront HTTPS가 CloudFront↔EC2 구간의 HTTPS를 보장하지 않는다. 실사용 금융 데이터에는 원본 구간 HTTPS가 필요하다. 테스트·학습 환경에서는 가상 데이터를 사용하고 HTTP 원본의 위험을 문서화한다.
- JWT 서명키, DB 비밀번호 등은 환경 변수/제한된 권한 파일로 관리하고 Git에 올리지 않는다. JWT 만료 및 서명 검증, 서버 측 사용자 소유권 검증을 적용한다.

## 3. 기능 명세

### 3.1 회원가입·로그인

- 회원가입: 중복되지 않는 로그인 식별자(예: 이메일), 비밀번호 입력. 비밀번호는 Argon2 등으로 해싱해 저장.
- 로그인: 자격 증명 확인 후 서버에서 JWT 발급.
- 로그아웃: 클라이언트의 인증 상태/토큰 제거.
- 보호 API: `Authorization: Bearer <token>` 검증, 사용자 ID는 검증된 JWT에서만 취득.
- 단순 MVP에서는 비밀번호 재설정, 이메일 검증, 소셜 로그인 제외.
- 브라우저의 토큰 저장 방식은 XSS 위험을 고려해 결정하고, 실제 운영 서비스에서 장기 토큰을 무방비로 localStorage에 보관하지 않는다.

### 3.2 거래 관리

- 필수: 유형(`INCOME`/`EXPENSE`), 금액(1원 이상 정수), 거래일, 카테고리.
- 선택: 사용처/가맹점, 메모.
- 기능: 등록, 선택 월 목록 조회, 수정, 삭제.
- 거래 유형과 카테고리 유형은 일치해야 하며, 사용자 본인의 카테고리 또는 시스템 카테고리만 사용 가능.
- 별도 유형 필터, 카테고리 필터, 금액·날짜 범위 검색, 고급 정렬은 구현하지 않음.
- 자동 생성된 정기결제 거래도 거래 목록에 표시하고 출처를 구분한다. 사용자는 해당 거래를 수정하거나 삭제할 수 있다.

### 3.3 카테고리

- 기본 지출: 식비, 교통, 주거·통신, 쇼핑, 여가·문화, 의료·건강, 교육, 구독·정기결제, 기타지출.
- 기본 수입: 급여, 용돈, 부수입, 기타수입.
- 사용자는 수입/지출 유형을 선택해 개인 카테고리를 추가 가능.
- 기본 카테고리는 전 사용자 공유(`user_id = NULL`), 사용자 카테고리는 본인만 조회·사용 가능.
- 카테고리 수정/삭제 기능 없음.

### 3.4 정기결제

- 입력: 서비스명, 결제 금액, 결제 주기(`WEEKLY`/`MONTHLY`/`YEARLY`), 결제 기준일, 지출 카테고리, 선택 메모.
- 등록, 목록 조회, 삭제만 구현. **수정 API 및 수정 UI 없음**. 변경이 필요하면 삭제 후 재등록.
- 등록 시점 이전 결제분은 생성하지 않는다.
- 삭제 후 향후 자동 지출은 생성되지 않는다. 과거에 생성된 거래는 유지한다.
- 기존 PRD의 서비스 프리셋은 선택 입력 편의 기능으로만 취급하며 4일 MVP 필수 구현에서는 제외할 수 있다.

### 3.5 접속 시 자동 반영

- 사용자가 거래 목록, 정기결제 목록, 대시보드 조회 API를 호출하면 백엔드가 해당 사용자의 미반영 결제일을 확인한다.
- KST(`Asia/Seoul`) 날짜 기준으로 등록일 이후부터 오늘까지 도래한 결제일에 대해 `EXPENSE` 거래를 생성한다.
- 주간(7일), 월간(매월 같은 날짜), 연간(매년 같은 월/일) 주기를 지원. 해당 월에 기준일이 없으면 말일로 조정(예: 31일 → 2월 말일). 연간 2월 29일도 해당 연도 말일 조정 규칙을 적용한다.
- 여러 날 방문하지 않아도 다음 조회 때 누락분을 생성한다.
- `synced_through` 등 동기화 진행 상태와 `UNIQUE(subscription_id, due_date)`를 활용해 같은 결제일 중복 생성을 방지한다. 동시 요청을 고려해 DB 트랜잭션으로 처리한다.
- 사용자가 자동 생성된 거래를 삭제해도 다시 생성되지 않도록 동기화 진행 상태를 보존한다.
- 자동 기록은 **실제 카드/은행 결제 확인이 아닌 일정 기반 가계부 기록**임을 UI에 표시한다.
- 별도 스케줄러, cron, EventBridge는 사용하지 않는다.

### 3.6 대시보드

- 월별 총수입, 총지출, 잔액(수입-지출) 카드.
- 선택 월 카테고리별 지출 원형 차트.
- 최근 6개월 월별 수입·지출 막대 차트.
- 정기결제 월 환산 비용, 결제 예정 D-day 알림은 제외.
- 데이터는 백엔드 집계 API에서 제공하며 프론트엔드에서 Recharts로 표현.

### 3.7 화면/UI

- `/login`, `/register`: 로그인·회원가입.
- `/dashboard`: 월 선택, 요약 카드 3개, 차트 2개.
- `/transactions`: 월별 거래 테이블, 등록·수정 모달, 삭제 확인.
- `/subscriptions`: 정기결제 목록, 등록 모달, 삭제 확인.
- 상단 내비게이션, 기본 반응형. 복잡한 사이드바/애니메이션/모바일 전용 레이아웃 제외.

## 4. 데이터베이스 설계

SQLAlchemy `Base.metadata.create_all(bind=engine)`를 초기 테이블 생성에 사용한다. **create_all은 기존 테이블 구조를 변경하지 않으므로**, 개발 중 스키마 변경은 명시적 `ALTER TABLE`로 반영하거나 데이터 보존이 필요 없는 초기 개발 DB에서만 재생성한다. 운영 데이터에 대해 임의 DROP 금지.

### 4.1 `users`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGINT PK | 사용자 ID |
| `email` | VARCHAR(255) UNIQUE NOT NULL | 로그인 식별자 |
| `password_hash` | VARCHAR(255) NOT NULL | 해시 비밀번호 |
| `created_at` | DATETIME | UTC |

### 4.2 `categories`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGINT PK | 카테고리 ID |
| `user_id` | BIGINT FK NULL | NULL=시스템 기본 카테고리 |
| `name` | VARCHAR(30) NOT NULL | 이름 |
| `type` | VARCHAR(10) NOT NULL | INCOME/EXPENSE |
| `created_at` | DATETIME | UTC |

### 4.3 `subscriptions`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGINT PK | 정기결제 ID |
| `user_id` | BIGINT FK NOT NULL | 소유자 |
| `name` | VARCHAR(120) NOT NULL | 서비스명 |
| `category_id` | BIGINT FK NOT NULL | 지출 카테고리 |
| `amount_krw` | INT NOT NULL | 결제 금액(1 이상) |
| `billing_cycle` | VARCHAR(10) NOT NULL | WEEKLY/MONTHLY/YEARLY |
| `billing_anchor_date` | DATE NOT NULL | 결제 기준일 |
| `registered_on` | DATE NOT NULL | 등록일(KST) |
| `synced_through` | DATE NOT NULL | 마지막 반영 기준일 |
| `memo` | VARCHAR(500) NULL | 메모 |
| `created_at` | DATETIME | UTC | 

### 4.4 `transactions`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGINT PK | 거래 ID |
| `user_id` | BIGINT FK NOT NULL | 소유자 |
| `type` | VARCHAR(10) NOT NULL | INCOME/EXPENSE |
| `amount_krw` | INT NOT NULL | 금액(1 이상) |
| `occurred_on` | DATE NOT NULL | 거래일 |
| `category_id` | BIGINT FK NOT NULL | 카테고리 |
| `merchant` | VARCHAR(100) NULL | 사용처 |
| `memo` | VARCHAR(500) NULL | 메모 |
| `subscription_id` | BIGINT FK NULL | 자동 반영 원본, `ON DELETE SET NULL` |
| `due_date` | DATE NULL | 자동 반영 결제일 |
| `created_at`, `updated_at` | DATETIME | UTC |

- 인덱스: `transactions(user_id, occurred_on)`, `subscriptions(user_id)`, `categories(user_id)`.
- 중복 방지: `UNIQUE(transactions.subscription_id, transactions.due_date)`.
- 소유권은 **모든 읽기/쓰기 쿼리**에서 `user_id`로 확인. 클라이언트가 보낸 `user_id`를 신뢰하지 않음.
- 정기결제 삭제 시 과거 거래의 `subscription_id`는 NULL이 되지만 거래는 남음.

## 5. API 명세

모든 업무 API는 `/api` 접두어 사용. 인증·헬스 엔드포인트를 제외하고 Bearer JWT 필수.

| Method | Endpoint | 설명 |
|---|---|---|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 및 JWT 발급 |
| GET | `/api/auth/me` | 현재 로그인 사용자 확인(선택적 구현) |
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api/categories` | 기본 + 내 카테고리 목록 |
| POST | `/api/categories` | 개인 카테고리 추가 |
| GET | `/api/transactions?month=YYYY-MM` | 선택 월 거래 조회 및 자동 반영 |
| POST | `/api/transactions` | 거래 등록 |
| PATCH | `/api/transactions/{id}` | 거래 수정 |
| DELETE | `/api/transactions/{id}` | 거래 삭제 |
| GET | `/api/subscriptions` | 정기결제 목록 및 자동 반영 |
| POST | `/api/subscriptions` | 정기결제 등록 |
| DELETE | `/api/subscriptions/{id}` | 정기결제 삭제 |
| GET | `/api/dashboard?month=YYYY-MM` | 자동 반영 후 대시보드 통계 |

**삭제된 API**: `PATCH /api/subscriptions/{id}`. 거래 목록의 `type`, `category_id` 필터 쿼리도 제외.

대시보드 응답 예시:

```json
{
  "month": "2026-10",
  "summary": {"income_krw": 1000000, "expense_krw": 350000, "balance_krw": 650000},
  "expense_by_category": [{"category_id": 1, "name": "식비", "amount_krw": 120000}],
  "monthly_compare": [{"month": "2026-05", "income_krw": 900000, "expense_krw": 400000}]
}
```

- Pydantic 입력 검증. 401 인증 실패, 404 비존재/타 사용자 자원, 422 유효하지 않은 입력·카테고리, 409 중복 계정 등 충돌.
- 월 조회는 `YYYY-MM` 형식. 오류는 `{"detail": ...}` 형식으로 일관되게 반환.
- 목록 응답 형식, 필드명, 날짜 포맷은 **Day 1에 백엔드·프론트엔드 간 확정**.

## 6. 3인 역할 분담

| 담당 | 책임 | 구체적 산출물 |
|---|---|---|
| **A — AWS 인프라·배포** | EC2, RDS, S3, CloudFront, 보안 그룹, 환경 변수, systemd, 수동 배포, 배포 장애 대응 | 접속 가능한 URL, 배포 가이드, 인프라 설정 |
| **B — 백엔드·DB** | 사용자·카테고리·거래·정기결제 모델, 인증/JWT, 전체 API, 날짜 계산/동기화, 대시보드 집계 | FastAPI 서버, DB 초기화, API 계약 |
| **C — 프론트엔드** | React/Vite/Tailwind, 로그인·회원가입, 거래·정기결제 화면, 대시보드/Recharts, API 연동 | 동작하는 웹 UI |

**작업량 관리**: B의 담당량이 가장 많다. A는 Day 2부터 서버 실행/배포 오류와 API 수동 검증을 지원한다. C는 Day 1에 백엔드 API 계약에 맞춰 목 데이터를 이용해 화면을 먼저 제작한다.

## 7. 4일 실행 계획

| 일차 | A 인프라 | B 백엔드 | C 프론트엔드 | 완료 조건 |
|---|---|---|---|---|
| **Day 1** | AWS 리소스 및 RDS 생성 | 프로젝트·DB 모델·인증 API·스키마 합의 | Vite/Tailwind·라우팅·로그인 UI | 인증/DB 연결 기초 확보 |
| **Day 2** | EC2 Python venv, systemd, DB 네트워크 확인 | 카테고리·거래 CRUD | 거래 목록·등록·수정 UI | 거래 등록/조회/수정/삭제 동작 |
| **Day 3** | S3·CloudFront·API 오리진 연결 | 정기결제·자동 반영·대시보드 API | 정기결제 UI·차트·API 연동 | 핵심 기능 E2E 연결 |
| **Day 4** | 최종 수동 배포·장애 대응 | 소유권·중복 반영·집계 오류 수정 | UI 점검·시연 시나리오 | CloudFront 주소에서 전체 시연 성공 |

- Day 4 오후에는 기능 추가 중지, 버그 수정 및 시연 준비 우선.
- 병렬 작업: API 요청/응답 스키마를 Day 1에 먼저 합의. `main`은 배포 가능한 상태 유지.

## 8. 수동 테스트 체크리스트

- [ ] 신규 회원가입 및 중복 회원가입 거부
- [ ] 올바른/틀린 비밀번호 로그인, 로그아웃, 보호 API의 인증 차단
- [ ] 계정 A의 거래·정기결제·카테고리를 계정 B가 볼 수 없고 ID를 알아도 수정·삭제 불가
- [ ] 수입·지출 거래 등록/월별 조회/수정/삭제
- [ ] 기본 카테고리 조회, 개인 카테고리 추가 및 사용자별 분리
- [ ] 정기결제 등록·목록·삭제
- [ ] 주간·월간·연간 자동 반영, 31일/2월 말일 및 윤년 경계
- [ ] 같은 조회 API를 반복 호출해도 중복 지출 생성되지 않음
- [ ] 자동 생성 거래 삭제 후 다시 조회해도 재생성되지 않음
- [ ] 정기결제 삭제 후 과거 거래 유지, 이후 결제일에는 새 거래 없음
- [ ] 월 수입·지출·잔액과 카테고리 원형 차트, 최근 6개월 막대 차트 수치 일치
- [ ] CloudFront 프론트엔드 접속, API 연결, EC2 재시작 후 systemd 자동 복구, RDS 저장 확인

**자동화 테스트(Pytest)는 이번 범위에서 제외**하되 보안과 중복 반영은 수동으로 필수 검증한다.

## 9. 수동 배포 절차

### 프론트엔드

1. `npm install` 및 `npm run build` 실행.
2. 생성된 `dist/` 파일을 S3 버킷에 업로드.
3. CloudFront 캐시 무효화(필요한 경로만) 실행.
4. CloudFront HTTPS URL로 접속해 SPA 라우팅 및 API 연동 확인.

### 백엔드

1. EC2에서 GitHub 저장소 `git pull`.
2. Python 가상환경 활성화 후 의존성 설치.
3. DB 접속·JWT 환경 변수 점검 및 최초 테이블 초기화(`create_all()`).
4. `sudo systemctl restart <service-name>` 및 `sudo systemctl status <service-name>`.
5. `journalctl -u <service-name> -n 100 --no-pager`로 로그 확인.
6. `/api/health` 및 실제 인증·거래 요청으로 연결 검증.

**참고**: systemd 실행 경로, 서비스명, EC2 오리진 포트, CloudFront 원본 연결 방식은 Day 1~2에 A가 확정하고 README에 기록한다. `create_all()`은 스키마 변경을 자동 적용하지 않는다.

## 10. 협업 및 문서 산출물

- GitHub 브랜치 예: `feat/aws`, `feat/backend`, `feat/frontend`.
- Day 1에 API 계약/필드명/라우팅을 합의하고 변경 시 전원 공유.
- DB 비밀번호, JWT 서명키, AWS 액세스 키는 Git 및 AI 프롬프트에 포함하지 않는다.
- README에 로컬 실행, 환경 변수 목록(값 제외), DB 초기화, 수동 배포, 장애 해결, 시연 절차를 기록한다.
- 제출 산출물: GitHub 소스, 배포 URL, 수동 테스트 체크리스트, 아키텍처 설명, 시연 화면.

## 11. 최종 확정 사항(Q1~Q14)

| 질문 | 결정 |
|---|---|
| Q1 | Cognito 제외 → FastAPI 자체 로그인 + JWT |
| Q2 | Docker 제외 → Python venv + systemd |
| Q3 | 기본 AWS 3계층(S3/CloudFront, EC2, RDS) |
| Q4 | 접속 시 정기결제 자동 반영 |
| Q5 | Alembic 제외 → SQLAlchemy `create_all()` |
| Q6 | 기본 카테고리 + 사용자 추가 |
| Q7 | 기본 대시보드(요약 카드 + 원형/막대 차트) |
| Q8 | 정기결제 등록·조회·삭제만 |
| Q9 | 수동 테스트만 |
| Q10 | 수동 배포만 |
| Q11 | AI 기능 완전히 제외 |
| Q12 | 거래 기본 CRUD + 월별 조회만 |
| Q13 | Tailwind 기반 깔끔한 기본 UI |
| Q14 | 3인 팀: AWS 1명 + 백엔드 1명 + 프론트엔드 1명 |

---

**핵심 원칙**: 기능 추가보다 로그인 → 거래 CRUD → 정기결제 자동 반영 → 대시보드 → AWS 배포가 끝까지 동작하는 것을 우선한다.
