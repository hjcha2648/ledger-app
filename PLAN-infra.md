# PLAN — 인프라(A) 4일 구현 계획

- 기준 문서: `PRD.md` (v3.2)
- 담당: **A — AWS 인프라·배포** (팀 3명: A 인프라, B 백엔드, C 프론트엔드)
- 기간: 4일 (하루 8시간)
- 목표: CloudFront HTTPS 주소에서 가입 → 거래 → 정기결제 목록 → 대시보드가 끝까지 동작하고, 데이터가 EC2 내부 MariaDB에 저장되는 환경을 만든다.

이 문서는 인프라 작업만 다룬다. 앱 요구사항은 `PRD.md`, 팀 공통 규칙은 `AGENTS.md`, AI 작업 지침은 `docs/agent-infra.md`, 백엔드 계획은 `PLAN-backend.md`를 본다.

---

## 1. 내가 책임지는 것

| 영역 | 내용 |
|---|---|
| EC2 | 인스턴스 생성, 보안 그룹, Python venv, systemd 서비스 |
| MariaDB | EC2 내부 설치·자동 시작·로컬 바인딩, 전용 DB·최소 권한 앱 계정, 백업·복원 검증 |
| S3 | React 정적 빌드 업로드용 비공개 버킷 |
| CloudFront | HTTPS 진입점. `/*`는 S3, `/api/*`는 EC2로 전달 |
| 환경 변수 | EC2의 제한된 권한 환경 파일(DB 연결 URL, JWT 서명키) |
| 배포 | 프론트(S3 업로드 + 캐시 무효화), 백엔드(`git pull` → 재시작) 수동 배포 |
| 장애 대응 | 배포·서버 실행·CloudFront 연결 오류 진단, B의 API 수동 검증 지원(Day 2부터) |

**하지 않는 것**: 앱 코드 수정(B·C 소유), RDS·Docker·CI/CD·IaC·EventBridge/cron 도입, 3306 외부 개방

## 2. 결정 사항

### 2.1 PRD에서 확정된 것

- EC2 한 대에 FastAPI와 MariaDB를 함께 둔다. RDS는 쓰지 않는다.
- MariaDB는 `127.0.0.1:3306`에서만 접속을 받고, 보안 그룹에서 3306 인바운드를 열지 않는다.
- 전용 DB와 최소 권한 앱 계정을 쓰고, root 계정으로 API를 실행하지 않는다.
- FastAPI는 Python venv + systemd로 실행한다.
- DB 연결 URL과 JWT 서명키는 EC2의 제한된 권한 환경 파일에 둔다. Git에 올리지 않는다.
- CloudFront `/api/*`는 캐시를 끄고, 필요한 HTTP 메서드를 허용하고, `Authorization` 헤더와 쿼리를 전달한다. API 오류를 `index.html`로 바꾸지 않는다.
- 기본 VPC를 쓴다.
- 시연 전 `mariadb-dump` 백업과 복원을 검증한다. 시연에는 가상 데이터만 쓴다.
- 서비스명·실행 경로·EC2 원본 포트·CloudFront 원본 연결 방식은 **Day 1~2에 내가 정하고 README에 기록**한다.

### 2.2 내가 정해야 하는 것

