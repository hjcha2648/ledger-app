# 인프라 AI 컨텍스트

> 인프라 작업 시 AI 도우미에게 이 문서를 제공한다. 공통 규칙은 [AGENTS.md](../AGENTS.md), 인프라 작업 지침은 [agent-infra.md](agent-infra.md), 계획·결정 표는 [PLAN-infra.md](../PLAN-infra.md).
> **AWS 액세스 키, DB 비밀번호, JWT 키를 프롬프트에 넣지 말 것.** 필요하면 `<DB_PASSWORD>` 같은 자리표시자로 쓴다.

## 아키텍처 (PRD §2)

```text
브라우저 ─HTTPS─> CloudFront ─┬─ /*     ─> S3 (React 정적 빌드, frontend/dist)
                              └─ /api/* ─> EC2 (FastAPI + systemd, 포트 8000)
                                               └─ MariaDB (127.0.0.1:3306, 같은 EC2 내부)
```

- 기본 VPC, EC2 1대, **RDS·Docker·IaC·CI/CD 사용 안 함**. 수동 배포.
- 로컬 개발 환경: WSL **Ubuntu 26.04 LTS**, **Python 3.14** → EC2도 Ubuntu 26.04 LTS 권장 (버전 일치)

## 백엔드 실행 정보 (구현 완료, `main` 브랜치)

| 항목 | 값 |
|---|---|
| 작업 디렉터리 | `<repo>/backend` (여기서 실행해야 `app` 패키지를 찾음) |
| 의존성 | `backend/requirements.txt` |
| 실행 명령 | `<repo>/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers` |
| DB 초기화 (최초 1회) | `python -m app.init_db` — 테이블 4개 + 기본 카테고리 13개, 재실행 안전 |
| 헬스체크 | `GET /api/health` → `200 {"status":"ok","db":"ok"}`, DB 실패 시 `503` |
| 전체 검증 | `backend/scripts/smoke.sh <BASE_URL>` — 51개 항목, 실패 시 exit 1 |
| 시연 데이터 | `python -m app.seed_demo --email demo@example.com --password '<pw>'` |

### 환경 변수 (값은 EC2에서 직접 생성)

```dotenv
DATABASE_URL=mysql+pymysql://<app_user>:<DB_PASSWORD>@127.0.0.1:3306/ledger_db?charset=utf8mb4
JWT_SECRET_KEY=<openssl rand -hex 32>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
CORS_ORIGINS=
ENABLE_DOCS=false
```
- 파일 위치 권장: `/etc/ledger/backend.env`, `chmod 600`, systemd `EnvironmentFile=`로 주입
- DB 비밀번호는 `openssl rand -base64 24` 등으로 생성 (로컬 값 재사용 금지)
- `DATABASE_URL`에 비밀번호를 넣으므로 `@ : / ? #` 같은 문자가 있으면 URL 인코딩 필요 → 영숫자 위주로 생성 권장

## EC2 작업 체크리스트 (PRD §12.2)

1. EC2 생성: Ubuntu 26.04 LTS, 보안 그룹 — SSH(22)는 내 IP만, API 포트(8000)는 CloudFront만(관리형 접두사 목록 `com.amazonaws.global.cloudfront.origin-facing`), **3306은 열지 않음**
2. MariaDB 설치·자동 시작: `sudo apt install -y mariadb-server && sudo systemctl enable --now mariadb`
3. `bind-address = 127.0.0.1` 확인 (`/etc/mysql/mariadb.conf.d/50-server.cnf`)
4. DB와 최소 권한 계정
   ```sql
   CREATE DATABASE ledger_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'app_user'@'localhost' IDENTIFIED BY '<DB_PASSWORD>';
   CREATE USER 'app_user'@'127.0.0.1' IDENTIFIED BY '<DB_PASSWORD>';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON ledger_db.* TO 'app_user'@'localhost';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON ledger_db.* TO 'app_user'@'127.0.0.1';
   FLUSH PRIVILEGES;
   ```
5. 코드·venv: `git clone` → `python3 -m venv .venv` → `pip install -r backend/requirements.txt`
6. 환경 파일 작성 → `cd backend && set -a && . /etc/ledger/backend.env && set +a && python -m app.init_db`
7. systemd 등록 (아래 예시) → `sudo systemctl enable --now ledger-api`
8. `curl http://127.0.0.1:8000/api/health` → `./scripts/smoke.sh http://127.0.0.1:8000`
9. 재부팅 테스트: `sudo reboot` 후 서비스·MariaDB 자동 기동 확인

