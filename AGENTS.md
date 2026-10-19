# AGENTS.md — AI 코딩 도우미 공통 규칙

이 저장소에서 코드를 작성하는 AI 도우미(Claude Code, Copilot, Cursor, ChatGPT 등)는 아래 규칙을 따른다.

## 프로젝트

개인 가계부 & 정기결제 목록 관리 웹앱. 3인 팀, 4일 개발, **기능 추가보다 끝까지 동작하는 배포가 우선**.

- 기준 문서: [PRD.md](PRD.md) (v3.2)
- 백엔드: `backend/` — **구현 완료**, API 14개 동작 중
- 프론트엔드: `frontend/` — React + Vite + Tailwind CSS + Recharts
- 인프라: S3 + CloudFront + EC2(FastAPI + MariaDB, systemd), 수동 배포

| 역할 | 담당 | AI 참고 문서 |
|---|---|---|
| 프론트엔드 | C | [docs/ai-frontend.md](docs/ai-frontend.md) + [docs/api-contract.md](docs/api-contract.md) |
| 인프라 | A | [docs/agent-infra.md](docs/agent-infra.md) + [docs/ai-infra.md](docs/ai-infra.md) + [PLAN-infra.md](PLAN-infra.md) + [docs/db-design.md](docs/db-design.md) |
| 백엔드 | B | [PLAN-backend.md](PLAN-backend.md), [README.md](README.md), [docs/backend-summary.md](docs/backend-summary.md) |

- 역할별 계획은 `PLAN-<역할>.md`, 역할별 AI 지침은 `docs/` 아래에 둔다.
- `CLAUDE.md`는 **모든 팀원의 Claude Code가 자동으로 읽는 공용 파일**이므로 `@AGENTS.md` 한 줄만 둔다. 역할 전용 지침을 넣지 않는다.

## 반드시 지킬 것

1. **API 계약은 [docs/api-contract.md](docs/api-contract.md)가 기준이다.** 필드명·경로·상태 코드를 추측하거나 바꾸지 않는다. 필요한 변경은 백엔드 담당에게 요청한다.
2. **`backend/` 코드는 백엔드 담당과 합의 없이 수정하지 않는다.** 프론트/인프라 작업 중 백엔드 수정이 필요해 보이면 코드를 고치지 말고 무엇이 필요한지 정리해서 보고한다.
3. **비밀값을 코드·Git·프롬프트에 넣지 않는다.** DB 비밀번호, JWT 서명키, AWS 액세스 키는 환경 변수/제한 권한 파일로만 관리한다. `.env`는 커밋 금지.
4. **PRD 범위 밖 기능을 만들지 않는다.** 아래는 명시적으로 제외된 기능이다:
   - 정기결제 수정, 정기결제 → 거래 자동/수동 반영("가계부에 추가" 버튼), 결제일 계산·D-day·월 환산 금액
   - 거래 유형/카테고리 필터·검색·고급 정렬, 카테고리 수정·삭제
   - 회원 탈퇴, 비밀번호 재설정, 이메일 인증, 소셜 로그인, Cognito
   - Docker, Alembic, Pytest 자동화, CI/CD, IaC, AI 기능
   - 화면 연출용 애니메이션(홈 화면의 배경·등장·hover 효과, 차트 등장 효과 등)은 **허용**한다. 단 OS의 "동작 줄이기"(`prefers-reduced-motion`) 설정을 존중하고, 기능·API·데이터 흐름은 바꾸지 않는다.
5. 모든 API 경로는 `/api`로 시작한다. 프론트는 항상 **상대 경로 `/api/...`**로 호출한다 (로컬은 Vite 프록시, 운영은 CloudFront가 같은 도메인으로 전달).
6. 브랜치: `feat/frontend`, `feat/infra`, `feat/backend`. `main`은 항상 배포 가능한 상태로 유지하고 PR로 병합한다 (Squash 대신 merge commit).
