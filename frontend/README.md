# 가계부 프론트엔드

React 19 · Vite · Tailwind CSS 4 · Recharts · react-router-dom 7

## 실행
```bash
npm install
cp .env.example .env      # VITE_USE_MOCK=true → 백엔드 없이 목 데이터로 실행
npm run dev               # http://localhost:5173
```
- 목 모드 데모 계정: `demo@example.com` / `demo1234` (새로고침하면 데이터 초기화)
- 백엔드 연동: `.env`의 `VITE_USE_MOCK=false` (또는 `.env` 삭제) 후 FastAPI를 `127.0.0.1:8000`에 실행. 개발 서버가 `/api`를 프록시한다.

## 스크립트
| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 운영 빌드(`dist/`, 목 데이터 제외) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | oxlint |

## 구조
```
src/
├─ api/          fetch 래퍼(client.js), 도메인별 API 모듈, mock/ (목 서버)
├─ auth/         AuthContext, ProtectedRoute, PublicRoute
├─ components/   layout/, ui/, charts/, 폼·MonthPicker
├─ hooks/        useCategories
├─ pages/        Login, Register, Dashboard, Transactions, Subscriptions
└─ utils/        format.js(원화·날짜), month.js(YYYY-MM)
```

## 문서
- [API 계약 가정](docs/api-contract.md)
- [배포 가이드](docs/deployment.md)