### systemd 유닛 예시 (`/etc/systemd/system/ledger-api.service`)

```ini
[Unit]
Description=Ledger FastAPI
After=network.target mariadb.service
Requires=mariadb.service

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/vibe-lab/ledger-app/backend
EnvironmentFile=/etc/ledger/backend.env
ExecStart=/home/ubuntu/vibe-lab/ledger-app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

## CloudFront 설정 (PRD §2)

| 동작 | 원본 | 설정 |
|---|---|---|
| `/api/*` (우선순위 높게) | EC2 (퍼블릭 DNS, HTTP, 포트 8000) | 캐시 정책 **CachingDisabled**, 원본 요청 정책 **AllViewerExceptHostHeader** (Authorization 헤더·쿼리 전달), 허용 메서드 **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** |
| `/*` (기본) | S3 (OAC로 비공개 버킷 접근) | 캐시 사용, 기본 루트 객체 `index.html` |

- **SPA 라우팅**: `/dashboard` 등 새로고침 시 S3가 403/404를 반환 → `index.html`로 응답해야 함.
  - 배포 전체에 "사용자 지정 오류 응답(403/404 → /index.html, 200)"을 걸면 **API의 404·403도 HTML로 바뀌어** 프론트가 오류를 처리할 수 없게 된다 (PRD: "`/api/*` 오류를 SPA index.html로 치환하지 않는다").
  - 권장: S3 동작(`/*`)에만 **CloudFront Function(viewer request)**으로 확장자 없는 경로를 `/index.html`로 재작성.
  - 검증: `smoke.sh`의 "없는 /api 경로 404가 JSON으로 응답" 항목이 PASS여야 함.
- EC2 원본은 HTTP — 브라우저↔CloudFront만 HTTPS. 학습·시연용이므로 **가상 데이터만 사용**하고 이 한계를 문서화 (PRD §12.3).
- 프론트 배포 후 캐시 무효화: `/index.html` (필요 시 `/*`)

## 백업 (PRD §12.2-7)

```bash
# 백업
sudo mariadb-dump --single-transaction --routines ledger_db > ~/backup/ledger_db_$(date +%Y%m%d_%H%M).sql
# 복원 검증 (별도 DB에 복원해 확인)
sudo mariadb -e "CREATE DATABASE ledger_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
sudo mariadb ledger_restore_test < ~/backup/ledger_db_<날짜>.sql
sudo mariadb -e "SELECT COUNT(*) FROM ledger_restore_test.transactions; DROP DATABASE ledger_restore_test;"
```

## 배포 갱신 (코드 변경 시)

```bash
cd ~/vibe-lab/ledger-app && git pull origin main
source .venv/bin/activate && pip install -r backend/requirements.txt
sudo systemctl restart ledger-api
journalctl -u ledger-api -n 100 --no-pager
cd backend && ./scripts/smoke.sh http://127.0.0.1:8000
```

## 문제 해결

| 증상 | 확인 |
|---|---|
| `/api/health` 503 | `sudo systemctl status mariadb`, 환경 파일의 `DATABASE_URL` |
| 서비스가 바로 죽음 | `journalctl -u ledger-api -n 100` — 환경 변수 누락 시 `ValidationError` |
| CloudFront `/api/*` 502/504 | EC2 보안 그룹 8000 인바운드, 원본 포트·프로토콜(HTTP 8000), `--host 0.0.0.0` |
| 로그인은 되는데 이후 모두 401 | `/api/*` 원본 요청 정책이 `Authorization` 헤더를 전달하지 않음 |
| `/api/...` 오류가 HTML로 옴 | 사용자 지정 오류 응답이 `/api/*`에도 적용됨 |
| `smoke.sh` 후 테스트 계정 남음 | README "테스트" 섹션의 정리 SQL 실행 |

## AI에게 줄 프롬프트 예시

```text
이 저장소의 AGENTS.md와 docs/ai-infra.md를 먼저 읽어줘.
Ubuntu 26.04 EC2에서 <작업 내용>을 하는 명령을 단계별로 알려줘.
비밀번호와 키는 <DB_PASSWORD> 같은 자리표시자로 써줘.
```
