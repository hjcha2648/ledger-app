# PLAN — AI 가계부 챗봇 (Amazon Bedrock)

> 추가 기능 계획 (2026-10-20 작성). 기존 역할별 계획은 [PLAN-backend.md](PLAN-backend.md), [PLAN-infra.md](PLAN-infra.md)를 그대로 따른다.
> 목표: 로그인한 사용자가 **자기 가계부 데이터에 대해 자연어로 질문**하면 Claude(Amazon Bedrock)가 답한다.
> 원칙: **기존 기능과 배포를 깨지 않는다.** 챗봇이 실패해도 나머지 화면은 그대로 동작해야 하고, 환경 변수 하나로 끌 수 있어야 한다.

---

## 0. 먼저 정할 것 / 바꿀 것

| 항목 | 내용 | 담당 | 상태 |
|---|---|---|---|
| 범위 변경 합의 | [AGENTS.md](AGENTS.md) 4번 제외 목록에 "AI 기능"이 있다 → 팀 합의 후 "가계부 질문 챗봇(Bedrock, 읽기 전용)은 허용"으로 수정. 안 바꾸면 각자의 AI 도우미가 작업을 범위 위반으로 막는다 | B (통합 담당) | [ ] |
| PRD 반영 | PRD에 챗봇 절 추가(범위·제외 사항) | B | [ ] |
| 모델 | 기본 `anthropic.claude-opus-5-5`. 비용·속도를 우선하면 Sonnet 5.5 / Haiku 5.5로 바꿀 수 있다 (`BEDROCK_MODEL_ID` 환경 변수로만 교체) | 팀 | [ ] |
| 리전 | `ap-northeast-2`에서 해당 모델을 쓸 수 있는지 Bedrock 콘솔에서 확인. 없으면 지원 리전 또는 inference profile 사용 | A | [ ] |
| 확인 결과 (10/20, B) | ✅ 해결. 모델 액세스는 이미 승인돼 있었음. 서울 리전은 **Bedrock Runtime 경로 + global inference profile ID**로만 호출된다: `BEDROCK_MODEL_ID=global.anthropic.claude-opus-5-5` (리전 없는 `anthropic.claude-opus-5-5`는 400, Mantle 엔드포인트는 404). 로컬에서 실제 답변 확인(3~6초) | A·B | [x] |
| 마감선 | **Day 3(10/21) 종료까지 EC2·CloudFront에서 동작하지 않으면 Day 4에는 `CHAT_ENABLED=false`로 끄고 시연** (Day 4 오전은 신규 기능 금지 규칙 유지) | 전원 | — |

### 범위 (MVP)
- 포함: 질문 → 답변 한 번씩 주고받는 채팅, 최근 대화 몇 턴 유지(브라우저 메모리), 선택한 달의 내 거래·대시보드·정기결제를 근거로 답변
- 제외: 챗봇이 거래를 등록·수정·삭제(쓰기 동작), 대화 기록 DB 저장, 스트리밍 응답, 파일 업로드, 다른 사용자 데이터 접근, 실제 금융 조언

---

## 1. API 계약 (B가 확정 → `docs/api-contract.md`에 추가)

### POST `/api/chat` — 챗봇 질문 (Bearer JWT 필수)

요청
```json
{
  "month": "2026-10",
  "messages": [
    { "role": "user", "content": "이번 달 식비가 지난달보다 많이 나왔어?" }
  ]
}
```
- `messages`: 최근 대화를 오래된 순서로. 최대 10개, 마지막은 반드시 `user`, `role`은 `user`/`assistant`, `content` 1~1000자
- `month`: `YYYY-MM` (어느 달 데이터를 근거로 답할지)

응답 `200`
```json
{ "reply": "네, 이번 달 식비는 ... 원으로 지난달보다 ... 원 많아요." }
```

오류 (기존 `{"detail": ...}` 형식 그대로)
| 코드 | 경우 |
|---|---|
| 401 | 토큰 없음·만료 |
| 422 | `messages` 형식·길이 위반, 잘못된 `month` |
| 429 | 사용자별 호출 제한 초과 (예: 1분 10회) |
| 503 | 챗봇 꺼짐(`CHAT_ENABLED=false`) 또는 Bedrock 호출 실패·시간 초과 |

---

## 2. 백엔드 (B)

