# 프론트엔드 배포 가이드 (A용: S3 + CloudFront)

## 1. 빌드
```bash
cd frontend
npm install
npm run build        # dist/ 생성
```
- `.env.production`(`VITE_USE_MOCK=false`)이 적용되어 **목 데이터가 번들에 포함되지 않는다.**
- 빌드 PC의 로컬 `.env`에 `VITE_USE_MOCK=true`가 있어도 `npm run build`에서는 `.env.production`이 우선한다.
- 확인: `grep -r "demo1234" dist` 결과가 없어야 한다.

## 2. S3 업로드
```bash
aws s3 sync dist/ s3://<버킷명>/ --delete
```
- 버킷은 비공개로 두고 CloudFront OAC로만 접근시킨다.
- `index.html`은 캐시를 짧게, `assets/*`(해시 파일명)는 길게 둬도 된다.

## 3. CloudFront 설정

| 동작(Behavior) | 오리진 | 설정 |
|---|---|---|
| `/api/*` | EC2 (FastAPI) | 캐시 비활성화, 모든 HTTP 메서드(GET, POST, PATCH, DELETE 등) 허용, `Authorization` 헤더와 쿼리 문자열 전달 |
| 기본 `/*` | S3 | 아래 SPA 라우팅 처리 적용 |

### SPA 라우팅 (중요)
React Router는 `/dashboard`, `/transactions` 같은 경로를 브라우저에서 처리한다. 새로고침이나 직접 접속 시 S3에는 해당 파일이 없어 403/404가 난다.

**배포 전체에 적용되는 "사용자 지정 오류 응답"(403/404 → /index.html)은 `/api/*` 오류까지 index.html로 바꿔버리므로 쓰지 않는다.** (PRD 2장: `/api/*` 오류를 SPA index.html로 치환하지 않는다.)

대신 **기본 동작(`/*`)에만** CloudFront Function(viewer-request)을 연결한다.

```js
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  // 확장자가 없는 경로(SPA 라우트)는 index.html로 전달
  if (!uri.includes('.')) {
    request.uri = '/index.html';
  }
  return request;
}
```
- `/api/*` 동작에는 이 함수를 연결하지 않는다.
- `assets/index-xxxx.js`처럼 확장자가 있는 요청은 그대로 S3로 간다.

## 4. 캐시 무효화
```bash
aws cloudfront create-invalidation --distribution-id <ID> --paths "/index.html"
```
`assets/*`는 파일명에 해시가 있어 무효화가 필요 없다.

## 5. 배포 후 확인
1. CloudFront HTTPS 주소로 접속 → `/login` 표시
2. `/transactions`에서 새로고침 → 404 없이 화면 유지 (SPA 라우팅)
3. 회원가입 → 로그인 → 거래 등록 → 대시보드 수치 확인
4. 개발자도구 Network에서 `/api/...` 요청이 JSON으로 응답하는지 확인 (HTML이 오면 오류 응답 치환 설정 문제)
5. 로그아웃 후 `/dashboard` 접속 → `/login`으로 이동

## 6. 알려진 제약
- 브라우저↔CloudFront는 HTTPS지만 CloudFront↔EC2 구간이 HTTP이면 평문이다. 가상 데이터만 사용한다(PRD 2장).
- 토큰은 `sessionStorage`에 저장한다. 탭을 닫으면 로그아웃된다.
