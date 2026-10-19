@AGENTS.md

---

# CLAUDE.md — 인프라(A) 작업 지침

개인 가계부 & 정기결제 관리 웹앱의 **AWS 인프라·배포**를 맡은 사람(역할 A)이 Claude Code와 작업할 때 지키는 규칙이다.

## 먼저 읽을 문서

- `PRD.md` — 요구사항 기준. 특히 8장(아키텍처·배포), 9장(보안), 10장(수동 테스트)
- `PLAN.md` — 인프라 4일 계획과 결정 사항 표
- `AGENT.md` — 인프라 역할 가이드, 장애 진단 순서, 보고 양식

문서와 요청이 충돌하면 임의로 정하지 말고 사용자에게 먼저 묻는다.

## 작업 범위

**한다**
- EC2 생성·설정, 보안 그룹, Python venv, systemd 서비스
- EC2 내부 MariaDB 설치·설정·백업·복원 검증
- S3 버킷, CloudFront 배포(S3 원본 + EC2 원본)
- 환경 파일 작성 방법 안내, 수동 배포 절차, 장애 진단
- 인프라 관련 README·문서 작성

**하지 않는다**
- 앱 코드(`backend/`, `frontend/`) 수정. B·C 소유이다. 앱 쪽 수정이 필요하면 요청 내용을 글로 적어 넘긴다.
- RDS, Docker/Compose, CI/CD(GitHub Actions), IaC(Terraform·CDK), EventBridge/cron, Cognito 도입
- 3306 포트 외부 개방
- PRD가 정한 범위를 넘는 인프라 확장(로드 밸런서, 오토스케일링, 다중 서버 등)

## 인프라 구성 (PRD 기준)

```text
사용자 브라우저
  └─ HTTPS ─> CloudFront
                 ├─ /* ─────> S3 (React 정적 빌드, 비공개 + OAC)
                 └─ /api/* ─> EC2 (FastAPI + systemd)
                                  └─ EC2 내부 MariaDB (127.0.0.1:3306)
```

- 기본 VPC를 쓴다. 별도 VPC를 만들지 않는다.
- FastAPI는 Python venv + systemd로 실행한다. 컨테이너는 쓰지 않는다.
- 로컬 개발 DB(WSL)와 EC2 DB는 별개이다. 지금 어느 쪽에서 작업 중인지 항상 확인한다.

## 아직 정해지지 않은 값 — 가정하지 말고 물어본다

OS(Amazon Linux 2023 / Ubuntu 24.04), 리전, 인스턴스 유형, EBS 크기, 앱 포트, 서비스명, 프로젝트·환경 파일 경로, Elastic IP 사용 여부, DB·앱 계정 이름. `PLAN.md` 2.2의 표에서 확정된 것만 쓴다. 비어 있으면 명령을 만들기 전에 사용자에게 값을 묻는다.

OS에 따라 패키지 관리자(`dnf` / `apt`)와 패키지 이름이 다르다. 사용자의 OS를 확인하기 전에는 명령을 하나로 단정하지 말고, 패키지 이름은 검색 명령(`dnf search`, `apt search`)으로 확인하게 한다.

## 명령 실행 원칙

1. **먼저 읽기 전용 진단**부터 한다. 상태 확인(`systemctl status`, `journalctl`, `ss -tlnp`, `ls -l`, `curl`)으로 사실을 확인한 뒤 수정한다.
2. 명령을 제시할 때는 무엇을 하는지, 어느 서버(로컬/EC2)에서 실행하는지, 예상 결과를 함께 적는다.
3. 설정 파일을 고치기 전에 백업 사본을 만들게 한다.
4. 한 번에 여러 변경을 몰아서 하지 않는다. 변경 하나 → 확인 → 다음 변경 순서로 간다.
5. 확인하지 않은 것을 확인했다고 말하지 않는다. 실행 결과를 보지 못했다면 '검증 전'이라고 쓴다.
6. 오류가 나면 추측으로 전체를 다시 구성하지 말고, 로그에서 확인된 사실과 추정을 나누어 원인을 좁힌다.

## 절대 하지 않는 것 (제안도 하지 않는다)

