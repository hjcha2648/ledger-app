# ledger-app

개인 가계부 & 정기결제 목록 관리 웹앱 (PRD v3.2)

```text
브라우저 ─HTTPS─> CloudFront ─┬─ /*     ─> S3 (React 빌드)
                              └─ /api/* ─> EC2 (FastAPI + systemd) ─> MariaDB (127.0.0.1:3306)
```

| 디렉터리 | 내용 | 담당 |
|---|---|---|
| `backend/` | FastAPI API 서버 | B |
| `frontend/` | React + Vite + Tailwind | C |
| 인프라 설정 | EC2, S3, CloudFront, systemd | A |

---

## Backend

Python 3.14 · FastAPI · SQLAlchemy 2.x · PyMySQL · MariaDB · Argon2 · PyJWT

### 1. 로컬 개발 환경 (WSL Ubuntu)

**1) MariaDB DB·계정 생성** (최초 1회)

```bash
sudo mariadb
```

```sql
CREATE DATABASE ledger_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'app_user'@'localhost' IDENTIFIED BY '<비밀번호>';
CREATE USER 'app_user'@'127.0.0.1' IDENTIFIED BY '<비밀번호>';
GRANT ALL PRIVILEGES ON ledger_db.* TO 'app_user'@'localhost';
GRANT ALL PRIVILEGES ON ledger_db.* TO 'app_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

**2) 가상환경·의존성**

```bash
python3 -m venv .venv            # 저장소 루트
source .venv/bin/activate
pip install -r backend/requirements.txt
```

**3) 환경 변수**

```bash
cd backend
cp .env.example .env             # 값 채우기 (.env는 Git에 올리지 않음)
```

| 키 | 설명 | 예시 |
|---|---|---|
| `DATABASE_URL` | DB 접속 URL | `mysql+pymysql://app_user:<pw>@127.0.0.1:3306/ledger_db?charset=utf8mb4` |
| `JWT_SECRET_KEY` | JWT 서명 키 | `openssl rand -hex 32` 결과 |
| `JWT_ALGORITHM` | 서명 알고리즘 | `HS256` |
| `JWT_EXPIRE_MINUTES` | 토큰 만료(분) | `60` |
| `CORS_ORIGINS` | 허용 Origin (쉼표 구분, 로컬용) | `http://localhost:5173` |
| `ENABLE_DOCS` | Swagger 사용 여부 | 로컬 `true`, 운영 `false` |

**4) DB 초기화 · 실행**

> 백엔드 명령은 모두 `backend/` 폴더에서 실행한다 (`app` 패키지 위치).

```bash
python -m app.init_db                          # 테이블 생성 + 기본 카테고리 13개 (여러 번 실행해도 안전)
uvicorn app.main:app --reload --port 8000
```

- 헬스체크: http://localhost:8000/api/health → `{"status":"ok","db":"ok"}`
- Swagger: http://localhost:8000/api/docs
- 프론트 로컬 연동: Vite `server.proxy`에 `'/api': 'http://localhost:8000'` 설정

### 2. API

