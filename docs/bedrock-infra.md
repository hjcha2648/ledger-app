# AI 가계부 챗봇 — Bedrock 인프라 작업 정리 (A)

- 작성: A(인프라), 2026-10-20
- 범위: `POST /api/chat`(B 구현)이 운영 환경에서 Amazon Bedrock을 호출하도록 AWS·EC2를 설정한 작업
- 관련 문서: 작업 목록 [PLAN.md](../PLAN.md) 4장(A1~A7), 결정값 [PLAN-infra.md](../PLAN-infra.md) 2.2, API [api-contract.md](api-contract.md)

## 1. 요약

| 항목 | 결과 |
|---|---|
| 상태 | **A1~A5 완료**, A6(비용 알림) 남음, A7(정리 계획)은 PLAN-infra.md T20에 기록 |
| 최종 확인 | `https://ledger.lsj.mzsec.cloud/api/chat` → 200, 응답 5.3초, 사용자 DB 데이터 기반 답변 |
| 인증 방식 | EC2 인스턴스 역할(액세스 키 저장 없음) |
| 보안 그룹 변경 | 없음(EC2 → Bedrock은 아웃바운드 HTTPS) |

## 2. 구성

```text
브라우저 ── HTTPS ──> CloudFront (ledger.lsj.mzsec.cloud, E2Q0XEE8TA0BOI)
                         └─ /api/* ──> EC2 :8000 FastAPI (ledger-api, systemd)
                                         ├─ MariaDB 127.0.0.1:3306 (사용자 거래·정기결제 조회)
                                         └─ HTTPS 아웃바운드 ──> Amazon Bedrock (Claude)
                                              자격 증명: 인스턴스 역할 ledger-ec2-role (IMDS 임시 자격 증명)
```

인프라 범위는 위 연결이 통하게 하는 것까지다. 프롬프트·데이터 조회·요청 제한은 B의 코드(`backend/app/routers/chat.py`)가 담당한다.

## 3. 결정 사항

| 항목 | 값 | 이유 |
|---|---|---|
| 리전 | `ap-northeast-2` | EC2와 같은 리전 |
| 모델 ID | `global.anthropic.claude-opus-5-5` | 서울 리전은 global inference profile ID로만 호출된다. 리전 없는 `anthropic.claude-opus-5-5`는 400 |
| 예비 모델 | `global.anthropic.claude-opus-4-8` (코드 기본값) | 거절(refusal) 응답 시 재시도 |
| 권한 | `bedrock:InvokeModel` 하나 | 최소 권한 |
| CloudFront 원본 타임아웃 | 30초 → **60초** | 긴 답변에서 504 방지 |
| 요청 제한 | 사용자당 분당 10회 (코드 기본값) | 비용·남용 방지 |

## 4. 작업 내용

### A1. 모델 액세스 (B 확인)
계정에 Claude 모델 사용 승인이 이미 되어 있었다. 호출 경로는 Bedrock Runtime + global inference profile.

### A2. IAM 역할 권한
`ledger-ec2-role`(EC2 `i-02195e4dee3318216`에 연결)에 인라인 정책 `ledger-bedrock-invoke`를 추가했다.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "BedrockInvokeChatModels",
    "Effect": "Allow",
    "Action": "bedrock:InvokeModel",
    "Resource": [
      "arn:aws:bedrock:ap-northeast-2:<계정ID>:inference-profile/global.anthropic.claude-opus-5-5",
      "arn:aws:bedrock:ap-northeast-2:<계정ID>:inference-profile/global.anthropic.claude-opus-4-8",
      "arn:aws:bedrock:*::foundation-model/anthropic.claude-opus-5-5",
      "arn:aws:bedrock:*::foundation-model/anthropic.claude-opus-4-8"
    ]
  }]
}
```

대상이 두 종류인 이유: inference profile은 호출 창구이고, 실제 처리는 profile이 고른 리전의 foundation model에서 일어난다. 처리 리전을 미리 알 수 없으므로 foundation model ARN의 리전은 `*`로 둔다. 한쪽만 있으면 AccessDenied.

### A3. 역할로 호출 확인
EC2 셸에서 역할 자격 증명으로 실행했다.

```bash
env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE aws sts get-caller-identity --query Arn --output text
# → arn:aws:sts::<계정ID>:assumed-role/ledger-ec2-role/i-02195e4dee3318216
```

`env -u ...`를 붙인 이유는 7장 "주의" 참고.

### A4. 서버 반영
1. 코드: `git merge origin/main` (B의 챗봇 PR #12, #13)
2. 패키지: `pip install -r backend/requirements.txt` (`anthropic`, `boto3` 등 추가). **재시작 전에** 설치해야 한다.
3. 불러오기 확인: `python -c "from app.main import app"`
4. 환경 파일 백업: `sudo cp -p /etc/ledger/backend.env /etc/ledger/backend.env.bak-20261020-0448`
   (`/etc/ledger` 폴더가 root 소유라 `sudo` 필요. `-p`로 소유자 `ubuntu`·권한 600 유지)
5. 환경 파일에 키 추가(값은 비밀이 아님):

   | 키 | 값 |
   |---|---|
   | `CHAT_ENABLED` | `true` |
   | `BEDROCK_REGION` | `ap-northeast-2` |
   | `BEDROCK_MODEL_ID` | `global.anthropic.claude-opus-5-5` |

6. 재시작: `sudo systemctl restart ledger-api && sleep 3 && curl -i http://127.0.0.1:8000/api/health`

