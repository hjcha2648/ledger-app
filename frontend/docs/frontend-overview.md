# Budgo 프론트엔드 구성 한눈에 보기

React 19 · Vite 8 · Tailwind CSS 4 · Recharts 3 · react-router-dom 7 (JavaScript)

## 1. 화면과 경로

| 경로 | 화면 | 파일 | 접근 |
|---|---|---|---|
| `/login` | 로그인 | `pages/LoginPage.jsx` | 공개 (로그인 상태면 `/home`으로 이동) |
| `/register` | 회원가입 | `pages/RegisterPage.jsx` | 공개 |
| `/home` | 현관 화면 (떠다니는 메시 배경, 큰 문구, 큰 선 아이콘 3개, 순차 등장) | `pages/HomePage.jsx` | 로그인 필요, **로그인 후 첫 화면** |
| `/dashboard` | 요약 카드 3개, 도넛 차트, 6개월 막대 차트 | `pages/DashboardPage.jsx` | 로그인 필요 |
| `/transactions` | 월별 거래 표, 등록·수정 모달, 삭제 확인 | `pages/TransactionsPage.jsx` | 로그인 필요 |
| `/subscriptions` | 정기결제 목록, 등록 모달, 삭제 확인 (수정 없음) | `pages/SubscriptionsPage.jsx` | 로그인 필요 |
| 그 외 | `/home`으로 이동 | `App.jsx` | - |

- 라우트 구성은 `src/App.jsx`: `PublicRoute`(로그인/회원가입) → `ProtectedRoute` → `AppLayout`(상단 바 + 본문).
- 로그인 전에 보호 경로로 접근하면 `/login`으로 보냈다가, 로그인 후 원래 경로로 돌아간다.

## 2. 폴더 구조

```
frontend/
├─ index.html                 진입 HTML (title: Budgo, lang: ko)
├─ vite.config.js             Tailwind 플러그인, /api 개발 프록시(API_PROXY_TARGET)
├─ package.json               스크립트: dev / build / preview / lint
├─ .env.example               환경 변수 예시
├─ .env.production            운영 빌드용 (VITE_USE_MOCK=false, 커밋 대상)
├─ .env                       로컬 전용 (gitignore)
├─ public/favicon.svg
├─ docs/
│  ├─ frontend-overview.md    이 문서
│  ├─ api-contract.md         API 계약 처리 방식 (기준은 루트 docs/api-contract.md)
│  └─ deployment.md           S3 + CloudFront 배포 가이드
└─ src/
   ├─ main.jsx                React 진입점
   ├─ App.jsx                 라우트 정의
   ├─ index.css               Tailwind 임포트, 테마 색상, 공통 애니메이션
   ├─ api/                    서버 통신
   ├─ auth/                   인증 상태와 라우트 가드
   ├─ components/             화면 부품
   ├─ constants/              앱 이름, 메뉴 목록
   ├─ hooks/                  공용 훅
   ├─ pages/                  화면
   └─ utils/                  포맷, 월 계산
```

## 3. 파일별 역할

### 3.1 `src/api/` — 서버 통신

| 파일 | 역할 |
|---|---|
| `client.js` | fetch 래퍼. `/api` 상대 경로, Bearer 토큰 자동 첨부, 토큰은 `sessionStorage`, 401이면 자동 로그아웃, 204 처리, `detail`(문자열/배열) 오류 변환(422 배열은 `ApiError.fields`로 필드별 오류 제공) |
| `auth.js` | `register`, `login`, `getMe` |
| `categories.js` | `listCategories`, `createCategory` |
| `transactions.js` | `listTransactions(month)`, `createTransaction`, `updateTransaction`, `deleteTransaction` |
| `subscriptions.js` | `listSubscriptions`, `createSubscription`, `deleteSubscription` |
| `dashboard.js` | `getDashboard(month)` |
| `mock/index.js` | 백엔드 없이 쓰는 인메모리 목 서버 (데모 계정 `demo@example.com` / `demo1234`). 루트 API 계약의 응답 모양을 따른다 |

- 각 API 모듈은 `VITE_USE_MOCK`이 `true`일 때만 목 서버를 동적 import 한다. 운영 빌드(`.env.production`)에서는 목 코드가 번들에서 제거된다.

