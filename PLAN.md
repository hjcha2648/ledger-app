# PLAN — 인프라(A) 4일 구현 계획

- 기준 문서: `PRD.md` (v3.2)
- 담당: **A — AWS 인프라·배포** (팀 3명: A 인프라, B 백엔드, C 프론트엔드)
- 기간: 4일 (하루 8시간)
- 목표: CloudFront HTTPS 주소에서 가입 → 거래 → 정기결제 목록 → 대시보드가 끝까지 동작하고, 데이터가 EC2 내부 MariaDB에 저장되는 환경을 만든다.

이 문서는 인프라 작업만 다룬다. 앱 요구사항은 `PRD.md`, 전체 일정은 팀 공용 `PLAN.md`를 본다.

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
| 리전 | 서울(`ap-northeast-2`) | Day 1 | 미정 |
| OS | Amazon Linux 2023 또는 Ubuntu 24.04 (패키지 관리자 `dnf` / `apt`가 달라진다) | Day 1 | 미정 |
| 인스턴스 유형·EBS 크기 | 계정의 프리티어·예산 확인 후 결정 | Day 1 | 미정 |
| 앱 포트 | 80번은 일반 사용자 권한으로 못 쓰므로 8000 같은 비특권 포트 | Day 1 | 미정 |
| 서비스명 | 예: `ledger-api` | Day 1 | 미정 |
| 프로젝트·환경 파일 경로 | 홈 디렉터리 하위의 프로젝트 폴더, 환경 파일은 권한 600 | Day 1 | 미정 |
| 고정 주소 | Elastic IP를 붙여 재시작 후에도 CloudFront 원본 주소가 바뀌지 않게 함. 과금 여부 확인 | Day 1 | 미정 |
| 원본 프로토콜 | CloudFront→EC2는 HTTP(도메인·인증서가 없으면 HTTPS 불가). 한계를 README에 명시 | Day 2 | 미정 |
| DB 이름·앱 계정 이름 | PRD 예시 기준 `ledger_db`, `app_user` | Day 1 | 미정 |

결정하면 이 표를 갱신하고 B(환경 변수 키·실행 모듈)와 C(CloudFront 주소)에게 알린다.

## 3. Day별 작업

### Day 0 (사전)
- [ ] AWS 계정 권한 확인: EC2, 보안 그룹, S3, CloudFront
- [ ] 비용 알림(예산) 설정 여부 확인, 프리티어 해당 여부 확인
- [ ] 팀 GitHub 저장소 접근 권한 확인

### Day 1 — 서버 만들기와 설계

- [ ] 2.2의 결정 사항 확정 (OS, 포트, 서비스명, 경로)
- [ ] EC2 인스턴스 생성 (키 페어 보관 방법 정리)
- [ ] 보안 그룹: SSH 22는 팀 고정 IP만, 앱 포트는 CloudFront만(아래 3.1), **3306은 열지 않음**
- [ ] (제안) Elastic IP 연결
- [ ] 서버 접속 확인, 시간대·패키지 업데이트
- [ ] MariaDB 설치·설정 절차서 작성(설치 순서, DB·계정 생성, 환경 파일 위치)
- [ ] B·C에게 전달할 정보 목록 초안 작성(4장)

**종료 기준**: SSH로 EC2에 접속되고, 보안 그룹이 의도대로 설정되어 있으며, MariaDB·서비스 설계 문서가 있다.

#### 3.1 보안 그룹 설계

| 규칙 | 값 | 비고 |
|---|---|---|
| SSH 22 | 팀 고정 IP만 | 전체 개방(`0.0.0.0/0`) 금지 |
| 앱 포트(예: 8000) | CloudFront 관리형 prefix list `com.amazonaws.global.cloudfront.origin_facing` | 직접 접근 차단 효과. 콘솔에서 prefix list 선택 가능 여부 확인 |
| 3306 | **인바운드 없음** | MariaDB는 로컬 전용 |

### Day 2 — MariaDB와 API 서버 구동

- [ ] MariaDB 설치, 부팅 시 자동 시작 설정
- [ ] `bind-address=127.0.0.1` 확인, 3306이 외부에서 닫혀 있는지 확인
- [ ] 문자셋 확인(한글 사용 가능하게), 전용 DB 생성
- [ ] 최소 권한 앱 계정 생성(해당 DB 권한만), 비밀번호가 쉘 기록·로그에 남지 않게 입력
- [ ] 앱 계정으로 `127.0.0.1` 접속 테스트
- [ ] Python 설치 확인, 프로젝트 `git clone`, venv 생성, 의존성 설치(B의 `requirements.txt` 기준)
- [ ] 환경 파일 작성(권한 600): DB 연결 URL, JWT 서명키. B와 키 이름 합의
- [ ] 최초 테이블 생성·기본 카테고리 시드(B의 초기화 방법에 따름)
- [ ] systemd 서비스 작성·등록·시작 (아래 6장 참고)
- [ ] `/api/health`를 서버 안에서 `curl`로 확인 → 보안 그룹을 통한 외부 접근 확인
- [ ] B의 API를 EC2에서 수동 검증하도록 지원

