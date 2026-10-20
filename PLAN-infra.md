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
| 추가 기능 AWS | 챗봇 Bedrock 권한([docs/bedrock-infra.md](docs/bedrock-infra.md)), 월간 명세서 메일 SES 발신 설정(10장), 영수증 인식 서버 반영·검증(11장) |

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
| SES 발신 주소 | 도메인 인증(`lsj.mzsec.cloud`) 후 `noreply@lsj.mzsec.cloud` — Gmail 발신보다 스팸·DMARC 거부 위험이 낮음(10장) | Day 3 | **`noreply@lsj.mzsec.cloud`** (도메인 자격 증명 `lsj.mzsec.cloud`, 10/20 인증 완료) |
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
- [ ] 월간 명세서 메일(SES) 정리 계획 — 10.7 참고
- [ ] 영수증 인식 정리 계획 — 11.8 참고
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
| 명세서 메일 503 | 환경 파일 `EMAIL_ENABLED=true`·`SES_SENDER`, 역할의 `ses:SendEmail`, 받는 주소가 SES에서 "확인됨"인지(샌드박스), `journalctl`의 SES 오류 |
| 명세서 메일이 안 옴(202인데) | 스팸함, SES 콘솔 → 계정 대시보드의 발송·반송 수, 도메인 DKIM 상태 |
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

## 10. 추가 기능 — 월간 명세서 메일 (Amazon SES)

기능 요구사항·API·B/C 작업은 [PLAN.md](PLAN.md) 기능 2(8장)가 기준이다. 이 장은 A의 작업(EA1~EA5)을 실행 순서로 풀어 쓴다.

### 10.1 현재 상태 (10/20 확인)

| 항목 | 상태 |
|---|---|
| SES 계정(`ap-northeast-2`) | **샌드박스**(프로덕션 접근 꺼짐), 발송 가능, 하루 200통·초당 1통, 인증된 자격 증명 0개 |
| 도메인 | `lsj.mzsec.cloud` Route 53 호스팅 영역 `Z00757162MDDQ6EH5XMRT`(같은 계정). TXT·MX·DMARC 레코드 없음 |
| 백엔드 코드 | B의 E1~E4 대기. 환경 변수 이름은 PLAN.md 기준(`EMAIL_ENABLED`, `SES_REGION`, `SES_SENDER`) — 코드가 오면 `.env.example`과 대조 |

**진행 (10/20, A)**: EA1 완료(도메인 확인됨·DKIM SUCCESS, Route 53에 DKIM CNAME 3개 + `_dmarc` TXT 추가), EA3 완료(인라인 정책 `ledger-ses-send`, 역할로 시뮬레이터 발송 성공, 다른 발신 주소는 AccessDenied 확인). EA2 진행 중(A 본인 Gmail 인증·실제 수신 확인, 팀원·시연 계정 주소 남음).

**진행 (10/20 오후, B 반영 → A 확인)**: B가 PR #18·#19로 메일 API와 **앱 안 받는 주소 인증 흐름(E7)**을 추가하고 서버에 반영했다.
- EA3b: 인라인 정책 `ledger-ses-verify` 추가 — `ses:GetAccount`(`*`), `ses:GetEmailIdentity`·`ses:CreateEmailIdentity`(`identity/*`). `DeleteEmailIdentity`는 없음(발신 도메인 보호)
- EA4: 환경 파일에 `EMAIL_ENABLED=true`, `SES_SENDER=noreply@lsj.mzsec.cloud` 추가(`SES_REGION`은 코드 기본값 `ap-northeast-2`), 06:38 UTC 재시작, 프론트 06:44 UTC S3 반영
- 확인: `user@example.com` 계정으로 `email-status` → `unverified`, `monthly-email` → 409(인증 필요). 실제 주소 인증 흐름(테스트 A)은 남음
- 리스크 추가: 가입한 사람은 누구나 **자기 가입 주소로** AWS 인증 메일을 요청할 수 있다 → 남의 주소로 가입하면 그 사람에게 AWS 메일이 간다(1분 1회 제한). 시연 기간만 운영하고 10.7에서 정리