| 항목 | 제안 | 확정 시점 | 결정 |
|---|---|---|---|
| 리전 | 서울(`ap-northeast-2`) | Day 1 | **`ap-northeast-2`** (EC2·S3·Bedrock. ACM 인증서만 CloudFront 규칙상 `us-east-1`) |
| OS | Amazon Linux 2023 또는 Ubuntu (패키지 관리자 `dnf` / `apt`가 달라진다) | Day 1 | **Ubuntu 26.04 LTS** (`apt`). `docs/ai-infra.md`: 로컬 WSL(26.04, Python 3.14)과 버전 일치. `requirements.txt`가 Python 3.14.4에서 설치되는 것을 로컬에서 확인 |
| 인스턴스 유형·EBS 크기 | 계정의 프리티어·예산 확인 후 결정 | Day 1 | **`t3.small`**(메모리 1.9GB → 빌드용 스왑 `/swapfile` 1GB, 재부팅 후 `sudo swapon /swapfile`), 루트 볼륨 약 19GB(10/20 실측) |
| SSH 접속 방식 | 팀 고정 IP만 허용(22) 또는 SSM Session Manager(22 닫음) | Day 1 | `docs/ai-infra.md`는 "내 IP만". ⚠️ **10/20 실측: 22번에 `0.0.0.0/0`과 `175.209.15.230/32`가 함께 열려 있음 → `0.0.0.0/0` 제거 필요**(팀원 IP 확인 후) |
| 앱 포트 | 80번은 일반 사용자 권한으로 못 쓰므로 8000 같은 비특권 포트 | Day 1 | **8000** (`docs/ai-infra.md`) |
| 서비스명 | 예: `ledger-api` | Day 1 | **`ledger-api`** (`docs/ai-infra.md`) |
| 프로젝트·환경 파일 경로 | 홈 디렉터리 하위의 프로젝트 폴더, 환경 파일은 권한 600 | Day 1 | 프로젝트 `/home/ubuntu/vibe-lab/ledger-app`(실행 디렉터리 `backend/`, venv `.venv/`), 환경 파일 `/etc/ledger/backend.env` 권한 600 — 시연 EC2 `i-02195e4dee3318216`에 이 경로로 배치함 |
| 고정 주소 | Elastic IP를 붙여 재시작 후에도 CloudFront 원본 주소가 바뀌지 않게 함. 과금 여부 확인 | Day 1 | 미정. 현재 원본은 퍼블릭 DNS `ec2-43-201-29-20.ap-northeast-2.compute.amazonaws.com` → **인스턴스 중지·시작 시 바뀌므로 원본 수정 필요**. 계정에 연결 안 된 EIP 2개(`43.200.29.190`, `54.116.209.116`) 있음 — 소유 확인 필요 |
| 원본 프로토콜 | CloudFront→EC2는 HTTP(도메인·인증서가 없으면 HTTPS 불가). 한계를 README에 명시 | Day 2 | **HTTP only, 포트 8000, 응답 제한 시간 60초**(챗봇 응답 대비, PLAN.md A5) |
| S3 버킷 | 비공개 + OAC | Day 3 | **`ledger-app-s3`** (`ap-northeast-2`, 퍼블릭 차단, 버킷 정책은 CloudFront 배포 ARN 조건) |
| CloudFront | `/*` → S3, `/api/*` → EC2 | Day 3 | 배포 **`E2Q0XEE8TA0BOI`** (`d2q1okho7uqgh2.cloudfront.net`), 대체 도메인 **`ledger.lsj.mzsec.cloud`**(Route 53 `lsj.mzsec.cloud` 영역 A 별칭, ACM `us-east-1` 인증서), 기본 동작에 함수 `spa-rewrite` |
| IAM 역할 | EC2 인스턴스 역할(액세스 키 저장 안 함) | Day 3 | **`ledger-ec2-role`**, 인라인 정책 `ledger-bedrock-invoke`(`bedrock:InvokeModel`만). S3 업로드·무효화 권한은 아직 없음 → 현재는 개인 `aws login` 자격 증명으로 업로드 |
| VPC | 기본 VPC(2.1) | Day 1 | 10/20 실측: EC2는 **기본 VPC가 아닌** `vpc-00eb76e65446388ec`, 보안 그룹 `sg-08b29fea96149a5a4`. 2.1과 다름 — 동작에는 문제없음 |
| DB 이름·앱 계정 이름 | PRD 예시 기준 `ledger_db`, `app_user` | Day 1 | **`ledger_db`, `app_user`** (`localhost`·`127.0.0.1` 두 계정, `docs/ai-infra.md`·`docs/db-design.md`) |

결정하면 이 표를 갱신하고 B(환경 변수 키·실행 모듈)와 C(CloudFront 주소)에게 알린다.

## 3. 작업 목록 (T01~T20)

상태 표기: `[ ]` 미착수 / `[~]` 진행 중 / `[x]` 완료. 커밋 메시지와 B·C와의 대화에서는 작업 번호(예: `T07`)로 부른다.

