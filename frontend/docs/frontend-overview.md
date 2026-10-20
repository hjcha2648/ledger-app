# 소복 프론트엔드 구성 한눈에 보기

React 19 · Vite 8 · Tailwind CSS 4 · Recharts 3 · react-router-dom 7 (JavaScript)

## 1. 화면과 경로

| 경로 | 화면 | 파일 | 접근 |
|---|---|---|---|
| `/login` | 로그인 | `pages/LoginPage.jsx` | 공개 (로그인 상태면 `/home`으로 이동) |
| `/register` | 회원가입 | `pages/RegisterPage.jsx` | 공개 |
| `/home` | 현관 화면 (떠다니는 메시 배경, 큰 문구, 큰 선 아이콘 4개(NAV_LINKS), 순차 등장) | `pages/HomePage.jsx` | 로그인 필요, **로그인 후 첫 화면** |
| `/dashboard` | 요약 카드 3개, 도넛 차트, 6개월 막대 차트 | `pages/DashboardPage.jsx` | 로그인 필요 |
| `/transactions` | 월별 거래 표 또는 캘린더(`?view=calendar`), 등록·수정 모달, 삭제 확인 | `pages/TransactionsPage.jsx` | 로그인 필요 |
| `/subscriptions` | 정기결제 목록, 등록 모달, 삭제 확인 (수정 없음) | `pages/SubscriptionsPage.jsx` | 로그인 필요 |
| `/chat` | AI 챗봇 대화 (`POST /api/chat`, 월 선택·예시 질문·안내 문구) | `pages/ChatPage.jsx` | 로그인 필요 |
| 그 외 | `/home`으로 이동 | `App.jsx` | - |

- 라우트 구성은 `src/App.jsx`: `PublicRoute`(로그인/회원가입) → `ProtectedRoute` → `AppLayout`(상단 바 + 본문).
- 로그인 전에 보호 경로로 접근하면 `/login`으로 보냈다가, 로그인 후 원래 경로로 돌아간다.

## 2. 폴더 구조