### 10.2 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 발신 자격 증명 | **도메인 `lsj.mzsec.cloud`** (Easy DKIM, Route 53 자동 등록) | PLAN.md 기본안(팀 Gmail)은 Gmail의 DMARC 정책 때문에 SES로 보내면 스팸함·거부 위험이 크다. 우리 도메인이 Route 53에 있어 DKIM 레코드를 버튼 하나로 넣을 수 있다 |
| 발신 주소 | `noreply@lsj.mzsec.cloud` (**확정 필요**, 2.2) | 도메인이 인증되면 그 도메인의 어떤 주소로든 보낼 수 있다. 받는 메일함은 없다 |
| 받는 주소 | 샌드박스이므로 **SES에서 인증한 개인 주소만** (팀원 3명 + 시연 계정) | 샌드박스 제약. 시연 계정은 인증된 실제 메일로 가입 |
| 권한 | 역할 `ledger-ec2-role`에 `ses:SendEmail`, 발신 주소 조건으로 제한 | 최소 권한, 액세스 키 없음 |
| 보안 그룹·CloudFront | **변경 없음** | EC2 → SES는 아웃바운드 HTTPS. `/api/*`는 이미 POST 허용·캐시 없음, 응답 202도 그대로 전달 |
| 자동 발송(PLAN.md E5, 매월 1일) | **하지 않음**(MVP는 버튼 발송만) | systemd timer는 1장 "하지 않는 것"(cron류)에 걸린다. 하려면 팀 합의 후 이 문서를 먼저 고친다 |

### 10.3 작업 순서

| 순서 | # | 작업 | 어디서 | 완료 기준 |
|---|---|---|---|---|
| 1 | EA1 | 도메인 자격 증명 생성·DKIM 인증 | SES 콘솔 | 도메인 "확인됨", DKIM "성공" |
| 2 | EA1 | (권장) DMARC 레코드 추가 | Route 53 | `dig TXT _dmarc.lsj.mzsec.cloud` 응답 |
| 3 | EA2 | 받는 주소 인증(팀원 3명 + 시연 계정) | SES 콘솔 + 각자 메일함 | 각 주소 "확인됨" |
| 4 | EA3 | 역할에 `ses:SendEmail` 추가 | IAM 콘솔 | 정책 연결 확인 |
| 5 | EA3 | 역할 자격 증명으로 테스트 발송 | EC2 | 인증된 주소 받은편지함에 수신 |
| 6 | EA4 | B 코드 반영 후 환경 파일 키 추가 → 재시작 | EC2 | CloudFront 주소에서 버튼 → 메일 수신 |
| 7 | EA5 | (선택) 프로덕션 접근 요청 | SES 콘솔 | 승인 시 미인증 주소로도 발송 |

1~5는 B의 코드 없이 먼저 할 수 있다. 받는 주소 인증(3)은 각자 메일의 링크를 눌러야 하므로(24시간 내) 가장 먼저 요청해 둔다.

### 10.4 단계별 방법

**EA1-1. 도메인 자격 증명 (SES 콘솔, 리전 `ap-northeast-2`)**
1. SES → 구성: **자격 증명 → 자격 증명 생성** → 유형 **도메인**, 도메인 `lsj.mzsec.cloud`
2. 고급 DKIM 설정: **Easy DKIM**, `RSA_2048_BIT`, **Route 53에 DNS 레코드 게시** 체크(같은 계정이라 자동)
3. 생성 → DKIM CNAME 3개가 Route 53 `lsj.mzsec.cloud` 영역에 자동으로 들어간다(지우지 않는다)
4. 확인(EC2, 조회만):
   ```bash
   aws sesv2 get-email-identity --region ap-northeast-2 --email-identity lsj.mzsec.cloud \
     --query '[VerifiedForSendingStatus,DkimAttributes.Status]' --output text   # True  SUCCESS
   ```
   보통 수 분, 길면 72시간. `PENDING`이면 기다린다.

**EA1-2. DMARC (권장, Route 53)**
`lsj.mzsec.cloud` 영역 → 레코드 생성: 이름 `_dmarc`, 유형 `TXT`, 값 `"v=DMARC1; p=none;"`.
`p=none`은 수신 측에 정책만 알리고 차단은 요구하지 않는다. DKIM 정렬로 DMARC를 통과하므로 별도 MAIL FROM 설정은 하지 않는다.