### A5. CloudFront 타임아웃
배포 `E2Q0XEE8TA0BOI` → 원본 탭 → EC2 원본(`ec2-43-201-29-20...`, HTTP 8000) → 응답 제한 시간 60초. S3 원본은 변경하지 않았다.

## 5. 검증 결과 (10/20)

| 확인 | 방법 | 결과 |
|---|---|---|
| 역할 정책 | `aws iam list-role-policies --role-name ledger-ec2-role` | `ledger-bedrock-invoke` |
| 환경 파일 | 키 이름만 출력(`grep -oE '^[A-Z_]+'`), `ls -l` | 키 9개·중복 없음, 600 |
| 서비스 | `systemctl status`, `/api/health` | active, `{"status":"ok","db":"ok"}` |
| 타임아웃 | `aws cloudfront get-distribution-config` | `OriginReadTimeout` 60, `Deployed` |
| 인증 없이 호출 | `POST /api/chat` (토큰 없음) | 401 |
| 실제 호출 | 테스트 계정 로그인 → CloudFront 경유 `POST /api/chat` | **200, 5.3초** |

## 6. 운영

### 장애 대응

| 증상 | 확인할 것 |
|---|---|
| `/api/chat` 503 | `CHAT_ENABLED=true` 여부, 역할 정책, `journalctl -u ledger-api -n 50`의 Bedrock 오류(권한·모델 ID) |
| 챗봇만 504 | CloudFront EC2 원본 응답 제한 시간(60초) |
| 429 | 정상 동작(사용자당 분당 10회 제한) |
| 재시작 직후 `curl` 연결 실패 | 앱 기동에 약 2초 걸림. `sleep 3` 후 다시 확인 |
| 배포 후 서비스가 안 뜸 | `requirements.txt` 설치 누락 여부(`ModuleNotFoundError`) |

### 챗봇만 끄기
환경 파일에서 `CHAT_ENABLED=false` → `sudo systemctl restart ledger-api`. 다른 API에는 영향 없고 `/api/chat`만 503을 돌려준다.

### 비용
Bedrock은 호출할 때마다 토큰 수만큼 과금된다. 서버를 켜 두는 것만으로는 비용이 없다. 비용 알림(A6, 월 $10 예산)은 아직 설정 전이다.

## 7. 주의 (작업 중 겪은 것)

- **개인 자격 증명과 역할 혼동**: EC2 셸에 `AWS_PROFILE`(개인 `aws login`)이 설정되어 있으면 `aws` 명령이 역할이 아니라 개인 권한으로 실행된다. 역할 권한이 없어도 성공해 보이므로, 역할 검증은 `env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE aws ...`로 한다. systemd 서비스에는 `AWS_PROFILE`이 없어 항상 역할을 쓴다.
- **역할에 정책이 실제로 붙었는지**는 콘솔 편집 화면이 아니라 `aws iam list-role-policies` / `list-attached-role-policies`로 확인한다. 편집만 하고 저장·연결이 안 된 경우가 있었다.
- **패키지 설치 순서**: 새 코드가 `anthropic`을 import하므로 `pip install` 전에 재시작하면 서비스가 뜨지 않는다.

## 8. 남은 일과 정리 계획

- [ ] **A6** 비용 알림: 결제 및 비용 관리 → 예산 → 월별 비용 예산 $10, 팀 이메일
- [ ] 시연 후 정리(PLAN-infra.md T20, 팀 확인 후 순서대로)
  1. `CHAT_ENABLED=false`로 바꾸고 재시작
  2. `ledger-ec2-role`에서 인라인 정책 `ledger-bedrock-invoke` 제거
  3. 모델 액세스는 계정 전체 설정이므로 다른 프로젝트 사용 여부 확인 후에만 해제
  4. Cost Explorer에서 Bedrock 비용이 더 늘지 않는지 확인
- [ ] EC2 셸의 개인 `aws login` 자격 증명 정리(`aws logout`)