```
frontend/
├─ index.html                 진입 HTML (title: 소복, lang: ko)
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
| `chat.js` | `sendChat({ month, messages })` → `POST /api/chat`, 답변 일반 텍스트(`reply`)만 반환. 목 모드는 `mockChat` |
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
| `HomePage.jsx` | 현관 화면. 초록·노랑·코랄·티얼 블러 원 4개가 22~30초 주기로 떠다니는 메시 배경 + 옅은 점 패턴, 큰 문구(뒷부분 그라데이션), 칸·이름·설명 없이 큰 선 아이콘 4개(NAV_LINKS)만 표시(hover 시 6px 떠오름·accent 색·선 그리기), 하단 로고 문구. 문구 → 아이콘(100ms 간격) → 하단 문구 순차 등장 |
| `DashboardPage.jsx` | (이번 달·지난달 `getDashboard`를 `Promise.allSettled`로 병렬 조회: 지난달만 실패하면 "-" 처리, 월 변경 시 늦은 응답 무시)  월 선택, 아이콘 배지·보조 문구가 있는 총수입·총지출·잔액 카드(**정적**: hover·클릭·등장 애니메이션 없음), 폭은 다른 화면과 같은 `max-w-[58rem]`. 카테고리별 지출 도넛 카드와 최근 6개월 수입·지출 카드를 위아래로 쌓아 각각 전체 폭으로 배치(모바일도 같은 순서). 화면 전환 fade-up 제외 |
| `TransactionsPage.jsx` | 월 선택, 보기 토글(표 ↔ 캘린더, URL `?view=calendar`로 유지·기본 표), 캘린더 보기(월 거래를 날짜별로 묶어 `TransactionCalendar`에 전달, 선택 날짜 상세는 데스크톱 아래 카드·모바일 하단 시트, 수정·삭제·등록 핸들러와 모달은 표와 공유, 월 변경 시 선택 날짜 초기화). 헤더: 왼쪽 [제목 블록], 오른쪽 [월 선택기, 카테고리별 보기 드롭다운(알약형, 열렸을 때도 흰 배경·회색 테두리(초록 배경·테두리·링 없음), 내용 폭 자동·최소 10.5rem·pr-10이라 "전체 카테고리"·가장 긴 이름이 잘리지 않음)](좁아지면 줄바꿈, 375px에서는 선택 창이 한 줄 전체 폭), 합계 줄: 칩 왼쪽 + 오른쪽 끝 [보기 스위치][+ 거래 등록](같은 높이 36px·모바일 40px, 375px에서는 스위치 옆에서 버튼이 남는 폭). 카테고리별 보기 드롭다운은 전체 + 그 달 거래에 나온 카테고리이고(선택하면 표와 수입·지출·잔액 합계가 그 카테고리만 반영, 프론트에서만 걸러 API·백엔드 변경 없음), 합계 칩 3개(수입·지출 칩은 호버·포커스하면 표에서 해당 거래를 유형 색 배경으로 강조하고 나머지는 흐리게, 잔액 칩은 정적), 거래 표(유형 배지, 금액 우측 정렬, 수정·삭제 아이콘 버튼), 등록/수정 모달, 삭제 확인 |
| `SubscriptionsPage.jsx` | 정보 배너(accent-soft), 정기결제 표(주기 칩, 삭제 아이콘 버튼), 등록 모달, 삭제 확인 |
| `ChatPage.jsx` | AI 챗봇 화면. 내 메시지는 오른쪽 흰 말풍선 + 검정(gem-ink) 글씨(옅은 테두리 slate-200/70 + 부드러운 그림자, `rounded-3xl`, 오른쪽 아래만 작게, 최대 폭 75%, 예시 질문·직접 입력 모두 같은 스타일), AI 메시지는 아주 옅은 회색 말풍선(표 행 호버 색 slate-50 70%, `constants/hoverTone.js`의 `LIGHT_GRAY_BG`, 옅은 테두리 + 부드러운 그림자, 왼쪽 위 모서리만 작게, 최대 폭 85%) 안의 텍스트(15px, relaxed, tabular-nums)로 왼쪽에 원형 배경·테두리 없는 소복 로고만(아바타 32px 영역). 답변은 일반 텍스트(마크다운 없음)라 줄 단위로 그려 빈 줄은 간격, "- " 목록은 들여쓴 점 목록으로 보인다. 대화는 컴포넌트 상태에만 보관(새로고침·"새 대화"로 초기화, 서버 저장 없음)하고 최근 10개만 전송, 기준 월은 월 선택기로 바꾸며 "2026년 10월 데이터 기준"·"가상 데이터 기반이며 금융 조언이 아닙니다" 표시. 응답 대기는 아바타 옆에 초록→노랑→코랄 점 3개가 순서대로 튀고 "생각하는 중…"(동작 줄이기 시 정지). 방금 도착한 답변은 한 글자씩 나타나는 타이핑 효과(약 12ms/글자, 길어도 1.5초 안에 끝남, 대화 영역을 누르면 전체 표시, 동작 줄이기·이전 메시지는 즉시 표시, 효과 중에는 전체 텍스트를 sr-only로 제공). 입력창은 textarea 자동 높이(최대 6줄=144px 후 내부 스크롤), Enter 전송·Shift+Enter 줄바꿈(한글 조합 중 Enter는 전송 안 함)·1000자 제한(900자부터 카운터), focus-within 시 accent 테두리 + 4px accent/20 글로우(150ms). 전송 버튼은 비었을 때 연한 회색 원, 입력이 생기면 검정 원(scale 1.05, 위 화살표가 올라감, hover 시 accent), 대기 중 스피너. 대화 중에는 전송 직후·답변 도착 시 입력창에 자동 포커스. 입력창 아래에 "기준 월 + 가상 데이터 기반이며 금융 조언이 아닙니다" 보조 문구 한 곳. 오류는 서버 `detail`(429 "질문이 너무 많습니다…", 503 "챗봇을 지금 사용할 수 없습니다…", 연결 실패 등)을 `ErrorMessage`로 보이고 "다시 시도"로 마지막 질문 재전송. 503이어도 다른 화면은 정상 | **화면 구성**: 제목 블록(아이콘 배지·제목·설명)은 없고 숨은 `h1`("AI 챗봇", `sr-only`)만 둔다. 월 선택기(compact)와 "새 대화"는 한 줄 오른쪽 끝. 카드·박스 없이 뷰포트 전체에 깔린 `fixed` 배경(상단 바 뒤, 클릭 통과, 블러 원 3개(알파 초록 16%·노랑 20%·코랄 20%)는 `vmax` 단위로 뷰포트에 비례하고 레이어 밖으로 번져 경계선이 없으며 대화 중에도 유지) 위에 내용이 바로 놓인다(`/chat`은 `AppLayout`의 페이지 전환 transform 에서 제외해 fixed 배경이 래퍼 안에 갇히지 않게 함). **첫 화면(대화 전)**: 위에서 아래로 예시 질문 3개(카드·아이콘 없이 slate-600 글씨만, 데스크톱 가로 한 줄 간격 32px·모바일 세로, hover·포커스 시 transform scale 1.08 + gem-ink, active 1.03, 동작 줄이기 시 색만) → "안녕하세요, 무엇이 궁금하세요?"(뒷부분 그라데이션, 질문과 약 68px 간격, 입력창과는 40~48px 간격) → 큰 알약 입력창(최대 720px, 화면에서 유일한 칸) → 안내 문구(기준 월 + 가상 데이터 기반이며 금융 조언이 아닙니다, 작은 글씨; 대화 중에는 질문이 접혀 입력창 바로 아래에 남음)가 90ms 간격으로 위에서 아래로 순차 fade-up. 질문 블록은 `order-first`로 화면에서만 위에 놓고 DOM 은 입력창 뒤라 Tab 은 입력창이 먼저 받으며(마우스 환경에서는 진입 시 입력창에 자동 포커스, 터치 기기는 제외), 대화 전에만 컬럼 아래 여백(모바일 100px·sm 이상 140px)으로 묶음을 가운데보다 약간 위로 올린다(padding 이라 전환 애니메이션에 영향 없음). **예시 질문 호버 연출(`components/chat/LaserBubble.jsx`)**: 질문에 마우스를 올리거나(터치 제외, 포인터 이벤트로 구분) 키보드로 포커스(focus-visible)하면 확대와 함께 글씨 둘레(좌우 18px·상하 10px 여백)에 둥근 사각형 + 아래쪽 가운데 꼬리(9px, 아래의 인사 문구 가로 중심 쪽으로 최대 12px 기울어짐: 왼쪽 질문은 오른쪽으로·오른쪽 질문은 왼쪽으로·가운데는 곧게, 모바일 세로 배치에서는 모두 곧게) 말풍선 윤곽선이 꼬리 끝에서 출발해 시계 방향으로 700ms(ease-in-out) 그려진다. 선두에는 흰 코어 + 번짐 광채가 `getPointAtLength` 로 따라 달리고, 선은 브랜드 그라데이션(초록→노랑→코랄) 2px(본선 옅게 + 선두 뒤 밝은 꼬리) + 같은 path 를 굵게 번지게 한 광채이며, 다 그린 뒤에는 안쪽을 채우지 않고 윤곽선 + 광채만 호버가 끝날 때까지 유지된다. 마우스가 나가거나 blur 되면 rAF 를 취소하고 그 지점에서 180ms fade-out, 다시 올리면 처음부터 다시 그린다. 클릭·Enter·Space 는 말풍선 상태와 무관하게 즉시 기존 전송(`submit`)을 실행하고 오버레이를 바로 제거한다(중복 전송 방지는 응답 대기 중 차단 로직만 사용). 터치 기기는 말풍선 없이 탭 즉시 전송, 동작 줄이기면 윤곽선만 즉시 표시하고 나가면 즉시 사라진다. 순수 SVG(`pathLength=1` 정규화 dashoffset)+rAF 로 DOM 속성을 직접 갱신하고 끝나거나 언마운트되면 rAF·타이머를 정리한다. **전환**: 메시지가 생기면(`messages.length > 0`에서 파생) 예시 질문·인사는 위로 grid-rows 1fr→0fr + fade 로 접히고, 메시지 영역은 flex-grow 0→1 로 늘어나 같은 DOM 노드인 입력창이 화면 아래로 연속해서 내려간다(350ms ease-out, 순간이동·깜빡임 없음, 동작 줄이기 시 즉시). 메시지는 배경 위에 fade-up 으로 나타나고 "새 대화"는 반대로 복귀. 섹션 높이는 `100dvh - 12.75rem`(상단 바·여백·헤더 줄 제외, 최소 30rem) 고정 **호버 액션**: AI 메시지에 hover·포커스하면 본문 아래에 복사·다시 생성 아이콘(18px, 평소 보조색·hover 시 아이콘 색만 gem-ink, 이름은 말풍선 없이 글씨만)이 fade-in. 복사는 클릭 후 1.5초간 체크 아이콘 + "복사됨"(clipboard API가 막히면 임시 textarea로 대체), 다시 생성은 마지막 AI 메시지에만 나오며 새 API 없이 마지막 답변을 지우고 같은 대화를 같은 API로 다시 보낸다. 사용자 메시지에 hover하면 말풍선 왼쪽에 복사 아이콘. 터치 기기(`@media (hover: none)`)에서는 액션 줄이 항상 보인다. 헤더의 "새 대화"는 새 대화 아이콘 + 글자 알약(hover 시 accent-soft 배경, 아이콘 확대·회전, 대화가 없으면 흐리게 비활성), 월 선택기는 `compact` 작은 알약. **스크롤**: 대화 카드는 `100dvh` 기반 고정 높이이고 메시지 영역만 내부 스크롤(위·아래 가장자리 페이드 `scroll-fade`, 내부 폭 최대 768px). 내가 질문을 보내면 항상 맨 아래로, 답변·대기·오류·타이핑 중에는 맨 아래 80px 이내일 때만 따라가며, 위로 올려 읽는 중이면 강제 이동하지 않고 우하단 "맨 아래로" 원형 버튼이 fade-in 한다 |

### 3.4 `src/components/`

**layout/**

| 파일 | 역할 |
|---|---|
| `AppLayout.jsx` | 로그인 후 공통 틀 (상단 바 + 본문 최대 폭 58rem(928px), 모든 화면 공통). 화면 전환 시 fade-up(홈·대시보드 제외) |
| `Navbar.jsx` | 반투명 흰 배경 + blur, 하단 옅은 테두리, sticky, 세로 패딩 `py-4`(모바일 72px·sm 이상 80px). 소복 로고 + 이름(홈으로 이동, 왼쪽), 메뉴 아이콘 4개(3열 grid `1fr auto 1fr`의 가운데 열이라 화면 가운데 정렬, 로고가 길어 겹칠 폭이면 밀려남)(홈에서는 숨김)와 로그아웃 아이콘은 배경·테두리·감싸는 상자 없이 아이콘만 보이고 버튼 크기(모바일 40px·sm 이상 48px)로 터치 영역 유지. 아이콘 색은 평소 slate-600, 현재 메뉴는 accent 아이콘 + 아래 4px accent 점(`aria-current`는 NavLink가 부여, 배경 칸 없음), 호버·포커스 시 gem-ink + 1.1배 확대(동작 줄이기면 색만)와 이름(HoverLabel) 표시, focus-visible은 둥근 outline. 아이콘 간격은 버튼 gap 4px(sm 이상 8px)이고 375px에서도 한 줄에 들어가도록 모바일 크기 축소 |
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
| `Logo.jsx` | 소복 로고(소복하게 쌓인 더미 위에 싹이 올라온 모습, 부드러운 선만 사용). 기본은 브랜드 그라데이션(초록→노랑→코랄) 선이고 `variant="mono"`는 부모 글자색을 따른다. `size`(px) 24 이하에서는 선을 굵게 하고 안쪽 겹 선을 생략한다. `public/favicon.svg`는 같은 도형의 정적 버전 |

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
| `TransactionForm.jsx` | 거래 등록·수정 폼(`initialDate`로 등록 시 거래일 미리 채움). 유형에 따라 카테고리 필터링, 폼 안에서 개인 카테고리 추가 |
| `TransactionCalendar.jsx` | 일요일 시작 월 달력(role=grid, 방향키·Enter/Space). 날짜 칸에 수입(+초록)·지출(−코랄) 합계 축약 표시(전체 금액은 title), 거래 1건당 점 1개(수입 초록 먼저·지출 코랄 나중, 칸 왼쪽 하단(날짜 숫자와 같은 왼쪽 선) 한 줄, 모바일 5px)를 최대 5개까지 그리고 6건 이상이면 4개 + "+남은 건수", 칸 aria-label에 수입·지출 건수 포함, 오늘은 gem-ink 알약, 선택 날짜 칸은 평소 흰 배경 그대로 옅은 회색(slate-200) 2px 테두리(inset, 글자색은 기본), 앞뒤 인접 달 칸은 비활성, 일요일 rose·토요일 sky 글자색, 월 변경 시 fade(150ms, 동작 줄이기 시 없음) 칸 스타일은 `cellStyle()` 한 함수가 결정(앞뒤 채움 칸은 효과 없음, 그 외는 칩 호버 규칙, 선택 칸은 평소에만 slate-200 2px 테두리). 합계 칩(수입·지출)을 호버·포커스하는 동안: 그 종류가 있는 칸은 표 행과 같은 옅은 초록·코랄(10%, 구분선 색이 비치지 않게 흰색을 먼저 깐 `CELL_TINT`), 그 외 모든 칸(다른 종류만 있는 칸·거래 없는 칸 포함)은 불투명도 0.4로 흐림(150ms, 동작 줄이기 시 즉시). 색과 흐림 정도는 표 행 호버와 같은 `constants/hoverTone.js` 값을 공유. 선택 칸도 같은 규칙을 따르고 이 동안에는 회색 테두리가 사라지며 호버가 끝나면 돌아옴. 잔액 칩은 효과 없음. aria-selected·aria-label은 호버와 무관하게 유지 |
| `DayDetail.jsx` | 선택한 날짜의 거래 목록(카테고리·사용처/메모·금액·수정·삭제), 수입·지출 합계, "이 날짜로 등록" 버튼, 거래 없는 날은 EmptyState |
| `ViewToggle.jsx` | 아이콘만 보이는 "표 \| 캘린더" 슬라이드 스위치: 칸 42px 정사각형(전체 약 90px), 목록·달력 아이콘 18px. 하나의 accent-soft 알약 indicator 가 `translateX`(220ms, cubic-bezier)로 선택 칸으로 이동(두 칸 폭 동일·초기 위치는 첫 렌더에 확정, 동작 줄이기 시 즉시 이동). 호버·포커스 시 이름("표 보기"/"캘린더 보기")이 글씨만 150ms opacity로 absolute 표시(첫 칸 왼쪽·둘째 칸 오른쪽 맞춤), aria-label·title 포함. role=tablist/tab, 좌우 방향키·Home/End |
| `SubscriptionForm.jsx` | 정기결제 등록 폼 (지출 카테고리만, 기본값 "구독·정기결제") |

### 3.5 그 외

| 파일 | 역할 |
|---|---|
| `constants/app.js` | 서비스 이름 `소복`, 로그인 문구, 홈 중앙 문구(`HOME_PHRASE`) |
| `constants/chartColors.js` | 도넛 차트 색 상수(`DONUT_COLORS` 6색, `DONUT_ETC_COLOR`) |
| `constants/hoverTone.js` | 호버 색 상수(`HOVER_BG` 기본 호버 배경(표 행, slate-50 70%)·`CELL_HOVER`(캘린더 칸, 흰 바탕 위 slate-100 80%로 한 단계 진함), `LIGHT_GRAY_BG`(같은 회색을 hover 없이 쓸 때)·`TYPE_TINT`·`CELL_TINT`·`DIM_SELF`·`DIM_CHILDREN` 합계 칩 호버 하이라이트): 표 행과 캘린더 칸이 같은 값을 쓴다 |
| `constants/nav.js` | 메뉴 항목(대시보드·거래 내역·정기결제·AI 챗봇, 경로·이름·아이콘·한 줄 설명). 상단 바와 홈이 함께 사용 |
| `hooks/useCategories.js` | 카테고리 조회·추가 훅 (거래·정기결제 폼에서 사용) |
| `hooks/useReducedMotion.js` | OS "동작 줄이기" 여부 (차트 애니메이션 비활성화에 사용) |
| `hooks/useMediaQuery.js` | CSS 미디어 쿼리 일치 여부 (캘린더 상세를 데스크톱 카드/모바일 시트로 나눌 때 사용) |
| `utils/format.js` | 원화 포맷, 수입/지출 부호·색, 유형·주기 한글 라벨, 날짜·월 축약 표기, 단위 없는 숫자(`formatNumber`) |
| `utils/month.js` | `YYYY-MM` 계산, 월 라벨, 오늘 날짜, 달력 격자(`buildMonthGrid`, `daysInMonth`, `weekdayOf`: 문자열 기반이라 타임존 밀림 없음), 날짜 라벨(`formatDayLabel`) |
| `utils/calendar.js` | 월 거래를 날짜별 합계·건수·목록으로 묶는 `groupByDate` |
| `utils/formErrors.js` | 서버 422 필드 오류를 폼 입력칸 이름으로 매핑 |
| `index.css` | 디자인 토큰(`@theme`), 공통 클래스(`@layer components`), 그라데이션 글자, 애니메이션, 차트 영역 한정 포커스 윤곽선 제거 규칙(`.recharts-wrapper`) |

## 4. 디자인 규칙

- **스타일:** Gemini 느낌의 밝은 배경(`#f8fafd`), 흰 카드 + 아주 옅은 1px 테두리 + 부드러운 그림자, 큰 곡률, 알약 모양 버튼.
- **글꼴:** `Pretendard Variable → Pretendard → 시스템 한글 글꼴` 스택만 지정한다(외부 CDN·패키지 없음). Pretendard가 설치된 환경에서만 적용되고, 아니면 시스템 폰트로 보인다.
- **디자인 토큰** (`src/index.css`의 `@theme`)