- 보안 그룹의 `0.0.0.0/0` 개방, 특히 SSH(22)와 3306
- MariaDB를 `0.0.0.0`에 바인딩하거나 root 원격 접속 허용
- root 계정으로 애플리케이션을 실행하거나 앱이 root DB 계정을 쓰게 하기
- `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, `rm -rf` 등 데이터·디렉터리를 지우는 명령
- 인스턴스 종료(terminate), 버킷·배포 삭제, EBS 볼륨 삭제를 확인 없이 안내하기
- 인증 비활성화, 보안 설정을 끄는 우회 방법
- 운영·시연 DB에 백업 파일을 바로 덮어쓰기(복원은 별도 테스트 DB에서 먼저 검증)

위험한 작업이 꼭 필요해 보이면 실행하지 말고 이유와 영향을 설명한 뒤 사용자에게 먼저 확인한다.

## 비밀 값 처리

- DB 비밀번호, JWT 서명키, AWS 액세스 키, SSH 개인 키를 **채팅·코드·커밋·로그·문서에 쓰지 않는다.** 예시에는 `<password>`, `<jwt-secret>` 같은 자리표시자를 쓴다.
- 환경 파일은 서버에만 두고, 권한은 소유자만 읽고 쓰게(600) 한다. Git에 올리지 않는다.
- 환경 파일 내용을 출력하는 명령(`cat` 등)을 안내하지 않는다. 확인이 필요하면 키 이름만 보는 방법(예: 값을 가리고 키만 출력)을 쓴다.
- 비밀번호를 입력하는 명령은 쉘 기록에 남지 않는 방법(대화형 입력, 프롬프트)을 안내한다.
- 환경 파일 형식은 `KEY=VALUE` 한 줄씩이며, 값에 따옴표·공백·주석을 넣지 않는다(systemd `EnvironmentFile` 기준).

## 설정 기준

### MariaDB
- 부팅 시 자동 시작, `bind-address=127.0.0.1`
- 한글 사용이 가능한 문자셋 확인
- 전용 DB 하나, 앱 전용 계정에는 그 DB 권한만 부여
- 앱은 `127.0.0.1:3306`으로 접속한다(PRD 예시: `mysql+pymysql://app_user:<password>@127.0.0.1:3306/ledger_db`, 이름은 확정 후 사용)

### systemd (값은 확정 후)
- 일반 사용자로 실행, `WorkingDirectory`는 백엔드 폴더
- `EnvironmentFile`로 환경 파일 지정
- MariaDB 이후에 시작(`After=`/`Wants=`), `Restart=always`, `enable`로 자동 시작
- 실행 명령은 venv의 `uvicorn <모듈경로>:app --host 0.0.0.0 --port <앱 포트>`

### CloudFront
- `/*` → S3(OAC, 버킷 공개 차단 유지), 기본 객체 `index.html`
- `/api/*` → EC2 원본(퍼블릭 DNS 이름)
  - 캐시 비활성화
  - 허용 메서드: `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE` (PATCH·DELETE가 빠지면 거래 수정·삭제가 실패한다)
  - `Authorization` 헤더와 쿼리 문자열을 원본에 전달
- SPA 새로고침: **배포 전체 사용자 지정 오류 응답(403/404 → `index.html`)을 쓰지 않는다.** `/api/*`의 404까지 HTML로 바뀌기 때문이다. 기본 동작에만 붙는 CloudFront Function으로 확장자 없는 경로를 `/index.html`로 다시 쓴다.
- 원본은 HTTP일 수 있다. CloudFront의 HTTPS는 CloudFront→EC2 구간을 보호하지 않으므로 시연에는 가상 데이터만 쓰고 한계를 README에 적는다.

### 보안 그룹
- SSH 22: 팀 고정 IP만
- 앱 포트: CloudFront 관리형 prefix list(`com.amazonaws.global.cloudfront.origin_facing`)만 허용(선택 가능한 경우)
- 3306: 인바운드 규칙 없음

## 자주 쓰는 확인 명령

EC2에서 실행하는 읽기 전용 명령이다. 서비스명·포트는 확정한 값으로 바꾼다.

```bash
systemctl status mariadb --no-pager            # (OS에 따라 서비스명 mariadb 또는 mysql 계열 확인)
systemctl status <서비스명> --no-pager
journalctl -u <서비스명> -n 100 --no-pager
ss -tlnp | grep -E '3306|<앱 포트>'            # 3306이 127.0.0.1에만 바인딩되어 있어야 함
ls -l <환경 파일 경로>                          # 권한 600 확인
curl -i http://127.0.0.1:<앱 포트>/api/health   # 서버 안에서 확인
curl -i https://<CloudFront 도메인>/api/health  # 외부 경로로 확인
```

## 문서화 규칙

- 인프라를 바꿀 때마다 `PLAN.md` 2.2의 결정 표와 README의 인프라 절을 같이 갱신한다.
- 결정한 값(서비스명, 포트, 경로, 리소스 이름)은 한 곳에만 적고 다른 문서는 참조한다.
- 환경 변수는 키 이름과 설명만 적는다(값 제외).
- 배포 절차나 스크립트는 사람이 손으로 실행하는 것까지만 만든다. 자동 배포 파이프라인은 만들지 않는다.

## 협업

- 앱 코드가 원인으로 보이면 직접 고치지 말고 B(백엔드) 또는 C(프론트엔드)에게 확인된 사실(로그, 요청, 응답)을 정리해 전달한다.
- B에게는 DB 접속 방식(비밀번호 제외), 환경 파일 위치, 로그 확인 방법을 준다. C에게는 CloudFront 주소와 업로드 방법을 준다.
- Day 4 오후에는 새 인프라 변경을 하지 않고, 배포 안정화와 시연 준비만 한다.