| 번호 | Day | 작업 | 선행 | 완료 기준 |
|---|---|---|---|---|
| T01 | 0 | 계정 권한·예산·저장소 접근 확인 | - | 3개 서비스 콘솔 접근, 예산 알림 설정 |
| T02 | 1 | 결정 사항 확정(2.2 표) | T01 | 2.2 표에 미정 항목 없음 |
| T03 | 1 | 보안 그룹 생성 | T02 | 22·앱 포트만 있고 3306 없음 |
| T04 | 1 | EC2 인스턴스·키 페어·EBS 생성 | T03 | 상태 검사 2/2 통과 |
| T05 | 1 | Elastic IP·접속·초기 설정 | T04 | SSH(또는 SSM) 접속, 시간대·업데이트·스왑 완료 |
| T06 | 1 | MariaDB·서비스 설계 문서, B·C 전달 목록 초안 | T02 | 설치 절차서와 4장 목록 초안 존재 |
| T07 | 2 | MariaDB 설치·로컬 바인딩·DB·앱 계정 | T05 | `127.0.0.1:3306`만 리슨, 앱 계정 접속 성공 |
| T08 | 2 | 백엔드 코드 배치·venv·환경 파일 | T05, B의 `requirements.txt` | 의존성 설치 성공, 환경 파일 권한 600 |
| T09 | 2 | 최초 테이블 생성·기본 카테고리 시드 | T07, T08 | 테이블과 기본 카테고리 확인 |
| T10 | 2 | systemd 서비스 등록·`/api/health` 확인 | T09 | 서비스 active, 서버 안·외부 확인 |
| T11 | 2 | B의 API 수동 검증 지원 | T10 | B의 API 목록 검증 완료 |
| T12 | 3 | S3 비공개 버킷·OAC | T01 | 버킷 직접 접근 403 |
| T13 | 3 | CloudFront 배포·EC2 원본·`/api/*` 동작 | T10, T12 | CloudFront로 `/api/health` 200 |
| T14 | 3 | SPA 새로고침 처리(CloudFront Function) | T13 | `/dashboard` 새로고침 성공, API 404는 JSON |
| T15 | 3 | 통합 확인·C에게 주소·업로드 방법 전달 | T14, C의 빌드 | CloudFront에서 프론트·로그인 동작 |
| T16 | 4 | 최종 배포(프론트 업로드·백엔드 `git pull`·재시작) | T15 | 최종 버전이 CloudFront에서 동작 |
| T17 | 4 | 인프라 검증 체크리스트(7장)·PRD 10장 수동 테스트 | T16 | 7장 전 항목 결과 기록 |
| T18 | 4 | `mariadb-dump` 백업·테스트 DB 복원 | T16 | 복원 DB 행 수가 원본과 일치 |
| T19 | 4 | 재부팅 복구 확인·시연 데이터 준비 | T16 | 재부팅 후 서비스·데이터 유지 |
| T20 | 4 | README 인프라 절 정리·리소스 정리 계획 | T17~T19 | 9장 항목 반영, 정리 순서 확정 |

### Day 0 (사전)

#### T01 — 계정 권한·예산·저장소 접근 확인
- [ ] AWS 계정 권한 확인: EC2, 보안 그룹, S3, CloudFront
- [ ] 비용 알림(예산) 설정, 프리티어 해당 여부 확인
- [ ] 팀 GitHub 저장소 접근 권한 확인

### Day 1 — 서버 만들기와 설계

**Day 종료 기준**: SSH로 EC2에 접속되고, 보안 그룹이 의도대로 설정되어 있으며, MariaDB·서비스 설계 문서가 있다.

#### T02 — 결정 사항 확정
- [ ] 2.2 표의 미정 항목 확정 (SSH 방식, 앱 포트, 서비스명, 경로, 고정 주소 등)
- [ ] 확정 내용을 B·C에게 알림

#### T03 — 보안 그룹 생성
- [ ] 3.1 설계대로 생성 (SSH 22는 T02에서 정한 방식, 앱 포트는 CloudFront만, **3306은 열지 않음**)

#### T04 — EC2 인스턴스 생성
- [ ] Ubuntu 26.04 LTS, 프리티어 대상 유형, gp3 20~30GB(암호화)
- [ ] 키 페어 생성·보관 방법 정리 (Git에 올리지 않음)

#### T05 — Elastic IP·접속·초기 설정
- [ ] (제안) Elastic IP 연결, 과금 여부 확인
- [ ] 서버 접속 확인, 시간대·패키지 업데이트, `df -h /`로 디스크 확인
- [ ] 메모리가 1GB 이하면 스왑 추가

#### T06 — 설계 문서와 전달 목록 초안
- [ ] MariaDB 설치·설정 절차서(설치 순서, DB·계정 생성, 환경 파일 위치) — 초안: `docs/db-design.md`, `db/`
- [ ] B·C에게 전달할 정보 목록 초안(4장)

#### 3.1 보안 그룹 설계