| 구분 | 토큰 | 값 | 용도 |
|---|---|---|---|
| 브랜드 색 | `income` | `#22b35e` | 수입 채움·배지·막대·호버 하이라이트(10%)·그라데이션 시작 (로고의 초록, 따뜻하게) |
| | `expense` | `#ef7b6c` | 지출 채움·배지·막대·호버 하이라이트(10%)·그라데이션 끝 (로고의 코랄) |
| | `accent` / `accent-soft` | `#0f9d58` / `#d7f0e1` | 포커스 링·현재 메뉴·아이콘 배지 배경·호버 배경 |
| | `surface` | `#f8fafd` | 페이지 배경 |
| | `gem-ink` | `#1f1f1f` | 제목·기본 글자·주요 버튼 |
| 글자용 진한 색 (**신규**, 흰 배경 AA 4.5:1 이상) | `income-ink` | `#17803d` (5.0:1) | 수입 금액·합계·라벨 |
| | `expense-ink` | `#c2412d` (5.1:1) | 지출 금액·합계·라벨 |
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
- **글꼴:** 본문은 Pretendard 가변 폰트(`index.html`에서 jsDelivr 동적 서브셋 CSS 로 로드), 서비스 이름(소복)은 따뜻하고 도톰한 Sunflower Bold(Google Fonts 700만 로드, `font-brand font-bold`). 이름 크기는 상단 바 30px(sm 이상 44px, 로고는 모바일 32px·sm 이상 40px, 로고와 이름 간격 2px·sm 이상 4px)·로그인 화면 `text-7xl`(sm 이상 `text-8xl`)이고, 색은 잎사귀 초록(#22b35e)→연두(#8bc34a) 두 색만 쓰는 따뜻한 초록 `text-gradient-brand`(홈 문구·챗봇 인사의 3색 `text-gradient`와 별개). 둘 다 불러오지 못하면 시스템 한글 글꼴로 표시된다. 외부 CDN 두 곳(cdn.jsdelivr.net, fonts.googleapis.com/gstatic.com)을 쓴다.
- **도넛 차트 색** (`constants/chartColors.js`, 순위순): `#22b35e`(초록), `#f2b83d`(노랑), `#f97316`(주황), `#14b8a6`(티얼), `#84cc16`(라임), `#f4a3a8`(옅은 코랄), 기타 `#a8a29e`. 카테고리가 6개를 넘으면 상위 5개 + 기타. 코랄 계열(지출색 `#ef7b6c`)과 겹치는 색은 쓰지 않는다. 인접 조각 구분은 팔레트 검증 스크립트 통과 순서.
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
