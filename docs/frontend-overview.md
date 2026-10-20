# 프론트엔드 개요

React + Vite + Tailwind CSS + Recharts. API 는 항상 상대 경로 `/api/...` ([api-contract.md](api-contract.md) 기준). `VITE_USE_MOCK=true` 이면 `src/api/mock` 의 인메모리 데이터를 쓴다.

## 챗봇 (`/chat`)

- 파일: `src/pages/ChatPage.jsx`, `src/components/chat/` (`LaserBubble`, `TipArticle`), `src/api/chat.js`
- 대화는 컴포넌트 상태에만 둔다 (서버 저장 없음). 일반 질문은 말풍선 대화 형식.
- **추천 절약 팁**: 헤더의 버튼을 누르면 대화가 아니라 글(아티클) 화면(`TipArticle`)이 나온다. 같은 `POST /api/chat` 를 쓰되 답을 말풍선에 넣지 않고 소제목·문단·목록·강조 금액으로 렌더링한다 (자체 파서 `parseBlocks`, 새 라이브러리 없음). 이 화면에서는 입력창이 없고, 월을 바꾸면 새 월 데이터로 다시 불러온다. 로딩은 챗봇과 같은 점 3개 "생각하는 중…"(`ThinkingDots`), 오류는 `ErrorMessage` + "다시 시도". 글 덩어리는 `w-fit max-w-[720px] mx-auto`(모바일 `w-full`)로 화면 가로 가운데에, `my-auto` 로(아래 여백 6rem 으로 살짝 위쪽) 상단 바·월 선택기 줄을 뺀 남은 영역의 세로 가운데에 놓이며(글이 길면 위에서부터 시작해 스크롤), 글 정렬은 왼쪽이고 "글 복사" 버튼은 덩어리 가로 중앙이다. 로딩·오류도 같은 래퍼를 쓴다. 제목의 "절약 팁"은 브랜드 그라데이션(`text-gradient`)으로 강조한다. 첫 화면으로는 "새 대화" 또는 상단 챗봇 아이콘으로 돌아간다.
- **챗봇 아이콘 초기화**: `/chat` 에서 상단 챗봇 아이콘을 일반 클릭하면 `Navbar` 가 `navigate('/chat', { replace: true, state: { resetKey } })` 를 호출하고, `ChatPage` 가 `resetKey` 를 `key` 로 써서 재마운트한다. 팁 화면·대화·입력·월·진행 중 요청이 모두 첫 화면으로 돌아가며, 늦게 도착한 응답은 버려진다. Ctrl/Cmd/Shift/Alt+클릭과 휠 클릭은 기본 동작을 유지한다.
- 모든 연출 애니메이션은 `prefers-reduced-motion` 을 존중한다.

## 영수증·명세서 인식 (거래 내역 화면)

- 파일: `src/components/ReceiptImportDialog.jsx`, `src/api/receipts.js`(`analyzeReceipt`), `api/client.js`의 `api.upload`(FormData, Content-Type 은 브라우저가 설정), 목 `mockReceipts`
- 거래 내역 화면의 **"영수증으로 추가"** 버튼 → 모달: 파일 선택(`image/*,application/pdf`, 5MB 초과는 바로 안내, 이미지는 미리보기) → "분석하기"(로딩 점·중복 클릭 방지) → 수정 가능한 항목 목록(포함 체크·날짜·유형·금액·카테고리·사용처·메모, `null`·빈 칸은 빨간 표시, 채워야 저장 가능) → "선택 항목 저장"(항목마다 기존 `createTransaction` 호출, 항목별 저장됨/실패 표시, 일부 실패해도 나머지 저장, 끝나면 목록 새로고침).
- 분석 결과는 입력 초안일 뿐 자동 저장하지 않는다. 안내 문구와 서버 오류 문구(413·422·429·503 `detail`)를 그대로 보여준다.
