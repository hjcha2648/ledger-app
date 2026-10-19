import { useId } from 'react'

// 앵무새(Budgie) 로고 마크: 부드러운 곡선 하나로 이어지는 옆모습 (갈고리 부리, 긴 꼬리).
// - variant="gradient"(기본): 브랜드 그라데이션(초록 → 노랑 → 코랄) 선
// - variant="mono": 선 색을 currentColor 로 (부모 text-* 색을 따름)
// - size(px): 지정하면 width/height 로 적용. 24px 이하면 선을 굵게 하고 세부 깃 라인은 생략해 뭉개짐을 막는다.
//   size 를 주지 않으면 className(h-* w-*)으로 크기를 정한다.
export default function ParrotLogo({ size, className = 'h-10 w-10', variant = 'gradient' }) {
  const gradientId = `parrot-${useId().replace(/:/g, '')}` // 인스턴스마다 고유한 id
  const small = typeof size === 'number' && size <= 24
  const stroke = variant === 'mono' ? 'currentColor' : `url(#${gradientId})`

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Budgo 앵무새 로고"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      stroke={stroke}
      strokeWidth={small ? 4.8 : 3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {variant === 'gradient' && (
        <defs>
          {/* 꼬리 끝(왼쪽 아래)에서 머리(오른쪽 위)로 흐르는 그라데이션 */}
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="10" y1="62" x2="56" y2="8">
            <stop offset="0" stopColor="#12b76a" />
            <stop offset="0.55" stopColor="#f2b83d" />
            <stop offset="1" stopColor="#ef7b6c" />
          </linearGradient>
        </defs>
      )}
      {/* 머리·등·긴 꼬리·배·가슴을 잇는 윤곽: 등은 완만하게 휘고 가슴은 둥글게 부풀며 꼬리가 S자로 빠진다 */}
      <path d="M46 10C37 3 27 8 27 19C27 28 18 32 19 44C20 51 17 57 9 61C19 62 29 60 35 55C45 49 51 40 47 30C46 27 48 26 49.5 23" />
      {/* 부리: 이마에서 앞으로 나와 아래로 굽은 갈고리 */}
      <path d="M46 10C54 9 60 14 56.5 25C55 21 52 19 49.5 23" />
      {!small && (
        <>
          {/* 날개 깃 두 줄 */}
          <path d="M31 31C29 40 33 47 41 49" />
          <path d="M36 34C35 39.5 37.5 43.5 41.5 45" strokeWidth="2.4" />
          {/* 꼬리 깃 한 줄 */}
          <path d="M24 51C22 55 19 58 16 59.5" strokeWidth="2.4" />
        </>
      )}
    </svg>
  )
}