| 규칙 | 값 | 비고 |
|---|---|---|
| SSH 22 | 팀 고정 IP만 (SSM 사용 시 규칙 없음) | 전체 개방(`0.0.0.0/0`) 금지 |
| 앱 포트(예: 8000) | CloudFront 관리형 prefix list `com.amazonaws.global.cloudfront.origin-facing` | 직접 접근 차단 효과. 콘솔에서 prefix list 선택 가능 여부 확인. 규칙 한도(기본 60)를 약 55개분 차지하므로 규칙 추가 전에 확인 |
| 3306 | **인바운드 없음** | MariaDB는 로컬 전용 |

### Day 2 — MariaDB와 API 서버 구동

**Day 종료 기준**: EC2에서 MariaDB와 API 서버가 구동되고, 서버 재시작 후에도 자동으로 올라온다.

#### T07 — MariaDB 설치·설정
(절차·권한·설정값: `docs/db-design.md` 5~7장, SQL: `db/00_init_database.sql`)
- [ ] 설치, 부팅 시 자동 시작 설정
- [ ] `bind-address=127.0.0.1` 확인, 3306이 외부에서 닫혀 있는지 확인
- [ ] 문자셋(`utf8mb4`) 확인, 전용 DB 생성
- [ ] 최소 권한 앱 계정 생성(해당 DB 권한만), 비밀번호가 쉘 기록·로그에 남지 않게 입력
- [ ] 앱 계정으로 `127.0.0.1` 접속 테스트

#### T08 — 백엔드 배치
- [ ] Python 버전 확인(Ubuntu 26.04 기본 버전에서 `requirements.txt`가 설치되는지 먼저 시험, 안 되면 B에게 알림)
- [ ] 프로젝트 `git clone`, venv 생성, 의존성 설치(B의 `requirements.txt` 기준)
- [ ] 환경 파일 `/etc/ledger/backend.env` 작성(권한 600). 키: `DATABASE_URL`, `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `JWT_EXPIRE_MINUTES`, `CORS_ORIGINS`(비움), `ENABLE_DOCS=false`. 값은 EC2에서 직접 생성(DB 비밀번호는 영숫자 위주, 로컬 값 재사용 금지)

#### T09 — 테이블 생성·시드
(테이블 정의·제약: `docs/db-design.md` 3~4장)
- [x] `cd backend && set -a && . /etc/ledger/backend.env && set +a && python -m app.init_db` → `default categories added: 13` (재실행 시 0)
- [ ] `db/01_schema_reference.sql`과 `SHOW CREATE TABLE` 비교(`docs/db-design.md` 4장)

#### T10 — systemd 서비스
- [x] 서비스 작성·등록·시작 (6장 기준)
- [ ] `curl http://127.0.0.1:8000/api/health` → `{"status":"ok","db":"ok"}` (DB 실패 시 503), 보안 그룹을 통한 외부 접근 확인
- [ ] 재시작 후 자동 기동 확인

#### T11 — B의 API 수동 검증 지원
- [ ] `cd backend && ./scripts/smoke.sh http://127.0.0.1:8000` → 51개 항목 통과(실패 시 exit 1). 로컬에서 51개 통과 확인함
- [ ] smoke가 남기는 테스트 계정·개인 카테고리는 시연 전에 정리(README "테스트" 섹션의 정리 SQL)
- [ ] `journalctl` 사용법 전달

### Day 3 — S3와 CloudFront

**Day 종료 기준**: CloudFront HTTPS 주소에서 프론트가 열리고 `/api/*`가 EC2의 FastAPI에 도달한다.

#### T12 — S3 버킷
- [x] 버킷 생성(공개 차단 유지), CloudFront OAC로 접근 허용 (OAC 연결 후 버킷 정책 반영) — S3 직접 접근 403 확인(10/20)

#### T13 — CloudFront 배포
- [x] 기본 동작 `/*` → S3, 기본 객체 `index.html`
- [x] 원본 추가: EC2(퍼블릭 DNS 이름, HTTP, 앱 포트)
- [x] 동작 추가 `/api/*` → EC2 원본 (3.2) — 메서드 7개, `CachingDisabled`, `AllViewerExceptHostHeader`
- [x] CloudFront 주소로 `/api/health`, 로그인 요청 확인

#### T14 — SPA 새로고침 처리
- [x] 기본 동작에만 적용되는 방법 사용 (3.3) — 함수 `spa-rewrite`, `/dashboard` 200 HTML
- [x] 배포 전체 사용자 지정 오류 응답은 설정하지 않음 — `/api/nope` 404 JSON

