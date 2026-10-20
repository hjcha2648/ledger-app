import { useId } from 'react'

// 소복 로고 마크: 소복하게 쌓인 더미(저축) 위에 싹(성장·건강한 소비 습관)이 올라온 모습. 부드러운 선으로만 그린다.
// - variant="gradient"(기본): 브랜드 그라데이션(초록 → 노랑 → 코랄) 선
// - variant="mono": 선 색을 currentColor 로 (부모 text-* 색을 따름)
// - size(px): 지정하면 width/height 로 적용. 24px 이하면 선을 굵게 하고 안쪽 겹 선은 생략해 뭉개짐을 막는다.
//   size 를 주지 않으면 className(h-* w-*)으로 크기를 정한다.
// public/favicon.svg 는 같은 도형의 정적 버전이다 (도형을 바꾸면 함께 바꾼다).
export default function Logo({ size, className = 'h-10 w-10', variant = 'gradient' }) {
  const gradientId = `logo-${useId().replace(/:/g, '')}` // 인스턴스마다 고유한 id
  const small = typeof size === 'number' && size <= 24
  const stroke = variant === 'mono' ? 'currentColor' : `url(#${gradientId})`

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="소복 로고"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      stroke={stroke}
      strokeWidth={small ? 4.2 : 3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {variant === 'gradient' && (
        <defs>
          {/* 왼쪽 아래(더미 바닥)에서 오른쪽 위(싹)로 흐르는 그라데이션 */}
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="8" y1="54" x2="56" y2="12">
            <stop offset="0" stopColor="#12b76a" />
            <stop offset="0.55" stopColor="#f2b83d" />
            <stop offset="1" stopColor="#ef7b6c" />
          </linearGradient>
        </defs>
      )}
      {/* 소복하게 쌓인 더미: 바닥에서 완만하게 솟아 가운데가 봉긋한 곡선 */}
      <path d="M6 53C14 53 17 45 22 38C26 32.5 38 32.5 42 38C47 45 50 53 58 53" />
      {/* 싹: 더미 꼭대기에서 올라오는 줄기와 두 장의 잎 */}
      <path d="M32 34V24" />
      <path d="M32 28C26 28 22.5 24 22.5 18.5C28 18.5 32 22 32 28" />
      <path d="M32 24C38 24 41.5 20 41.5 14.5C36 14.5 32 18 32 24" />
      {/* 더미 안쪽 겹 선: 쌓여 있는 느낌 (작은 크기에서는 생략) */}
      {!small && <path d="M17 53C21 47.5 25.5 44 32 44C38.5 44 43 47.5 47 53" strokeWidth="2.4" />}
    </svg>
  )
}