### 3.2 `src/auth/` — 인증

| 파일 | 역할 |
|---|---|
| `AuthContext.jsx` | `token`, `isAuthenticated`, `login(token)`, `logout()` 제공. 401 발생 시 자동 로그아웃 연결 |
| `ProtectedRoute.jsx` | 미로그인이면 `/login`으로 이동 |
| `PublicRoute.jsx` | 로그인 상태에서 `/login`·`/register` 접근 시 `/home`으로 이동 |

### 3.3 `src/pages/` — 화면

| 파일 | 내용 |
|---|---|
| `LoginPage.jsx` | 이메일·비밀번호 로그인, 가입 완료 안내, 서버 오류 표시 |
| `RegisterPage.jsx` | 이메일 형식·비밀번호 8~64자·확인 일치 검증, 서버 필드 오류 표시, 가입 후 `/login`으로 이동 |
| `HomePage.jsx` | 현관 화면. 초록·노랑·코랄·티얼 블러 원 4개가 22~30초 주기로 떠다니는 메시 배경 + 옅은 점 패턴, 큰 문구(뒷부분 그라데이션), 칸·이름·설명 없이 큰 선 아이콘 3개만 표시(hover 시 6px 떠오름·accent 색·선 그리기), 하단 로고 문구. 문구 → 아이콘(100ms 간격) → 하단 문구 순차 등장 |
| `DashboardPage.jsx` | (이번 달·지난달 `getDashboard`를 `Promise.allSettled`로 병렬 조회: 지난달만 실패하면 "-" 처리, 월 변경 시 늦은 응답 무시)  월 선택, 아이콘 배지·보조 문구가 있는 총수입·총지출·잔액 카드(**정적**: hover·클릭·등장 애니메이션 없음), 폭은 다른 화면과 같은 `max-w-[58rem]`. 카테고리별 지출 도넛 카드와 최근 6개월 수입·지출 카드를 위아래로 쌓아 각각 전체 폭으로 배치(모바일도 같은 순서). 화면 전환 fade-up 제외 |
| `TransactionsPage.jsx` | 월 선택, 수입·지출·잔액 카테고리별 보기 드롭다운 한 칸(전체 + 그 달 거래에 나온 카테고리, 선택하면 표와 수입·지출·잔액 합계가 그 카테고리만 반영, 프론트에서만 걸러 API·백엔드 변경 없음), 합계 칩 3개(수입·지출 칩은 호버·포커스하면 표에서 해당 거래를 유형 색 배경으로 강조하고 나머지는 흐리게, 잔액 칩은 정적), 거래 표(유형 배지, 금액 우측 정렬, 수정·삭제 아이콘 버튼), 등록/수정 모달, 삭제 확인 |
| `SubscriptionsPage.jsx` | 정보 배너(accent-soft), 정기결제 표(주기 칩, 삭제 아이콘 버튼), 등록 모달, 삭제 확인 |

### 3.4 `src/components/`