**종료 기준**: EC2에서 MariaDB와 API 서버가 구동되고, 서버 재시작 후에도 자동으로 올라온다.

### Day 3 — S3와 CloudFront

- [ ] S3 버킷 생성(공개 차단 유지), CloudFront OAC로 접근 허용
- [ ] CloudFront 배포 생성: 기본 동작 `/*` → S3, 기본 객체 `index.html`
- [ ] 원본 추가: EC2(퍼블릭 DNS 이름, HTTP, 앱 포트)
- [ ] 동작 추가 `/api/*` → EC2 원본 (아래 3.2)
- [ ] SPA 새로고침 처리: 기본 동작에만 적용되는 방법 사용 (아래 3.3)
- [ ] C의 임시 빌드를 업로드해 CloudFront 주소에서 화면 표시 확인
- [ ] CloudFront 주소로 `/api/health`, 로그인 요청 확인
- [ ] C에게 CloudFront 주소와 업로드 방법 전달

**종료 기준**: CloudFront HTTPS 주소에서 프론트가 열리고 `/api/*`가 EC2의 FastAPI에 도달한다.

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

**오전**
- [ ] 프론트 최종 빌드 업로드, CloudFront 캐시 무효화
- [ ] 백엔드 최종 `git pull` → 의존성 설치 → 서비스 재시작
- [ ] 7장 검증 체크리스트 실행(B·C와 함께 PRD 10장 수동 테스트도 진행)

**오후 (기능 추가 중지)**
- [ ] 배포 장애 대응
- [ ] `mariadb-dump` 백업 생성 → 별도 테스트 DB에 복원해 행 수 비교(운영 DB를 덮어쓰지 않음)
- [ ] 시연용 계정·가상 데이터를 EC2 DB에 준비(로컬 DB와 별개)
- [ ] **EC2 재부팅 후 MariaDB·API 자동 복구와 데이터 유지 확인**
- [ ] README의 인프라 절 정리(8장)
- [ ] 시연 후 리소스 정리 계획 확인(EC2, Elastic IP, CloudFront, S3 비용)

**종료 기준**: CloudFront 주소에서 전체 시연이 성공한다.

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

### 프론트엔드
1. C의 저장소에서 `npm install`, `npm run build`
2. `dist/` 내용을 S3 버킷에 업로드
3. CloudFront 캐시 무효화(필요한 경로만, 예: `/index.html`)
4. CloudFront HTTPS 주소에서 SPA 라우팅과 API 연동 확인

### 백엔드
1. EC2에서 프로젝트 폴더로 이동해 `git pull`
2. venv를 활성화하고 의존성 설치
3. MariaDB 서비스 실행과 환경 변수 점검, 최초 1회 테이블 초기화
4. 서비스 재시작, 상태 확인
5. `journalctl`로 최근 로그 확인
6. `/api/health`와 실제 인증·거래 요청으로 연결 확인

## 6. systemd 서비스 기준

값은 2.2에서 확정한 뒤 채운다. 아래는 구성 항목이다.

| 항목 | 설정 |
|---|---|
| 실행 사용자 | 일반 사용자(root 아님) |
| 작업 디렉터리 | 백엔드 프로젝트 폴더 |
| 환경 | `EnvironmentFile`로 환경 파일 지정(따옴표 없이 `KEY=VALUE`) |
| 시작 순서 | MariaDB 서비스 이후에 시작(`After=`, `Wants=`) |
| 실행 명령 | venv의 `uvicorn`으로 `<모듈경로>:app`, 호스트 `0.0.0.0`, 앱 포트 |
| 재시작 | `Restart=always` |
| 자동 시작 | `systemctl enable` |

## 7. 인프라 검증 체크리스트

PRD 10장 수동 테스트 중 인프라와 직결된 항목이다. 실행한 결과는 직접 기록한다.

- [ ] CloudFront HTTPS 주소로 프론트가 열린다
- [ ] `/dashboard` 같은 경로를 새로고침해도 화면이 뜬다
- [ ] 없는 API 경로가 `index.html`이 아니라 JSON 오류(`{"detail": ...}`)로 응답한다
- [ ] CloudFront 주소로 API 요청이 EC2의 FastAPI까지 도달한다
- [ ] `Authorization` 헤더가 FastAPI에 도달해 보호 API가 동작한다(401이 아닌 정상 응답)
- [ ] PATCH·DELETE 요청이 CloudFront를 통과한다
- [ ] 외부에서 3306에 접속할 수 없다
- [ ] 외부에서 앱 포트로 직접 접속하는 것이 차단된다(prefix list 적용 시)
- [ ] EC2 재시작 후 MariaDB와 API 서버가 자동으로 올라온다
- [ ] 재시작 후에도 EC2 MariaDB의 데이터가 남아 있다
- [ ] `mariadb-dump` 백업이 만들어지고 테스트 DB에 복원된다
- [ ] 환경 파일 권한이 600이고 Git에 올라가 있지 않다

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