#### T15 — 통합 확인·전달
- [x] C의 임시 빌드를 업로드해 CloudFront 주소에서 화면 표시 확인 (10/20 main 빌드)
- [ ] C에게 CloudFront 주소와 업로드 방법 전달

#### 3.2 `/api/*` 동작 설정

| 항목 | 설정 |
|---|---|
| 캐시 | 비활성화(예: 관리형 `CachingDisabled` 캐시 정책) |
| 허용 메서드 | `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE` — 거래 수정(PATCH)·삭제(DELETE) 때문에 필요 |
| 헤더·쿼리 전달 | `Authorization` 헤더와 쿼리 문자열 전달(예: 관리형 `AllViewerExceptHostHeader` 원본 요청 정책). 설정 후 헤더가 실제로 도달하는지 확인 |
| 뷰어 프로토콜 | HTTP를 HTTPS로 리디렉션 |

#### 3.3 SPA 새로고침 처리

`/dashboard`처럼 S3에 없는 경로를 새로고침하면 `index.html`을 보여줘야 한다. 하지만 CloudFront의 **배포 전체 사용자 지정 오류 응답**(403/404 → `index.html`)은 `/api/*`의 404 응답까지 바꿔 버리므로 쓰지 않는다. 대신 기본 동작(`/*`)에만 붙는 CloudFront Function으로, 확장자가 없는 경로를 `/index.html`로 다시 쓴다.

### Day 4 — 최종 배포·검증·정리

**Day 종료 기준**: CloudFront 주소에서 전체 시연이 성공한다. 오후부터는 기능 추가를 중지하고 장애 대응만 한다.

#### T16 — 최종 배포 (오전)
- [ ] 프론트 최종 빌드 업로드, CloudFront 캐시 무효화
- [ ] 백엔드 최종 `git pull` → 의존성 설치 → 서비스 재시작

#### T17 — 검증 (오전)
- [ ] 7장 검증 체크리스트 실행(B·C와 함께 PRD 10장 수동 테스트도 진행)
- [ ] 배포 장애 대응(8장)

#### T18 — 백업·복원 (오후)
- [ ] `mariadb-dump` 백업 생성 → 별도 테스트 DB에 복원해 행 수 비교(운영 DB를 덮어쓰지 않음)

#### T19 — 재부팅 복구·시연 데이터 (오후)
- [ ] 시연용 계정·가상 데이터를 EC2 DB에 준비(로컬 DB와 별개)
- [ ] **EC2 재부팅 후 MariaDB·API 자동 복구와 데이터 유지 확인**

#### T20 — 문서·정리 (오후)
- [ ] README의 인프라 절 정리(9장)
- [ ] 시연 후 리소스 정리 계획 확인(EC2, Elastic IP, CloudFront, S3 비용)
- [ ] 챗봇(Bedrock) 정리 계획 (PLAN.md A7) — 시연 후 팀 확인을 받고 순서대로:
  1. 환경 파일에서 `CHAT_ENABLED=false`로 바꾸고 재시작 (Bedrock 호출 중단, `/api/chat`은 503)
  2. `ledger-ec2-role`에서 인라인 정책 `ledger-bedrock-invoke` 제거. 역할 자체는 EC2 정리 때 함께 정리
  3. 모델 액세스는 계정 전체 설정이므로 다른 프로젝트가 쓰는지 확인한 뒤에만 해제
  4. Cost Explorer에서 Bedrock 비용이 더 이상 늘지 않는지 확인
- [ ] EC2 셸의 개인 `aws login` 자격 증명 정리(`aws logout`), 소유 불명 EIP 2개 확인(2.2 고정 주소)

## 4. 핸드오프

### 내가 받아야 하는 것

| 상대 | 내용 | 시점 |
|---|---|---|
| B | `requirements.txt`, 실행 모듈 경로(`uvicorn` 대상), 환경 변수 키 이름(DB 연결 URL, JWT 서명키 등), 초기 테이블 생성·시드 실행 방법 | Day 1~2 |
| B | `/api/health` 구현 여부 | Day 2 |
| C | `npm run build` 결과물 위치(`dist/`), 빌드 시 필요한 설정 | Day 3 |

### 내가 줘야 하는 것

