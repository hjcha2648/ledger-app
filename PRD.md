# 개인 가계부 & 정기결제 관리 웹앱 — 최종 확정 PRD v3.2 — EC2 MariaDB · 정기결제 목록 관리형

- 작성일: 2026-10-19
- 개발 기간: **4일(하루 8시간)**
- 팀: **3명(A AWS, B 백엔드, C 프론트엔드)**
- 개발 방식: AI 보조 개발 + GitHub 협업
- 최우선 목표: **핵심 기능 구현 → AWS 배포 완료**
- 문서 기준: 기존 PRD v3.1 및 Q1~Q16 최종 선택사항

> **추가 범위 (2026-10-20)**: AI 가계부 챗봇 · 월간 명세서 메일 · 영수증 인식 3개 기능은 [PLAN.md](PLAN.md)에 적힌 범위 안에서 예외로 허용한다. 요약은 [15장](#15-추가-기능-2026-10-20-planmd), 범위 규칙은 [AGENTS.md](AGENTS.md) 4번.

## 1. 제품 개요 및 완료 기준

사용자가 수입·지출을 직접 기록하고, 정기결제 서비스의 이름·금액·주기·결제일을 별도 목록으로 관리하며, 월별 수입·지출 통계를 차트로 확인하는 웹앱. 정기결제는 **관리 목록일 뿐 거래에 자동·수동 반영되지 않는다**.

**완료 기준(DoD)**: CloudFront HTTPS 주소에서 회원가입·로그인 → 거래 CRUD → 정기결제 등록·목록·삭제 → 대시보드 차트 표시가 동작한다. 데이터는 EC2 내부 MariaDB에 저장되고, 다른 사용자 데이터는 조회·수정·삭제할 수 없다. 수동 테스트와 최종 배포를 완료한다.

### 1.1 범위

| 영역 | 반드시 구현 |
|---|---|
| 인증 | 이메일/아이디 기반 회원가입·로그인·로그아웃, 안전한 비밀번호 해시, JWT |
| 거래 | 수입/지출 등록·월별 조회·수정·삭제 |
| 카테고리 | 시스템 기본 카테고리 + 사용자별 카테고리 추가 |
| 정기결제 | 주간·월간·연간 정기결제 등록·조회·삭제 |
| 대시보드 | 선택 월 수입·지출·잔액, 카테고리별 지출 원형 차트, 최근 6개월 수입·지출 막대 차트 |
| 배포 | S3 + CloudFront, EC2(FastAPI + MariaDB) + systemd, 수동 배포 |

**제외**: Cognito, Docker/Compose, Alembic, 정기결제 수정, **정기결제의 자동·수동 거래 반영**, 결제일 도래 계산·스케줄러·중복 반영 방지, 거래 유형·카테고리 필터/상세 검색, 카테고리 수정·삭제, 결제 완료·취소 관리, 정기결제 월 환산 금액/D-day 대시보드, AI/Bedrock/영수증 인식(단, 15장의 추가 기능 3개는 예외), Pytest 자동화, CI/CD/GitHub Actions, IaC, EventBridge/cron, 복잡한 UI 애니메이션, 회원 탈퇴/비밀번호 재설정/이메일 인증/소셜 로그인.

## 2. 기술 스택 및 AWS 아키텍처

- **Frontend**: React, Vite, Tailwind CSS, Recharts.
- **Backend**: Python, FastAPI, Pydantic, SQLAlchemy 2.x, PyMySQL, JWT, Argon2 등 안전한 비밀번호 해싱.
- **DB**: MariaDB 직접 운영. 로컬 개발은 기존 WSL Ubuntu MariaDB, AWS 배포는 EC2 인스턴스 내부 MariaDB. RDS 미사용.
- **Hosting**: Amazon S3(정적 파일), Amazon CloudFront(HTTPS 진입점), Amazon EC2(FastAPI + MariaDB), Python venv + systemd.
- **협업**: Git/GitHub, 기능별 브랜치, 수동 배포.

```text
사용자 브라우저
  └─ HTTPS ─> CloudFront
                 ├─ /* ─────> S3 (React 정적 빌드)
                 └─ /api/* ─> EC2 (FastAPI + systemd)
                                  └─ EC2 내부 MariaDB (127.0.0.1:3306)
```

- 기본 VPC 활용, 별도 복잡한 VPC 구축은 제외.
- **RDS는 생성하지 않는다.** 로컬 개발 시 FastAPI는 WSL Ubuntu의 기존 MariaDB에 접속한다. 배포 시 EC2 내부에 MariaDB를 설치하고 FastAPI는 `127.0.0.1:3306`으로 접속한다.
- MariaDB는 EC2 내부 루프백 주소에만 바인딩하고 보안 그룹에서 3306 인바운드를 개방하지 않는다. DB 애플리케이션 전용 계정에 필요한 DB 권한만 부여한다.
- EC2 한 대에 API와 DB가 공존하므로 EC2 장애 시 양쪽 모두 중단된다. 시연 전 `mariadb-dump` 백업과 복원 검증을 수행하고 실제 금융정보 대신 가상 데이터를 사용한다.
- **로컬 DB와 EC2 DB는 별개**다. 초기 개발 단계에서는 동일한 SQLAlchemy 모델로 EC2 DB를 생성하고 시연용 데이터를 새로 넣는다. 데이터 이전이 필요한 경우 별도 덤프/복원 절차를 사용한다.
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
- 거래 내역은 사용자가 직접 등록한 수입·지출만 포함한다. 정기결제 목록의 금액은 거래 내역 및 대시보드 합계에 포함하지 않는다.

### 3.3 카테고리

- 기본 지출: 식비, 교통, 주거·통신, 쇼핑, 여가·문화, 의료·건강, 교육, 구독·정기결제, 기타지출.
- 기본 수입: 급여, 용돈, 부수입, 기타수입.
- 사용자는 수입/지출 유형을 선택해 개인 카테고리를 추가 가능.
- 기본 카테고리는 전 사용자 공유(`user_id = NULL`), 사용자 카테고리는 본인만 조회·사용 가능.
- 카테고리 수정/삭제 기능 없음.

### 3.4 정기결제 — C 방식: 목록 관리만

- 목적: 넷플릭스·유튜브 프리미엄 등 반복 결제 서비스를 **별도 목록으로 관리**한다.
- 입력: 서비스명(필수), 결제 금액(1원 이상, 필수), 결제 주기(`WEEKLY`/`MONTHLY`/`YEARLY`, 필수), 결제 기준일(필수), 지출 카테고리(필수), 메모(선택).
- 기능은 **등록(Create) · 목록 조회(Read) · 삭제(Delete)**만 제공한다. 수정 기능은 제외하고 변경 시 삭제 후 재등록한다.
- 결제 주기와 기준일은 **사용자가 참고하는 표시 정보**다. 날짜 도래 여부 계산, 알림, 결제 예정일 예측은 하지 않는다.
- **자동 지출 생성 없음, 수동 '가계부에 추가' 버튼 없음, 거래 테이블과 자동 연결 없음.** 사용자가 실제 지출을 가계부에 기록하려면 거래 관리 화면에서 별도로 직접 입력한다.
- 정기결제 삭제는 해당 목록 항목만 삭제하며 기존 거래 내역에는 영향을 주지 않는다.
- 정기결제 금액은 대시보드 수입·지출·잔액·차트에 자동 합산하지 않는다.

### 3.5 정기결제 범위 제외 사항

- 접속 시 자동 반영(lazy sync), 매주·매월·매년 결제일 계산, 누락분 소급 생성, 중복 방지 및 `synced_through` 상태 관리 **모두 삭제**.
- 결제 완료/취소 상태, 자동 이체·실제 카드 결제, 은행/카드 연동, D-day 알림, 월 환산 금액 계산 **구현하지 않음**.

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
| `created_at`, `updated_at` | DATETIME | UTC |

- 인덱스: `transactions(user_id, occurred_on)`, `subscriptions(user_id)`, `categories(user_id)`.
- 소유권은 **모든 읽기/쓰기 쿼리**에서 `user_id`로 확인. 클라이언트가 보낸 `user_id`를 신뢰하지 않음.
- 정기결제와 거래는 별개의 테이블이며 FK로 직접 연결하지 않는다. 정기결제를 삭제해도 거래 내역은 변하지 않는다.

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
| GET | `/api/transactions?month=YYYY-MM` | 선택 월 거래 조회 |
| POST | `/api/transactions` | 거래 등록 |
| PATCH | `/api/transactions/{id}` | 거래 수정 |
| DELETE | `/api/transactions/{id}` | 거래 삭제 |
| GET | `/api/subscriptions` | 내 정기결제 목록 조회 |
| POST | `/api/subscriptions` | 정기결제 등록 |
| DELETE | `/api/subscriptions/{id}` | 정기결제 삭제 |
| GET | `/api/dashboard?month=YYYY-MM` | 직접 입력한 거래 기준 대시보드 통계 |

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
| **A — AWS 인프라·배포** | EC2, EC2 MariaDB 설치·백업, S3, CloudFront, 보안 그룹, 환경 변수, systemd, 수동 배포, 배포 장애 대응 | 접속 가능한 URL, 배포 가이드, 인프라 설정 |
| **B — 백엔드·DB** | 사용자·카테고리·거래·정기결제 모델, 인증/JWT, 전체 API, 대시보드 집계 | FastAPI 서버, DB 초기화, API 계약 |
| **C — 프론트엔드** | React/Vite/Tailwind, 로그인·회원가입, 거래·정기결제 화면, 대시보드/Recharts, API 연동 | 동작하는 웹 UI |

**작업량 관리**: B의 담당량이 가장 많다. A는 Day 2부터 서버 실행/배포 오류와 API 수동 검증을 지원한다. C는 Day 1에 백엔드 API 계약에 맞춰 목 데이터를 이용해 화면을 먼저 제작한다.

## 7. 4일 실행 계획

| 일차 | A 인프라 | B 백엔드 | C 프론트엔드 | 완료 조건 |
|---|---|---|---|---|
| **Day 1** | EC2 생성, MariaDB 배포 구성 설계 | 프로젝트·DB 모델·인증 API·스키마 합의 | Vite/Tailwind·라우팅·로그인 UI | 인증/DB 연결 기초 확보 |
| **Day 2** | EC2 MariaDB 설치, Python venv, systemd, 로컬 DB 접속 확인 | 카테고리·거래 CRUD | 거래 목록·등록·수정 UI | 거래 등록/조회/수정/삭제 동작 |
| **Day 3** | S3·CloudFront·API 오리진 연결 | 정기결제 목록 CRUD 중 C/R/D·대시보드 API | 정기결제 UI·차트·API 연동 | 핵심 기능 E2E 연결 |
| **Day 4** | 최종 수동 배포·장애 대응 | 소유권·입력 검증·집계 오류 수정 | UI 점검·시연 시나리오 | CloudFront 주소에서 전체 시연 성공 |

- Day 4 오후에는 기능 추가 중지, 버그 수정 및 시연 준비 우선.
- 병렬 작업: API 요청/응답 스키마를 Day 1에 먼저 합의. `main`은 배포 가능한 상태 유지.

## 8. 수동 테스트 체크리스트

- [ ] 신규 회원가입 및 중복 회원가입 거부
- [ ] 올바른/틀린 비밀번호 로그인, 로그아웃, 보호 API의 인증 차단
- [ ] 계정 A의 거래·정기결제·카테고리를 계정 B가 볼 수 없고 ID를 알아도 수정·삭제 불가
- [ ] 수입·지출 거래 등록/월별 조회/수정/삭제
- [ ] 기본 카테고리 조회, 개인 카테고리 추가 및 사용자별 분리
- [ ] 정기결제 등록·목록·삭제
- [ ] 정기결제 주기(WEEKLY/MONTHLY/YEARLY), 결제 기준일, 금액을 등록·표시·삭제할 수 있음
- [ ] 정기결제 등록/조회/삭제 시 거래가 자동으로 추가되지 않음
- [ ] 정기결제 금액이 대시보드 지출 통계에 자동 포함되지 않음
- [ ] 정기결제 삭제가 기존 수입·지출 내역을 변경하지 않음
- [ ] 월 수입·지출·잔액과 카테고리 원형 차트, 최근 6개월 막대 차트 수치 일치
- [ ] CloudFront 프론트엔드 접속, API 연결, EC2 재시작 후 systemd 및 MariaDB 자동 복구, EC2 MariaDB 저장 확인

**자동화 테스트(Pytest)는 이번 범위에서 제외**하되 인증·사용자별 데이터 격리·거래 집계는 수동으로 필수 검증한다.

## 9. 수동 배포 절차

### 프론트엔드

1. `npm install` 및 `npm run build` 실행.
2. 생성된 `dist/` 파일을 S3 버킷에 업로드.
3. CloudFront 캐시 무효화(필요한 경로만) 실행.
4. CloudFront HTTPS URL로 접속해 SPA 라우팅 및 API 연동 확인.

### 백엔드

1. EC2에서 GitHub 저장소 `git pull`.
2. Python 가상환경 활성화 후 의존성 설치.
3. EC2 내부 MariaDB(`127.0.0.1:3306`) 접속·JWT 환경 변수 점검 및 최초 테이블 초기화(`create_all()`).
4. `sudo systemctl restart <service-name>` 및 `sudo systemctl status <service-name>`.
5. `journalctl -u <service-name> -n 100 --no-pager`로 로그 확인.
6. `/api/health` 및 실제 인증·거래 요청으로 연결 검증.
7. 시연 전 MariaDB 덤프 백업을 생성하고 복원 가능 여부를 확인한다.

**참고**: systemd 실행 경로, 서비스명, EC2 오리진 포트, CloudFront 원본 연결 방식은 Day 1~2에 A가 확정하고 README에 기록한다. `create_all()`은 스키마 변경을 자동 적용하지 않는다.

## 10. 협업 및 문서 산출물

- GitHub 브랜치 예: `feat/infra`, `feat/backend`, `feat/frontend`.
- Day 1에 API 계약/필드명/라우팅을 합의하고 변경 시 전원 공유.
- DB 비밀번호, JWT 서명키, AWS 액세스 키는 Git 및 AI 프롬프트에 포함하지 않는다.
- README에 로컬 실행, 환경 변수 목록(값 제외), DB 초기화, 수동 배포, 장애 해결, 시연 절차를 기록한다.
- 제출 산출물: GitHub 소스, 배포 URL, 수동 테스트 체크리스트, 아키텍처 설명, 시연 화면.

## 11. 최종 확정 사항(Q1~Q16)

| 질문 | 결정 |
|---|---|
| Q1 | Cognito 제외 → FastAPI 자체 로그인 + JWT |
| Q2 | Docker 제외 → Python venv + systemd |
| Q3 | S3/CloudFront + EC2(FastAPI + MariaDB), RDS 제외 |
| Q4 | 기존 자동 반영 방식 폐기 → 정기결제 목록 관리만 |
| Q5 | Alembic 제외 → SQLAlchemy `create_all()` |
| Q6 | 기본 카테고리 + 사용자 추가 |
| Q7 | 기본 대시보드(요약 카드 + 원형/막대 차트) |
| Q8 | 정기결제 등록·조회·삭제만 |
| Q9 | 수동 테스트만 |
| Q10 | 수동 배포만 |
| Q11 | AI 기능 완전히 제외 → 2026-10-20 변경: 15장의 추가 기능 3개만 허용 |
| Q12 | 거래 기본 CRUD + 월별 조회만 |
| Q13 | Tailwind 기반 깔끔한 기본 UI |
| Q14 | 3인 팀: AWS 1명 + 백엔드 1명 + 프론트엔드 1명 |
| Q15 | RDS 완전 제외: WSL MariaDB로 개발, EC2 내부 MariaDB로 배포 |
| Q16 | 정기결제 C 방식: 등록·조회·삭제만, 거래 자동/수동 반영 없음 |

---

## 12. MariaDB 환경 구성 및 배포 점검 (v3.2 유지)

### 12.1 로컬 개발 (WSL Ubuntu)

- 기존 WSL MariaDB를 사용한다. 개발 DB `ledger_db` 및 애플리케이션 전용 계정을 준비한다.
- `DATABASE_URL`은 로컬 접속 주소를 사용한다. 예: `mysql+pymysql://app_user:<password>@127.0.0.1:3306/ledger_db`.
- DB 접속 정보는 `.env`에 두고 `.gitignore`에 등록한다. `.env.example`에는 키 이름과 예시만 기재한다.
- `users`, `categories`, `transactions`, `subscriptions`는 SQLAlchemy 모델을 기반으로 초기 생성한다.

### 12.2 AWS 배포 (EC2 단일 인스턴스)

1. EC2에 MariaDB 서버를 설치하고 부팅 시 자동 시작되도록 설정한다. Linux 배포판에 맞춰 `apt` 또는 `dnf`를 사용한다.
2. MariaDB `bind-address=127.0.0.1` 및 3306 외부 인바운드 차단을 확인한다.
3. 전용 DB와 최소 권한 애플리케이션 계정을 생성한다. 루트 DB 계정으로 API를 실행하지 않는다.
4. FastAPI용 Python 가상환경을 만들고 DB 연결 URL 및 JWT 비밀키를 EC2 서버의 제한된 권한 환경 파일에 저장한다.
5. SQLAlchemy `create_all()`로 초기 스키마를 만들고 기본 카테고리를 등록한다.
6. FastAPI를 systemd로 실행한다. CloudFront `/api/*` 요청 전달과 API 인증 헤더를 검증한다.
7. `mariadb-dump`로 백업하고 복원 절차를 README에 기록한다. EC2 인스턴스의 EBS 영속성 및 장애 시 복구 한계를 설명한다.
8. 로컬 WSL DB와 EC2 DB는 동기화되지 않으므로 시연 데이터는 EC2에 별도로 등록하거나 명시적으로 덤프/복원한다.

### 12.3 보안 및 범위 주의

- 로그인 비밀번호는 Argon2 등 안전한 해시로만 저장한다. JWT 검증과 사용자별 소유권 확인은 서버에서 수행한다.
- CloudFront HTTPS와 별개로 CloudFront→EC2 원본 연결은 HTTPS를 권장한다. HTTPS 원본 구성이 불가능한 단기 학습 시연에서는 **가상 데이터만** 사용하고 보안 한계를 명시한다.
- RDS가 제공하던 관리형 백업·가용성·자동 유지보수는 더 이상 제공되지 않는다. 실제 운영 서비스용 구성으로 간주하지 않는다.

### 12.4 4일 일정에서 우선순위

- **필수:** 로그인/회원가입, 거래 CRUD, 정기결제 등록·조회·삭제(목록 관리만), 대시보드, AWS 배포.
- **Day 1 종료:** 로컬 DB 연결, 인증 API, 프론트 로그인 화면 기초.
- **Day 2 종료:** 거래 CRUD API와 프론트 연동, EC2 MariaDB/서버 구동.
- **Day 3 종료:** 정기결제 목록/대시보드 통합, CloudFront에서 API 연결.
- **Day 4:** 신규 기능 중단, 사용자 격리·정기결제 목록·배포·백업 테스트 및 시연.

## 13. 구현 난이도 및 리스크 (v3.2 재평가)

- **종합 난이도: 초중급~중급, 약 5.5/10** (3명 × 4일 × 8시간, AI 보조 개발을 전제한 주관적 추정).
- AWS 인프라 6/10, FastAPI·MariaDB 6.5/10, 정기결제 목록 2/10, React 6/10, 최종 통합 7/10.
- 이전 v3.1(약 6.5/10)에서 가장 복잡했던 결제일 계산·소급 생성·중복 방지 로직이 사라져 백엔드 부담이 줄어든다.
- 주요 위험은 여전히 JWT 인증과 사용자별 데이터 격리, 프론트/API 필드명 불일치, CloudFront→EC2 API 연결, EC2 내부 MariaDB 운영·백업이다.
- **완료 우선순위**: 회원가입/로그인 → 거래 CRUD → 정기결제 목록 CRUD 중 C/R/D → 대시보드 → AWS 배포.
- Day 1에 API 요청/응답 형식을 확정하고 Day 1~3에 기능별 PR을 수시 병합한다. Day 4에는 기능 추가를 중단한다.

## 14. 구현 시 반드시 지킬 간소화 규칙

1. 정기결제 데이터는 `subscriptions` 테이블에서만 관리한다. `transactions`와 관계를 만들지 않는다.
2. `subscriptions`에서 `registered_on`, `synced_through`를 제거한다. `transactions`에서 `subscription_id`, `due_date`를 제거한다.
3. 정기결제 관련 백그라운드 작업·스케줄러·날짜 계산 함수·중복 방지 인덱스를 만들지 않는다.
4. `/api/subscriptions`의 GET/POST와 `/api/subscriptions/{id}`의 DELETE만 구현한다.
5. 프론트엔드 정기결제 화면에는 목록, 등록 폼, 삭제 확인만 구현한다. 거래 반영 버튼·수정 버튼은 없다.
6. 대시보드 통계는 `transactions` 테이블에 직접 저장된 수입·지출만 집계한다.
7. WSL 개발용 DB와 EC2 배포용 DB를 혼동하지 않고, 시연용 계정과 데이터는 EC2에서 별도로 준비한다.

## 15. 추가 기능 (2026-10-20, PLAN.md)

핵심 기능 배포 후 팀 합의로 추가했다. 상세 계획·진행 현황은 [PLAN.md](PLAN.md), API는 [docs/api-contract.md](docs/api-contract.md)가 기준이다.

| 기능 | API | 범위 | 제외 |
|---|---|---|---|
| AI 가계부 챗봇 (Amazon Bedrock) | `POST /api/chat` | 로그인한 사용자 본인의 선택 월 데이터만 근거로 답하는 읽기 전용 질의응답 | 챗봇을 통한 거래 등록·수정·삭제, 대화 기록 저장, 금융 조언 |
| 월간 명세서 메일 (Amazon SES) | `POST /api/reports/monthly-email`, `GET /api/reports/email-status`, `POST /api/reports/email-verification` | 선택 월 명세서를 로그인한 사용자 본인 주소로만 발송, SES 샌드박스 대응용 본인 주소 인증 | 다른 주소로 발송, 자동 정기 발송 |
| 영수증·명세서 인식 (Amazon Bedrock) | `POST /api/receipts/analyze` | 이미지·PDF에서 거래 입력 초안을 만들고, 사용자가 확인한 항목만 기존 `POST /api/transactions`로 저장 | 자동 저장, 파일 보관 |

- 기능마다 환경 변수(`CHAT_ENABLED` / `EMAIL_ENABLED` / `RECEIPT_ENABLED`, 기본 꺼짐)로 끌 수 있고, 꺼지거나 실패해도 기존 기능은 그대로 동작한다.
- AWS 액세스 키는 쓰지 않는다. EC2는 IAM 역할로 Bedrock·SES를 호출한다.
- 3장의 기존 범위는 바뀌지 않는다. 특히 정기결제는 여전히 목록 관리만 하며, 추가 기능도 정기결제를 거래나 대시보드에 반영하지 않는다.

---

**핵심 원칙**: 기능 추가보다 로그인 → 거래 CRUD → 정기결제 목록 관리 → 대시보드 → AWS 배포가 끝까지 동작하는 것을 우선한다.