**EA2. 받는 주소 인증 (SES 콘솔)**
1. 자격 증명 생성 → 유형 **이메일 주소** → 팀원 메일·시연 계정 메일을 하나씩 추가
2. 각 주소로 AWS 인증 메일이 간다 → 본인이 24시간 안에 링크 클릭
3. 확인: `aws sesv2 list-email-identities --region ap-northeast-2 --query 'EmailIdentities[].[IdentityName,VerificationStatus]' --output text`
4. 인증한 주소 목록은 이 문서에 적지 않는다(개인 메일). 팀 채널에서만 공유

**EA3-1. 역할 권한 (IAM 콘솔)**
`ledger-ec2-role` → 권한 추가 → 인라인 정책 생성 → JSON → 이름 `ledger-ses-send`:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "SesSendFromLedgerDomain",
    "Effect": "Allow",
    "Action": "ses:SendEmail",
    "Resource": "arn:aws:ses:ap-northeast-2:<계정ID>:identity/*",
    "Condition": { "StringEquals": { "ses:FromAddress": "noreply@lsj.mzsec.cloud" } }
  }]
}
```
- 대상이 `identity/*`인 이유: 샌드박스에서는 받는 주소의 자격 증명도 권한 검사 대상이 될 수 있어, 발신 도메인 ARN만 적으면 발송이 거부될 수 있다. 대신 `ses:FromAddress` 조건으로 **발신 주소를 하나로 고정**한다.
- Bedrock 정책(`ledger-bedrock-invoke`)과 분리해 두면 기능별로 따로 끌 수 있다.

**EA3-2. 테스트 발송 (EC2)** — 역할 자격 증명으로 실행(개인 `AWS_PROFILE` 제외):
```bash
env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE aws sesv2 send-email --region ap-northeast-2 \
  --from-email-address noreply@lsj.mzsec.cloud \
  --destination ToAddresses=<인증된 받는 주소> \
  --content 'Simple={Subject={Data=ledger SES test},Body={Text={Data=test}}}'
```
`MessageId`가 나오고 받은편지함(또는 스팸함)에 도착하면 성공. Gmail이면 메일 → "원본 보기"에서 `DKIM: PASS`, `DMARC: PASS`를 확인한다.

| 오류 | 원인 |
|---|---|
| `AccessDenied ... ses:SendEmail` | EA3-1 정책 누락·발신 주소 불일치 |
| `MessageRejected: Email address is not verified` | 받는 주소가 EA2에서 아직 "확인됨"이 아님(샌드박스) |

**EA4. 서버 반영 (B의 E1~E4가 main에 들어온 뒤)**
1. 5장 절차로 코드 반영(`git merge origin/main` → `pip install -r requirements.txt` → 불러오기 확인)
2. B의 `.env.example`에서 키 이름 확인 후, 백업하고 추가:
   ```bash
   sudo cp -p /etc/ledger/backend.env /etc/ledger/backend.env.bak-$(date +%Y%m%d-%H%M)
   cat >> /etc/ledger/backend.env <<'EOF'
   EMAIL_ENABLED=true
   SES_REGION=ap-northeast-2
   SES_SENDER=noreply@lsj.mzsec.cloud
   EOF
   grep -oE '^[A-Z_]+' /etc/ledger/backend.env      # 키 이름만, 중복 없는지
   ```
3. `sudo systemctl restart ledger-api && sleep 3 && curl -i http://127.0.0.1:8000/api/health`
4. 프론트(EF1~EF3)가 main에 들어왔으면 5장 절차로 S3 재배포

**EA5. 프로덕션 접근 (선택)**
SES → 계정 대시보드 → **프로덕션 액세스 요청**. 용도(가계부 앱의 본인 명세서 발송, 사용자 요청 시 1통, 반송·수신 거부 처리 방법)를 적는다. 승인까지 하루 이상 걸릴 수 있어 시연 일정에는 기대하지 않는다.

### 10.5 검증

테스트 주소 두 가지:
- **흐름만 확인** — SES 메일박스 시뮬레이터 `success@simulator.amazonses.com`. 샌드박스에서도 인증 없이 발송되고 한도에 잡히지 않는다. 이 주소로 앱에 가입해 버튼 → 202면 권한·환경 파일·코드·CloudFront 경로가 정상(메일 내용은 볼 수 없음). `bounce@`·`complaint@`는 평판 지표에 남을 수 있어 쓰지 않는다.
- **내용·수신함 확인** — 팀원 실제 메일 1개를 EA2로 인증하고 그 주소로 가입. Gmail `+` 별칭도 가능(별칭 그대로 인증). `user@example.com` 같은 가짜 주소 계정은 503이 정상.

- [x] 도메인 `lsj.mzsec.cloud` 확인됨, DKIM 성공 (10/20)
- [ ] 받는 주소(팀원·시연 계정) 모두 확인됨
- [x] 역할 자격 증명으로 시뮬레이터 발송 성공, 허용 외 발신 주소는 AccessDenied (10/20)
- [x] 역할 자격 증명으로 실제 주소(A의 Gmail, EA2 인증)에 테스트 메일 수신 (10/20). 헤더 DKIM·DMARC 결과는 미확인
- [ ] CloudFront 주소에서 버튼 → 202 → 본인 메일 수신, 금액이 대시보드와 일치
- [ ] 5분 내 재요청 429, `EMAIL_ENABLED=false`면 503
- [ ] 환경 파일 600 유지, AWS 키 없음(역할만 사용)

### 10.6 리스크

| 리스크 | 대응 |
|---|---|
| 샌드박스라 미인증 주소로 못 보냄 | 시연 계정을 인증된 메일로 가입. 미인증이면 503(B 처리) |
| DKIM 인증 지연 | EA1을 가장 먼저 시작. 지연되면 시연 전까지 기능 끔(`EMAIL_ENABLED=false`) |
| 스팸함 분류 | DKIM·DMARC 설정, 시연 전 실제 수신함 확인 |
| 남용·평판 하락 | 본인 주소 고정·5분 1회(B), SES 하루 200통 한도. 반송률이 오르면 SES가 발송을 멈출 수 있음 |
| 비용 | SES 발송은 1,000통당 약 $0.10 수준. A6 예산 알림에 포함 |

### 10.7 시연 후 정리 (T20, 팀 확인 후)

1. 환경 파일 `EMAIL_ENABLED=false` → 재시작
2. `ledger-ec2-role`에서 인라인 정책 `ledger-ses-send`, `ledger-ses-verify` 제거
3. SES 자격 증명(도메인, 받는 주소 — 앱에서 인증 요청한 사용자 주소가 쌓여 있음) 삭제 — 삭제 전 다른 용도가 없는지 확인
4. Route 53에서 SES용 레코드(DKIM CNAME 3개, `_dmarc` TXT) 삭제 — **다른 레코드(A 별칭, ACM 검증 CNAME)는 지우지 않는다**

## 11. 추가 기능 — 영수증·명세서 인식 (Bedrock 멀티모달)

기능 요구사항·API·B/C 작업은 [PLAN.md](PLAN.md) 기능 3(9장)이 기준이다. 이 장은 A의 작업(RA1~RA3)과 그 전후 확인을 실행 순서로 풀어 쓴다.

### 11.1 범위 확인

- **자동 저장은 하지 않는다.** 분석 결과는 입력 초안이고, 사용자가 확인한 항목만 기존 `POST /api/transactions`로 저장한다(PLAN.md 9.0, AGENTS.md 4번 예외 조건). "업로드하면 거래에 자동 추가"로 바꾸려면 팀 합의와 AGENTS.md 수정이 먼저다.
- **파일은 보관하지 않는다.** S3 버킷·DB를 새로 만들지 않는다.
- 인프라 변경은 작다: 새 AWS 서비스 없음, 보안 그룹·CloudFront 설정 변경 없음. 권한·설정 확인과 서버 반영이 중심이다.

### 11.2 현재 상태 (10/20 확인)

| 항목 | 상태 |
|---|---|
| 백엔드 코드 | B의 R1~R6 반영(PR #23). 서버 반영 완료(아래 진행) |
| Bedrock 권한 | `ledger-bedrock-invoke`가 `opus-5-5`·`opus-4-8` 호출 허용. 영수증도 챗봇과 같은 `BEDROCK_*` 설정을 씀(`.env.example`) → **권한 추가 없음**(RA1 완료) |
| CloudFront 본문 크기 | **사전 확인 완료** — 5MB(5,243,077B) multipart를 `/api/receipts/analyze`로 보내 FastAPI의 404 JSON 수신(CloudFront 413 없음) |
| CloudFront 타임아웃 | EC2 원본 60초(기능 1의 A5). B의 Bedrock 타임아웃 45초보다 길다 |
| 서버 자원 | `t3.small` 메모리 1.9GB + 스왑 1GB. 요청당 파일 5MB + base64(약 6.7MB) 수준이고 분당 5회 제한이 있어 충분 |

**진행 (10/20 07:11 UTC, A)**: RA1·RA2·RA3 완료. `pip install`(`python-multipart==0.0.32`) → 환경 파일 백업(`backend.env.bak-20261020-0711`) 후 `RECEIPT_ENABLED=true` 추가(크기·횟수 제한은 코드 기본값 5MB·분당 5회) → 재시작 → `/api/health` 200. 프론트(RF1~RF6)는 C 대기.

### 11.3 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 모델 | 기능 1과 같은 `BEDROCK_MODEL_ID` | IAM 변경 없음. 다른 모델(예: 비용 때문에 Sonnet·Haiku)을 쓰면 **그 모델의 inference profile·foundation model ARN을 `ledger-bedrock-invoke`에 추가**해야 한다 |
| 업로드 경로 | 브라우저 → CloudFront → EC2 (기존 `/api/*`) | 파일을 저장하지 않으므로 S3 업로드(사전 서명 URL)가 필요 없다 |
| 크기 제한 | 5MB(앱에서 검사) | CloudFront·uvicorn에는 별도 제한이 없어 앱 검사가 유일한 상한 |
| 임시 파일 | 요청 중 `/tmp`에 잠시 쓰일 수 있음(1MB 넘는 업로드는 Starlette가 임시 파일로 받음), 요청 끝나면 삭제 | "서버에 남지 않음"은 11.5에서 업로드 후 `/tmp` 확인으로 검증 |

### 11.4 작업 순서

| 순서 | # | 작업 | 어디서 | 완료 기준 |
|---|---|---|---|---|
| 0 | — | (권장) A6 비용 알림 먼저 설정 | 결제 콘솔 | 이미지·PDF 입력은 토큰이 많아 비용이 챗봇보다 크다 |
| 1 | RA1 | B가 쓰는 모델 ID 확인 → 같으면 권한 변경 없음, 다르면 ARN 추가 | 코드·IAM | `.env.example`의 모델 키 확인 |
| 2 | RA2 | CloudFront 확인(사전 확인 완료) — 코드 반영 후 실제 5MB 이미지로 재확인 | EC2 `curl` | 200 또는 앱의 413/422(CloudFront 오류 아님) |
| 3 | RA3 | 코드 반영 → `pip install` → 환경 파일 `RECEIPT_ENABLED=true` → 재시작 | EC2 | `/api/health` 200 |
| 4 | — | 프론트(RF1~RF6) S3 재배포 | EC2 | 사이트 js 이름이 새 빌드와 같음 |
| 5 | — | 11.5 검증 | 브라우저·EC2 | 전 항목 통과 |

### 11.5 단계별 방법

**RA1. 모델·권한 확인 (B 코드가 main에 들어온 뒤)**
```bash
git show origin/main:backend/.env.example | grep -E 'RECEIPT|BEDROCK'     # 영수증 전용 모델 키가 있는지
aws iam get-role-policy --role-name ledger-ec2-role --policy-name ledger-bedrock-invoke \
  --query 'PolicyDocument.Statement[].Resource' --output text               # 허용된 모델 ARN
```
영수증용 모델이 따로 있으면 그 모델의 inference profile ARN(`ap-northeast-2`)과 foundation model ARN(`*` 리전) 두 줄을 정책에 추가한다(docs/bedrock-infra.md A2와 같은 방식).

**RA3. 서버 반영**
1. 5장 절차로 코드 반영 — `python-multipart`가 새로 들어오므로 `pip install -r requirements.txt`를 **재시작 전에** 한다
2. 백업 후 키 추가(B의 `.env.example`에서 이름 확인):
   ```bash
   sudo cp -p /etc/ledger/backend.env /etc/ledger/backend.env.bak-$(date +%Y%m%d-%H%M)
   echo 'RECEIPT_ENABLED=true' >> /etc/ledger/backend.env
   grep -oE '^[A-Z_]+' /etc/ledger/backend.env     # 키 이름만, 중복 없는지
   ```
3. `sudo systemctl restart ledger-api && sleep 3 && curl -i http://127.0.0.1:8000/api/health`

**RA2 재확인·기능 확인 (EC2, 로그인 토큰 필요)**
```bash
D=https://ledger.lsj.mzsec.cloud
curl -s -w ' %{http_code} %{time_total}s\n' -X POST $D/api/receipts/analyze \
  -H "Authorization: Bearer $TOKEN" -F "file=@<샘플 영수증.jpg>;type=image/jpeg"
```
| 결과 | 의미 |
|---|---|
| 200 + `items` | 정상 |
| 413(앱 JSON) | 5MB 초과 — 정상 거부 |
| 503 | `RECEIPT_ENABLED`, Bedrock 권한·모델 ID, `journalctl` 확인 |
| 504 | CloudFront 60초 초과 — B의 타임아웃(45초)·이미지 크기 확인 |
| 403/HTML 오류 | CloudFront 단계 문제(동작·메서드) |

### 11.6 검증

- [x] CloudFront가 5MB multipart 본문을 EC2까지 전달 (10/20, 경로 없는 상태에서 FastAPI 404 JSON 수신)
10/20 확인은 CloudFront 경유(`https://ledger.lsj.mzsec.cloud`), 테스트 계정, 가상 영수증 PDF(텍스트 PDF, 한글 폰트·이미지 도구가 EC2에 없어 PDF로 대체)로 했다.

- [x] 샘플 영수증 → 200, 6.2초. 금액 15,500·날짜 2026-10-18·사용처·카테고리(식비) 정확
- [ ] 샘플 영수증 **사진**(JPEG/PNG) → 200 — 휴대폰 촬영본으로 브라우저에서 확인 필요
- [x] 6MB 413, 확장자만 `.jpg`인 텍스트 파일 422, 파일 없음 422, 토큰 없음 401 — 모두 앱 JSON 응답
- [x] 업로드 후 `/tmp`·`/var/tmp`에 남은 파일 없음(서비스 `PrivateTmp=no`, 전후 비교)
- [x] `journalctl -u ledger-api`에 영수증 내용(가게명·금액·품목) 없음 — 접근 로그 한 줄만
- [ ] `RECEIPT_ENABLED=false`면 503 (재시작이 필요해 생략, smoke로 대체 가능)
- [x] 분석만으로 거래가 저장되지 않음 — 분석 후 10월 거래 수 0 그대로. 저장은 C의 화면(RF5)에서 확인

### 11.7 리스크

| 리스크 | 대응 |
|---|---|
| 비용(이미지·PDF 입력 토큰) | 분당 5회·파일 1개·5MB 제한(B), A6 예산 알림 먼저 |
| Bedrock 이미지 입력 한도(장 크기·해상도) | 5MB 이미지가 모델 한도를 넘는지 B가 확인, 넘으면 서버에서 축소. 503이 나면 먼저 의심 |
| 개인정보가 찍힌 이미지 | 시연은 가상·샘플 영수증만. 파일 보관·로그 금지(B), `/tmp`·로그 점검(11.6) |
| 응답 지연 | B 타임아웃 45초 < CloudFront 60초. 반복되면 이미지 축소 |
| 메모리 | 동시 업로드가 몰리면 1.9GB가 빠듯 — 분당 5회 제한과 스왑으로 대응, `free -h` 확인 |

### 11.8 시연 후 정리 (T20)

1. 환경 파일 `RECEIPT_ENABLED=false` → 재시작
2. 영수증용으로 모델 ARN을 추가했다면 `ledger-bedrock-invoke`에서 제거(챗봇 정리와 함께)
3. Cost Explorer에서 Bedrock 비용 확인