| 상대 | 내용 | 시점 |
|---|---|---|
| B | EC2 DB 접속 방식(`127.0.0.1:3306`, DB 이름, 앱 계정 이름 — **비밀번호 제외**), 환경 파일 위치 | Day 2 |
| B | 서버에서의 로그 확인 방법(`journalctl`), 재시작 방법 | Day 2 |
| C | CloudFront 주소, 프론트 업로드·무효화 방법 | Day 3 |
| 전원 | 재배포 절차, 장애 시 연락 방법 | Day 3~4 |

비밀번호와 JWT 서명키는 채팅·Git에 남기지 않고 팀이 정한 안전한 방법으로 전달한다.

## 5. 배포 절차 (수동)

모두 EC2(`/home/ubuntu/vibe-lab/ledger-app`)에서 한다. 먼저 `git fetch origin` → `git diff --stat HEAD origin/main`으로 `backend/`·`frontend/` 중 무엇이 바뀌었는지 보고 → `git merge origin/main`(또는 `main`에서 `git pull --ff-only`).

### 백엔드 (`backend/`가 바뀌었을 때)
1. `cd backend && source ../.venv/bin/activate`
2. `requirements.txt`가 바뀌었으면 `pip install -r requirements.txt` — **재시작 전에** 해야 한다(새 import가 있으면 서비스가 뜨지 않음)
3. `python -c "from app.main import app"`로 불러오기 확인
4. 모델(테이블 구조)이 바뀌었으면 재시작 전에 B에게 `ALTER` 방법 확인(`init_db`는 기존 테이블을 바꾸지 않음)
5. `sudo systemctl restart ledger-api && sleep 3 && curl -i http://127.0.0.1:8000/api/health` (바로 curl하면 기동 전이라 연결 실패)
6. `journalctl -u ledger-api -n 30 --no-pager`로 오류 확인

### 프론트엔드 (`frontend/`가 바뀌었을 때)
1. `sudo swapon /swapfile`(재부팅 후), `cd frontend`, `package-lock.json`이 바뀌었으면 `npm ci`
2. `npm run build` → `grep -r "demo1234" dist` 결과 없음 확인(목 데이터 미포함)
3. `aws s3 sync dist/assets s3://ledger-app-s3/assets --cache-control "public,max-age=31536000,immutable"`
4. `aws s3 sync dist/ s3://ledger-app-s3/ --exclude "assets/*" --cache-control "no-cache"`
5. 필요하면 `aws cloudfront create-invalidation --distribution-id E2Q0XEE8TA0BOI --paths "/index.html"` (`index.html`이 `no-cache`라 보통 불필요)
6. `curl -s https://ledger.lsj.mzsec.cloud/ | grep -o 'assets/index-[^"]*'`가 `dist/assets` 파일명과 같은지 확인

## 6. systemd 서비스 기준

값은 `docs/ai-infra.md`의 유닛 예시(`/etc/systemd/system/ledger-api.service`)를 따른다.

| 항목 | 설정 |
|---|---|
| 실행 사용자 | `ubuntu`(root 아님) |
| 작업 디렉터리 | `/home/ubuntu/vibe-lab/ledger-app/backend` (여기서 실행해야 `app` 패키지를 찾음) |
| 환경 | `EnvironmentFile=/etc/ledger/backend.env`(따옴표 없이 `KEY=VALUE`, 권한 600) |
| 시작 순서 | `After=network.target mariadb.service`, `Requires=mariadb.service` |
| 실행 명령 | `/home/ubuntu/vibe-lab/ledger-app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers` |
| 재시작 | `Restart=always`, `RestartSec=3` |
| 자동 시작 | `WantedBy=multi-user.target`, `systemctl enable --now ledger-api` |

## 7. 인프라 검증 체크리스트

PRD 10장 수동 테스트 중 인프라와 직결된 항목이다. 실행한 결과는 직접 기록한다.

10/20 확인 결과는 `[x]` 뒤에 적었다. 확인 주소: `https://ledger.lsj.mzsec.cloud`