**layout/**

| 파일 | 역할 |
|---|---|
| `AppLayout.jsx` | 로그인 후 공통 틀 (상단 바 + 본문 최대 폭 58rem(928px), 모든 화면 공통). 화면 전환 시 fade-up(홈·대시보드 제외) |
| `Navbar.jsx` | 반투명 흰 배경 + blur, 하단 옅은 테두리, sticky, 세로 패딩 `py-4`(모바일 72px·sm 이상 80px). 앵무새 로고 + 이름(홈으로 이동), 메뉴 아이콘 3개(홈에서는 숨김, 현재 메뉴는 accent-soft 알약), 로그아웃 아이콘. 호버 시 확대 + 이름 표시. 375px에서도 한 줄에 들어가도록 모바일 크기 축소 |
| `AuthLayout.jsx` | 로그인·회원가입 틀. 로고 → 이름 → 문구 수직 중앙 정렬, 카드형 폼(shadow-pop), 홈과 같은 톤의 옅은 브랜드색 블러 원 배경, 전체를 위로 올려 폼이 중앙 부근에 오도록 배치 |
| `PageHeader.jsx` | 페이지 제목 (accent-soft 단색 아이콘 배지 + 부드러운 링 + 제목 + 한 줄 설명) |

**ui/** (공통 부품)

| 파일 | 역할 |
|---|---|
| `Button.jsx` | 변형: primary, secondary, danger, soft, softDanger, ghost (알약). hover/active(scale 0.98)/focus-visible 링, `loading` prop(스피너 + 클릭 차단) |
| `Input.jsx`, `Select.jsx` | 공통 `.field` 스타일, 라벨·오류(아이콘 + `aria-describedby`) 표시, 포커스 시 accent 링 + 옅은 배경 |
| `Modal.jsx` | 모달 (Esc·바깥 클릭으로 닫힘). `document.body`에 포털 렌더, 배경 블러, 모바일은 아래에서 올라오는 하단 시트·데스크톱은 fade+scale, 열린 동안 뒤 스크롤 잠금 |
| `ConfirmDialog.jsx` | 삭제 확인 대화상자 (휴지통 아이콘 배지, 처리 중 로딩 버튼) |
| `Spinner.jsx`, `ErrorMessage.jsx`, `EmptyState.jsx` | 로딩·오류(아이콘 + 다시 시도)·빈 상태(아이콘 배지) |
| `Icon.jsx` | 인라인 SVG 선 아이콘(`draw` 옵션: hover 시 선이 그려지는 효과): dashboard, transactions, subscriptions, edit, trash, logout, close, chevronLeft/Right, inbox, alert, info, arrowUp/Down, wallet |
| `HoverLabel.jsx` | 마우스 호버·포커스 시 즉시 나타나는 이름 말풍선 |
| `ParrotLogo.jsx` | 선으로 그린 앵무새 로고(눈 없음, 곡선이 살아 있는 몸통, 갈고리 부리, 긴 꼬리, 날개·꼬리 깃). 기본은 초록→노랑→코랄 그라데이션(`useId`로 고유 id), `variant="mono"`는 `currentColor`, `size`(px) 24 이하에서는 선을 굵게 하고 세부 깃 라인을 생략 |

**charts/**

| 파일 | 역할 |
|---|---|
| `CategoryPieChart.jsx` | 지출 도넛(md 이상 왼쪽 55%, 최대 300px, 안쪽 52%·바깥 90%) + 카테고리 표(오른쪽, 768px 미만은 위/아래). 중앙은 항상 총 지출(호버 불변, 자릿수별 글자 크기). 표는 "이름·이번 달 금액"이 붙고 지난달·증감(▲ 14% 지출 증가=expense 색, ▼ 8% 감소=income 색, 신규/없음/-) 열이 (헤더·행·합계가 같은 grid: 고정 폭 이름(이름-금액 간격 `--pair`=10px) | 이번 달 오른쪽 정렬 | 지난달 왼쪽 정렬 | 증감, 열 사이 여백은 CSS 변수 `--g`=16px 하나, 지난달·증감 세트를 `--shift`(20px)만큼 이번 달 금액에서 더 오른쪽으로 둠(목록 오른쪽 마진 -20px로 다른 요소 위치 유지, 구분선 없음). 증감 글자만 6px 더 오른쪽, 목록 전체는 12px 위로(transform), 도넛과 목록은 20px 간격으로 카드 안 가운데 정렬) 합계 행 포함. 지난달 카테고리는 category_id(없으면 이름)로 매칭하고 이번 달 0원 항목은 맨 아래·조각 없음(호버하면 행 하이라이트만). 768px 미만은 항목 둘째 줄에 "지난달 … · ▲ 14%". 조각 또는 항목에 hover/포커스하면 조각 9px 튀어나옴·나머지 0.35 흐림, 클릭하면 고정/해제. 조각과 항목은 선 없이 호버 하이라이트(색 틴트·흐림)로만 연동. 색은 `constants/chartColors.js` |
| `MonthlyBarChart.jsx` | `ComposedChart`(높이 288~300px). 지출 막대는 굵고(26px)·완전 불투명, 수입 막대는 좁고(14px)·불투명도 0.5. 지출 선 3px·수입 선 2px(옅게), 흰 테두리 점, 월 중앙 정렬. 지출 금액 라벨(`LabelList`, 모든 달 12px 굵게, 0이면 생략)을 막대 위에 항상 표시하고 선택한 달(마지막 달)의 월 라벨은 굵게. Y축 0부터 최댓값×1.12. "막대·선·둘 다" 토글(기본 둘 다, 저장 안 함; 선 모드에선 라벨이 선의 점 위로), hover 월 하이라이트 밴드, 툴팁(수입·지출·차액 +/−), 범례 버튼은 막대·선을 함께 표시/숨김, "표로 보기" |

**기타 부품**

| 파일 | 역할 |
|---|---|
| `MonthPicker.jsx` | 알약형 컨테이너 안의 이전/다음 아이콘 버튼 + 월 라벨 |
| `DataTable.jsx` | 거래·정기결제 공통 표 틀: `TableCard`, `DataTable`, `Tr`, `Td`, `RowActions`, `RowIconButton`(평소 회색, 호버 시 강조). 작은 화면에서는 카드 안에서 가로 스크롤 |
| `TypeBadge.jsx` | 수입/지출 라벨 칩 (색 + 글자) |
| `TransactionForm.jsx` | 거래 등록·수정 폼. 유형에 따라 카테고리 필터링, 폼 안에서 개인 카테고리 추가 |
| `SubscriptionForm.jsx` | 정기결제 등록 폼 (지출 카테고리만, 기본값 "구독·정기결제") |

### 3.5 그 외

| 파일 | 역할 |
|---|---|
| `constants/app.js` | 서비스 이름 `Budgo`, 로그인 문구, 홈 중앙 문구(`HOME_PHRASE`) |
| `constants/chartColors.js` | 도넛 차트 색 상수(`DONUT_COLORS` 6색, `DONUT_ETC_COLOR`) |
| `constants/nav.js` | 메뉴 항목(경로·이름·아이콘·한 줄 설명). 상단 바와 홈이 함께 사용 |
| `hooks/useCategories.js` | 카테고리 조회·추가 훅 (거래·정기결제 폼에서 사용) |
| `hooks/useReducedMotion.js` | OS "동작 줄이기" 여부 (차트 애니메이션 비활성화에 사용) |
| `utils/format.js` | 원화 포맷, 수입/지출 부호·색, 유형·주기 한글 라벨, 날짜·월 축약 표기, 단위 없는 숫자(`formatNumber`) |
| `utils/month.js` | `YYYY-MM` 계산, 월 라벨, 오늘 날짜 |
| `utils/formErrors.js` | 서버 422 필드 오류를 폼 입력칸 이름으로 매핑 |
| `index.css` | 디자인 토큰(`@theme`), 공통 클래스(`@layer components`), 그라데이션 글자, 애니메이션, 차트 영역 한정 포커스 윤곽선 제거 규칙(`.recharts-wrapper`) |

## 4. 디자인 규칙

- **스타일:** Gemini 느낌의 밝은 배경(`#f8fafd`), 흰 카드 + 아주 옅은 1px 테두리 + 부드러운 그림자, 큰 곡률, 알약 모양 버튼.
- **글꼴:** `Pretendard Variable → Pretendard → 시스템 한글 글꼴` 스택만 지정한다(외부 CDN·패키지 없음). Pretendard가 설치된 환경에서만 적용되고, 아니면 시스템 폰트로 보인다.
- **디자인 토큰** (`src/index.css`의 `@theme`)

| 구분 | 토큰 | 값 | 용도 |
|---|---|---|---|
| 브랜드 색 | `income` | `#12b76a` | 수입 채움·배지·막대·그라데이션 시작 |
| | `expense` | `#f04452` | 지출 채움·배지·막대·그라데이션 끝 |
| | `accent` / `accent-soft` | `#0f9d58` / `#d7f0e1` | 포커스 링·현재 메뉴·아이콘 배지 배경·호버 배경 |
| | `surface` | `#f8fafd` | 페이지 배경 |
| | `gem-ink` | `#1f1f1f` | 제목·기본 글자·주요 버튼 |
| 글자용 진한 색 (**신규**, 흰 배경 AA 4.5:1 이상) | `income-ink` | `#0a7a45` (5.4:1) | 수입 금액·합계·라벨 |
| | `expense-ink` | `#c8283a` (5.5:1) | 지출 금액·합계·라벨 |
| | `accent-ink` | `#0b7a43` (5.4:1) | 현재 메뉴 아이콘·링크·안내 아이콘 |
| 텍스트 위계 (**신규**) | `gem-ink` > `ink-muted` `#475569` > `ink-subtle` `#64748b` | | 제목 > 본문 > 보조 (모두 AA 이상) |
| 테두리 (**신규**) | `line` | `slate-200` 70% | 카드·표 구분선 |
| 곡률 (**신규**) | `radius-control` / `radius-card` / `radius-sheet` | 14px / 20px / 28px | 입력창 / 카드 / 모달·시트 |
| 그림자 (**신규**) | `shadow-soft` / `shadow-card` / `shadow-pop` | 얇게 → 보통 → 떠오름 | 칩·버튼 / 카드 / 모달·툴팁·호버 카드 |

- **사용 원칙:** 채움·배지·차트·그라데이션에는 브랜드 색(`income`, `expense`)을, 작은 글자와 금액에는 `-ink` 색을 쓴다. 이름 그라데이션은 초록 → 노랑(`#f2b83d`) → 빨강 순이다.
- **공통 클래스** (`@layer components`): `.card`, `.card-lift`, `.field`/`.field-error`, `.chip`, `.focus-ring`, `.num`/`.num-strong`(tabular-nums), `.type-title`/`.type-heading`/`.type-body`/`.type-caption`.
- **홈 전용 장식:** `.dot-pattern`(점 패턴), `.icon-draw`(선 그리기), 메시 블러 원 `drift-a~d`(22~30초).
- **애니메이션:** `animate-fade-up`(홈 순차 등장), `animate-page`(화면 전환), `animate-fade-in`(오버레이), `modal-panel`(모바일 시트/데스크톱 팝), 아이콘 선 그리기, 차트 등장. 모두 150~800ms(배경 떠다님은 22~30초 주기)이며 OS의 "동작 줄이기" 설정이면 꺼진다. 화면 연출용 애니메이션은 루트 `AGENTS.md` 규칙 4에서 허용한다.
- 오류·삭제는 일반 빨강 계열(`red-*`)로 지출색과 구분한다. 수입·지출은 색뿐 아니라 `+`/`−` 부호와 배지 글자로도 구분한다.
- **도넛 차트 색** (`constants/chartColors.js`, 순위순): `#12b76a`(초록), `#f2b83d`(노랑), `#f97316`(주황), `#14b8a6`(티얼), `#84cc16`(라임), `#f4a3a8`(옅은 코랄), 기타 `#a8a29e`. 카테고리가 6개를 넘으면 상위 5개 + 기타. 빨강 계열(지출색)은 쓰지 않는다. 인접 조각 구분은 팔레트 검증 스크립트 통과 순서.
- **반응형:** 375px에서 가로 넘침이 없도록 확인했다(상단 바는 모바일에서 크기를 줄임, 표는 카드 안에서 가로 스크롤). 모달은 모바일에서 하단 시트.

## 5. 환경 변수

| 변수 | 위치 | 설명 |
|---|---|---|
| `VITE_USE_MOCK` | `.env` / `.env.production` | `true`면 목 서버, `false`면 실제 `/api`. 운영 빌드는 `false`로 고정 |
| `API_PROXY_TARGET` | `.env` | 개발 서버의 `/api` 프록시 대상. 기본 `http://127.0.0.1:8000` |

## 6. 실행·빌드

```bash
cd frontend
npm install
cp .env.example .env     # 목 데이터로 실행 (VITE_USE_MOCK=true)
npm run dev              # http://localhost:5173
npm run lint
npm run build            # dist/ 생성 (목 코드 제외)
```

## 7. PRD 제외 범위 준수 사항

정기결제 수정, 거래 자동·수동 반영, 결제일 계산·D-day, 거래 유형 필터·검색(카테고리별 보기는 프론트 전용으로 추가됨), 카테고리 수정·삭제는 만들지 않았다. 정기결제 금액은 거래 내역과 대시보드 집계에 포함되지 않는다.