| # | 작업 | 완료 기준 |
|---|---|---|
| B1 | 의존성 `anthropic` 추가 (`requirements.txt`), Python 3.14에서 설치 확인 | 로컬·EC2 `pip install` 성공 |
| B2 | `config.py`에 `chat_enabled`(기본 false), `bedrock_region`, `bedrock_model_id`, `chat_rate_limit_per_min` 추가, `.env.example` 갱신 | 값 없이도 기존 서버가 그대로 뜬다 |
| B3 | `schemas/chat.py` — 요청/응답 스키마와 검증(개수·길이·역할 순서) | 잘못된 요청 422 |
| B4 | 근거 데이터 만들기 — JWT 사용자의 해당 월 대시보드 집계(기존 집계 함수 재사용), 지난달 카테고리별 지출, 해당 월 거래 최근 50건, 정기결제 목록을 짧은 텍스트로 정리 | 다른 사용자 데이터가 절대 섞이지 않음 (`user_id` 조건) |
| B5 | `routers/chat.py` — `AnthropicBedrockMantle(aws_region=...)`로 호출. 시스템 프롬프트: "이 사용자의 가계부 데이터만 근거로, 한국어로 짧게, 데이터에 없으면 모른다고, 금융 투자 조언은 하지 않음". 근거 데이터는 시스템 프롬프트 뒤쪽 데이터 블록으로 전달 | 로컬에서 실제 질문에 답변 |
| B6 | 실패 처리 — SDK 타임아웃 25초·재시도 1회, Bedrock 오류는 503 + 로그(`journalctl`)에 원인, `stop_reason`이 `refusal`이면 안내 문구로 응답 | Bedrock 끊김에도 서버가 죽지 않음 |
| B7 | 사용자별 호출 제한(메모리, 1분 N회) → 429 | 연속 호출 시 429 |
| B8 | `main.py`에 라우터 등록, `docs/api-contract.md`·README·`docs/backend-summary.md` 갱신 | C가 문서만 보고 붙일 수 있음 |
| B9 | `smoke.sh`에 401·422 확인 추가 (실제 모델 호출은 비용 때문에 smoke에서 제외, 수동 1회 확인) | 기존 51개 + 추가 항목 PASS |

- 진행 (10/20, B): B1~B9 로컬 구현·확인 완료 — 401·422·429·503 동작, 실제 답변 확인, smoke 53개 PASS(챗봇 2개 추가). `anthropic[bedrock]` 사용, `aws login` 자격 증명으로 로컬 개발 시 `pip install "botocore[crt]"` 추가 필요(EC2 IAM 역할은 불필요)
- AWS 액세스 키를 코드·`.env`에 넣지 않는다. 로컬은 개인 `aws login` 자격 증명, EC2는 인스턴스 역할(IAM Role)을 SDK가 자동으로 쓴다.
- 대화 내용은 DB나 로그에 남기지 않는다 (오류 로그에는 요청 ID·상태 코드만).

---

## 3. 프론트엔드 (C)

| # | 작업 | 완료 기준 |
|---|---|---|
| C1 | `src/api/chat.js` — 기존 `client.js`로 `POST /api/chat` 호출 (상대 경로 `/api/...`) | 토큰 자동 첨부 |
| C2 | 챗봇 UI — 새 페이지(`ChatPage`) 또는 화면 오른쪽 아래 떠 있는 버튼+패널 중 택1. 내 말풍선/답변 말풍선, 입력창, 전송 중 표시 | 질문 → 답변 표시 |
| C3 | 대화는 컴포넌트 상태에만 보관, 최근 10개만 전송. 새로고침하면 초기화 | 11번째부터 오래된 것 제외 |
| C4 | 기준 월 — 대시보드/거래에서 보던 달 또는 이번 달을 `month`로 전송, 화면에 "2026년 10월 데이터 기준" 표시 | 월 바꾸면 답변 근거도 바뀜 |
| C5 | 오류 표시 — 429 "잠시 후 다시", 503 "챗봇을 사용할 수 없습니다", 그 외 공통 오류 컴포넌트 재사용. 503이면 다른 화면은 정상 | 백엔드 꺼져도 앱 동작 |
| C6 | 안내 문구 — "가상 데이터 기반, 금융 조언이 아님", 예시 질문 버튼 2~3개 | 시연 때 바로 클릭 가능 |
| C7 | 목 데이터(`src/api/mock`)로 먼저 화면 작업 → B1~B5 완료 후 실제 연동 | 백엔드 대기 없이 진행 |

---

## 4. AWS 배포 (A)

