#!/usr/bin/env bash
# 로컬 개발 서버 동시 실행: 백엔드(uvicorn :8000) + 프론트(Vite, /api → :8000 프록시)
# 사용법: ./backend/scripts/dev.sh   (Ctrl+C 한 번으로 둘 다 종료)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
UVICORN="$ROOT/.venv/bin/uvicorn"

if [[ ! -x "$UVICORN" ]]; then
  echo "uvicorn을 찾을 수 없습니다: $UVICORN (venv 생성·pip install 먼저)" >&2
  exit 1
fi

if ss -ltn 2>/dev/null | grep -q '127.0.0.1:8000\|0.0.0.0:8000\|\*:8000'; then
  echo "8000번 포트를 이미 다른 프로세스가 쓰고 있습니다: ss -ltnp | grep :8000 으로 확인" >&2
  exit 1
fi

trap 'kill 0' EXIT

(cd "$ROOT/backend" && "$UVICORN" app.main:app --reload --port 8000) &
(cd "$ROOT/frontend" && npm run dev) &

wait