모든 경로는 `/api`로 시작한다. health·register·login 외에는 `Authorization: Bearer <token>` 필수.

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/health` | 서버·DB 상태 (DB 실패 시 503) |
| POST | `/api/auth/register` | 회원가입 `{email, password(8~64)}` |
| POST | `/api/auth/login` | 로그인 → `{access_token, token_type, expires_in}` |
| GET | `/api/auth/me` | 현재 사용자 |
| GET | `/api/categories` | 기본 + 내 카테고리 (`is_default`) |
| POST | `/api/categories` | 개인 카테고리 추가 `{name, type}` |
| GET | `/api/transactions?month=YYYY-MM` | 월별 거래 (최신순) |
| POST | `/api/transactions` | 거래 등록 |
| PATCH | `/api/transactions/{id}` | 거래 수정 (보낸 필드만) |
| DELETE | `/api/transactions/{id}` | 거래 삭제 |
| GET | `/api/subscriptions` | 정기결제 목록 |
| POST | `/api/subscriptions` | 정기결제 등록 (지출 카테고리만) |
| DELETE | `/api/subscriptions/{id}` | 정기결제 삭제 |
| GET | `/api/dashboard?month=YYYY-MM` | 요약 · 카테고리별 지출 · 최근 6개월 비교 |

**규칙**

- 날짜 `YYYY-MM-DD`, 월 `YYYY-MM`, 금액은 정수(원) `*_krw`, 일시는 UTC
- 오류는 `{"detail": ...}` — 서버 검증 오류는 문자열, Pydantic 형식 오류(422)는 배열
- 상태 코드: 401 인증 실패 · 404 없음/타인 자원 · 409 중복 · 422 입력 오류 · 500 서버 오류
- 정기결제는 목록 관리만 한다. 거래를 생성하지 않고 대시보드 합계에도 포함되지 않는다.

### 3. 테스트

자동화 테스트(Pytest)는 범위에서 제외. 스모크 스크립트로 핵심 흐름과 사용자 격리를 검증한다.

```bash
./scripts/smoke.sh                               # 로컬
./scripts/smoke.sh http://127.0.0.1:8000         # EC2 내부
./scripts/smoke.sh https://<cloudfront-domain>   # CloudFront 경유
```

- 인증, 카테고리, 거래 CRUD, 정기결제, 대시보드 집계, 계정 간 격리, `/api/*` 404가 JSON인지(CloudFront 오류 페이지 설정 검증)까지 51개 항목
- 실행마다 `smoke-<시각>-a/b@example.com` 계정이 남는다 (삭제 API 없음). 시연 전 정리:

```sql
DELETE c FROM categories c JOIN users u ON c.user_id = u.id WHERE u.email LIKE 'smoke-%';
DELETE FROM users WHERE email LIKE 'smoke-%';
```

### 4. 시연 데이터

```bash
python -m app.seed_demo --email demo@example.com --password '<시연용 비밀번호>'
python -m app.seed_demo --email demo@example.com --password '<...>' --reset   # 다시 생성
```

- 최근 6개월 가상 거래 약 170건, 정기결제 4건, 개인 카테고리 1개 (실제 금융정보 아님)
- 비밀번호는 `DEMO_PASSWORD` 환경 변수로도 전달 가능 (셸 히스토리에 남기지 않으려면 권장)

### 5. EC2 배포 (백엔드 부분)

```bash
cd ~/ledger-app && git pull origin main
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
python -m app.init_db                  # 최초 1회 또는 테이블 추가 시
sudo systemctl restart <service-name>
sudo systemctl status <service-name>
journalctl -u <service-name> -n 100 --no-pager
curl http://127.0.0.1:8000/api/health
./scripts/smoke.sh http://127.0.0.1:8000
```

- 환경 변수는 `.env` 대신 제한 권한 파일(예: `/etc/ledger/backend.env`, `chmod 600`)에 두고 systemd `EnvironmentFile=`로 주입 (systemd 환경 변수가 `.env`보다 우선)
- 운영에서는 `ENABLE_DOCS=false`, `CORS_ORIGINS` 비움 (CloudFront 같은 도메인)
- DB 비밀번호·JWT 키는 로컬과 다른 강한 값 사용

systemd 유닛 예시 (경로·서비스명은 인프라 확정값으로 교체):

```ini
[Unit]
Description=Ledger FastAPI
After=network.target mariadb.service
Requires=mariadb.service

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/ledger-app/backend
EnvironmentFile=/etc/ledger/backend.env
ExecStart=/home/ubuntu/ledger-app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
Restart=always

[Install]
WantedBy=multi-user.target
```

### 6. 스키마 변경

`create_all()`은 **없는 테이블만 만들고 기존 테이블 구조는 바꾸지 않는다.**

- 로컬: 데이터가 필요 없으면 DB를 지우고 `init_db` 재실행
- EC2: 데이터 보존이 필요하므로 `mariadb-dump`로 백업 후 `ALTER TABLE`을 직접 실행하고 이 README에 기록. **운영 DB에 임의 DROP 금지**

| 날짜 | 변경 내용 | 적용 SQL |
|---|---|---|
| — | (없음) | — |

### 7. 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| `ModuleNotFoundError: No module named 'app'` | `backend/` 폴더에서 실행 |
| `[Errno 98] Address already in use` | 포트 사용 중 → `ss -ltnp \| grep :8000`으로 확인 후 종료하거나 다른 포트 사용 |
| `/api/health`가 503 | MariaDB 중지 또는 `DATABASE_URL` 오류 → `sudo systemctl status mariadb`, 계정·비밀번호 확인 |
| 루트(`/`) 접속 시 `{"detail":"Not Found"}` | 정상. API는 `/api/*`만 존재 |
| 모든 요청이 401 | 토큰 만료(60분) 또는 서버의 `JWT_SECRET_KEY` 변경 → 다시 로그인 |
| CloudFront에서 API 404가 HTML로 옴 | 사용자 지정 오류 응답(→ `index.html`)이 `/api/*`에도 적용됨 → 설정 분리 |
| 500 응답 | `journalctl -u <service-name>`에서 `Unhandled error` 로그 확인 |