- [x] CloudFront HTTPS 주소로 프론트가 열린다 — `/` 200 HTML
- [x] `/dashboard` 같은 경로를 새로고침해도 화면이 뜬다 — 200 HTML
- [x] 없는 API 경로가 `index.html`이 아니라 JSON 오류(`{"detail": ...}`)로 응답한다 — `/api/nope` 404 JSON
- [x] CloudFront 주소로 API 요청이 EC2의 FastAPI까지 도달한다 — `/api/health` 200
- [x] `Authorization` 헤더가 FastAPI에 도달해 보호 API가 동작한다(401이 아닌 정상 응답) — `/api/categories` 200
- [x] PATCH·DELETE 요청이 CloudFront를 통과한다 — 없는 ID로 FastAPI의 404 JSON 수신
- [x] 외부에서 3306에 접속할 수 없다 — 바인딩 `127.0.0.1:3306`, 외부 연결 거부, 인바운드 규칙 없음
- [x] 외부에서 앱 포트로 직접 접속하는 것이 차단된다(prefix list 적용 시) — 8000은 `pl-22a6434b`만, 직접 접속 실패
- [ ] SSH 22가 팀 IP로만 열려 있다 — ⚠️ `0.0.0.0/0` 포함(2.2)
- [x] 챗봇: CloudFront 경유 `POST /api/chat` 200 (5.3초, PLAN.md A5 타임아웃 60초)
- [ ] EC2 재시작 후 MariaDB와 API 서버가 자동으로 올라온다
- [ ] 재시작 후에도 EC2 MariaDB의 데이터가 남아 있다
- [ ] `mariadb-dump` 백업이 만들어지고 테스트 DB에 복원된다
- [x] 환경 파일 권한이 600이고 Git에 올라가 있지 않다 — `/etc/ledger/backend.env` 600, `git ls-files`에 없음

## 8. 장애 대응과 리스크

| 증상·리스크 | 먼저 확인할 것 |
|---|---|
| CloudFront에서 502/504 | 앱 포트가 CloudFront 원본 설정과 일치하는지, 보안 그룹이 CloudFront에 열려 있는지, 서비스가 실행 중인지 |
| S3에서 403 | OAC와 버킷 정책이 연결되어 있는지, 기본 객체 설정 |
| API 응답이 HTML(`index.html`)로 옴 | 배포 전체 오류 응답을 쓰고 있지 않은지, `/api/*` 동작의 경로 패턴 |
| 로그인은 되는데 보호 API가 401 | 원본 요청 정책이 `Authorization` 헤더를 전달하는지 |
| PATCH·DELETE만 실패 | `/api/*` 동작의 허용 메서드 |
| 서비스가 시작되지 않음 | `journalctl` 로그, 환경 파일 경로·권한·값 형식, 가상환경 경로, MariaDB 실행 여부 |
| DB 연결 실패 | 환경 파일의 호스트가 `127.0.0.1`인지, 앱 계정·DB 이름, MariaDB 서비스 상태 |
| 챗봇 `/api/chat` 503 | 환경 파일 `CHAT_ENABLED=true`, 역할 정책 `ledger-bedrock-invoke`, `journalctl`의 Bedrock 오류(권한·모델 ID) |
| 챗봇만 504 | CloudFront EC2 원본 응답 제한 시간(60초) |
| 커스텀 도메인 인증서 경고 | CloudFront 대체 도메인·ACM(`us-east-1`) 인증서가 함께 저장됐는지, 배포 완료 여부 |
| 코드를 고쳤는데 반영되지 않음 | `git pull` 여부, 서비스 재시작 여부, CloudFront 캐시 무효화 여부 |
| 재부팅 후 서버가 꺼져 있음 | 서비스·MariaDB의 자동 시작 설정 |
| EC2 장애 | API와 DB가 함께 멈춘다. 백업과 복원 절차로 복구 |
| 원본 구간 HTTPS 없음 | 가상 데이터만 사용, README에 한계 명시 |
| 로컬 DB와 EC2 DB 혼동 | 시연 데이터는 EC2에 따로 준비하거나 명시적으로 덤프·복원 |
| 비용 | 예산 알림 확인, 시연 후 불필요한 리소스 정리 |

## 9. README에 남길 인프라 내용

- 구성도와 각 리소스의 이름·리전
- EC2 접속 방법(키 보관 위치는 적지 않음), 보안 그룹 규칙
- MariaDB 설정 요약(DB 이름, 앱 계정 이름, 바인딩, 자동 시작)
- 환경 변수 키 목록(값 제외)
- systemd 서비스명, 로그 확인 방법, 재시작 방법
- CloudFront 동작 설정(경로별 원본·캐시·메서드·헤더)
- 프론트·백엔드 수동 배포 절차
- 백업·복원 절차
- 알려진 한계: 원본 구간 HTTPS 없음, EC2 단일 장애 지점, 관리형 백업 없음