| # | 작업 | 완료 기준 |
|---|---|---|
| A1 | Bedrock 콘솔 → **모델 액세스**에서 선택한 Claude 모델 사용 요청 (Anthropic 모델은 최초 1회 사용 목적 양식 필요할 수 있음), 리전 확인 | 콘솔에서 "액세스 권한 부여됨" |
| A2 | IAM 역할 생성 → EC2 인스턴스에 연결. 권한은 `bedrock:InvokeModel`만. global inference profile은 여러 리전으로 요청을 보내므로 대상 ARN 두 종류가 모두 필요: `arn:aws:bedrock:ap-northeast-2:<계정ID>:inference-profile/global.anthropic.claude-opus-5-5`(·`-4-8`), `arn:aws:bedrock:*::foundation-model/anthropic.claude-opus-5-5`(·`-4-8`) | EC2에서 `aws sts get-caller-identity`가 역할로 나옴 |
| A3 | EC2에서 Bedrock 호출 확인 (B가 준 1줄 테스트 스크립트) | 응답 수신 |
| A4 | `/etc/ledger/backend.env`에 `CHAT_ENABLED=true`, `BEDROCK_REGION=ap-northeast-2`, `BEDROCK_MODEL_ID=global.anthropic.claude-opus-5-5` 추가 → `git pull` → `pip install -r backend/requirements.txt` → `sudo systemctl restart ledger-api` | `/api/health` 정상, 챗봇 응답 |
| A5 | CloudFront `/api/*` 원본의 **응답 제한 시간 30초 → 60초** (모델 응답이 30초를 넘길 수 있음) | 긴 답변도 504 없음 |
| A6 | AWS Budgets에 Bedrock 포함 비용 알림(예: 월 $10) | 알림 메일 수신 설정 |
| A7 | 시연 후 IAM 역할 정리·모델 액세스 정리 계획을 PLAN-infra.md 20번(T20)에 추가 | — |

- 액세스 키를 EC2에 저장하지 않는다 (인스턴스 역할만 사용).
- 보안 그룹 변경은 없다 (EC2 → Bedrock은 아웃바운드 HTTPS).
- 진행 (10/20, A): **A1~A5 완료.** A1은 B 확인(위 0장). A2 `ledger-ec2-role`에 인라인 정책 `ledger-bedrock-invoke`(`bedrock:InvokeModel`, 위 ARN 4개) 연결. A3 역할 자격 증명으로 호출 확인. A4 환경 파일에 3개 키 추가(백업 `backend.env.bak-20261020-0448`) → 재시작. A5 원본 응답 제한 시간 60초, 배포 `Deployed`. 확인: CloudFront 경유 `POST /api/chat` → 200, 5.3초. **A6·A7 남음**(A7 계획은 PLAN-infra.md T20에 추가함)
- EC2 셸에서 개인 `aws login` 자격 증명(`AWS_PROFILE`)이 잡혀 있으면 `aws` 명령이 역할이 아니라 개인 권한으로 실행된다. 역할 권한 확인은 `env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE aws ...`로 한다. 백엔드(systemd)는 `AWS_PROFILE`이 없으므로 항상 역할을 쓴다.

---

## 5. 일정

| 시점 | B (백엔드) | C (프론트) | A (인프라) |
|---|---|---|---|
| Day 2 오후 (10/20) | 0장 합의, API 계약 확정·공유, B1~B3 | C7 목 데이터로 C1~C3 | A1 모델 액세스·리전, A2 IAM 역할 |
| Day 3 오전 (10/21) | B4~B7 로컬 동작, PR | C4~C6 | A3 Bedrock 호출 확인, A5, A6 |
| Day 3 오후 | B8~B9, main 병합 | 실제 API 연동, PR | A4 EC2 반영, S3 프론트 재배포 |
| Day 3 종료 | **CloudFront 주소에서 챗봇 질문 → 답변 확인. 실패 시 `CHAT_ENABLED=false`** | | |
| Day 4 (10/22) | 버그 수정만 | 버그 수정만 | 최종 배포·리허설 (챗봇 시연 질문 3개 준비) |

---

## 6. 완료 기준 (DoD)

- [ ] CloudFront 주소에서 로그인 → 챗봇 질문 → 내 데이터 기반 답변
- [ ] 계정 B의 질문에 계정 A의 데이터가 나오지 않는다
- [ ] 토큰 없이 401, 잘못된 요청 422, 연속 호출 429
- [ ] `CHAT_ENABLED=false`면 503이고, 나머지 화면·smoke 51개는 그대로 PASS
- [ ] AWS 액세스 키가 코드·Git·환경 파일 어디에도 없다 (EC2는 IAM 역할)
- [ ] Bedrock 비용 알림 설정

## 7. 리스크

| 리스크 | 대응 |
|---|---|
| 서울 리전에 모델이 없음 | 지원 리전으로 `BEDROCK_REGION` 지정 (지연 시간 약간 증가) |
| 모델 액세스 승인 지연 | A1을 가장 먼저 진행, 승인 전에는 B는 로컬 개인 계정으로 개발 |
| 응답 지연으로 CloudFront 504 | A5 타임아웃 60초, B6 SDK 타임아웃 25초, 답변 짧게 지시 |
| 비용 초과 | 사용자별 호출 제한, 근거 데이터 크기 제한(거래 50건), Budgets 알림 |
| 일정 부족 | Day 3 종료 마감선, 넘기면 기능 끄고 시연 |
| 프롬프트 주입(거래 메모에 지시문) | 근거 데이터는 "데이터"로만 다루라고 시스템 프롬프트에 명시, 쓰기 동작이 없어서 피해 범위가 답변 문구로 한정 |
