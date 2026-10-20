import { useEffect, useId, useRef, useState } from 'react'

const DRAW_MS = 700 // 윤곽선이 한 바퀴 그려지는 시간
const SETTLE_MS = 140 // 다 그린 뒤 밝은 꼬리 줄이 가라앉는 시간 (이후 윤곽선·광채는 호버가 끝날 때까지 그대로 유지)
const MAX_LEAN = 12 // 말풍선 꼬리가 조준 대상 쪽으로 기울어지는 최대 거리(px)
const FADE_MS = 180 // 호버가 끝났을 때 사라지는 fade-out 시간
const TRAIL = 0.2 // 선두 뒤로 밝게 이어지는 꼬리 길이 (전체 둘레 대비)
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const clamp01 = (n) => Math.min(Math.max(n, 0), 1)

// 말풍선 윤곽 path: 꼬리 끝에서 출발해 시계 방향으로 한 바퀴 돌고 닫힌다.
// 본체는 (0,0)~(w,h)의 둥근 사각형이고, 꼬리는 아래쪽 변 가운데에서 아래로 tail 만큼 내려온다.
// lean: 꼬리 끝이 밑변 가운데에서 가로로 벗어나는 거리(px, 오른쪽이 +). 조준 대상(아래의 인사 문구)이 있는 쪽으로 기울인다.
function bubblePath(w, h, r, tail, lean = 0) {
  const base = 14
  const bx = Math.min(Math.max(w / 2 - base / 2, r + 2), Math.max(r + 2, w - r - base - 2)) // 꼬리 밑변 왼쪽 x
  const tipX = bx + base / 2 + lean
  const f = (n) => n.toFixed(2)
  return [
    `M${f(tipX)} ${f(h + tail)}`,
    `L${f(bx)} ${f(h)}`,
    `L${f(r)} ${f(h)}`,
    `A${f(r)} ${f(r)} 0 0 1 0 ${f(h - r)}`,
    `L0 ${f(r)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0`,
    `L${f(w - r)} 0`,
    `A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)}`,
    `L${f(w)} ${f(h - r)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h)}`,
    `L${f(bx + base)} ${f(h)}`,
    'Z',
  ].join(' ')
}

// 레이저 말풍선: targetRef 요소(질문 글씨) 둘레에 말풍선 모양 칸이 레이저 펜으로 그려지듯 빛줄기가 달리며 윤곽선을 그린다.
// - 글씨 위에 겹치는 SVG 오버레이(absolute, pointer-events: none, aria-hidden)라 글씨의 위치·크기를 밀지 않는다.
// - 선은 pathLength=1 로 정규화한 stroke-dasharray/dashoffset(1 → 0), 선두에는 밝은 점(core)과 번짐 광채가 getPointAtLength 로 따라 달린다.
// - 색은 브랜드 그라데이션(초록 → 노랑 → 코랄). 광채는 같은 path 를 굵게 겹쳐 feGaussianBlur 로 번지게 한다.
// - 다 그린 뒤에는 안쪽을 채우지 않고 윤곽선 + 광채만 호버가 끝날 때까지 유지한다.
// - leaving: 호버가 끝났다. 진행 중인 rAF 를 취소하고 그 지점에서 FADE_MS 동안 fade-out 한다(마운트 해제는 부모가 한다).
//   다시 호버하면 부모가 key 를 바꿔 처음부터 다시 그린다. rAF 는 끝나거나 leaving·언마운트되면 정리한다.
// - 꼬리는 아래쪽 가운데에 있고 aimRef 요소(아래의 인사 문구) 방향으로 기울어진다.
// - reduced: 모션 없이 윤곽선을 즉시 보여준다(사라질 때도 부모가 즉시 해제).
// 부모 요소(오버레이를 둘러싼 relative 요소)에 padX/padY/꼬리/광채를 담을 여백이 있어야 잘리지 않는다.
export default function LaserBubble({ targetRef, reduced = false, leaving = false, aimRef = null, padX = 18, padY = 10, radius = 18, tail = 9 }) {
  const uid = useId().replace(/:/g, '') // 인스턴스마다 고유한 SVG id
  const [size, setSize] = useState(null) // 질문 글씨 블록의 레이아웃 크기(transform 영향 없음)
  const baseRef = useRef(null)
  const glowRef = useRef(null)
  const trailRef = useRef(null)
  const headRef = useRef(null)
  const headGlowRef = useRef(null)

  // 선택 순간의 크기를 재고, 이후 크기가 바뀌면(줄바꿈 등) 다시 잰다
  useEffect(() => {
    const el = targetRef.current
    if (!el) return undefined
    const measure = () => {
      let lean = 0
      const aim = aimRef?.current
      if (aim) {
        const a = aim.getBoundingClientRect()
        const t = el.getBoundingClientRect()
        lean = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, (a.left + a.width / 2 - (t.left + t.width / 2)) / 20))
      }
      const w = el.offsetWidth
      const h = el.offsetHeight
      // 값이 같으면 같은 객체를 유지해 애니메이션 effect 가 다시 시작되지 않게 한다
      setSize((prev) => (prev && prev.w === w && prev.h === h && Math.abs(prev.lean - lean) < 0.5 ? prev : { w, h, lean }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [targetRef, aimRef])

  const w = size ? size.w + padX * 2 : 0
  const h = size ? size.h + padY * 2 : 0
  const r = Math.min(radius, h / 2, w / 2)
  const d = size ? bubblePath(w, h, r, tail, size.lean) : ''

  useEffect(() => {
    if (!size || leaving) return undefined // leaving 이면 그리기를 멈추고(rAF 취소) 그 지점에서 페이드만 한다
    const base = baseRef.current
    const len = base.getTotalLength()

    // p: 그려진 비율(0~1), settle: 다 그린 뒤 밝은 꼬리 줄이 가라앉는 정도(0~1)
    const apply = (p, settle) => {
      glowRef.current.style.strokeDashoffset = String(1 - p)
      base.style.strokeDashoffset = String(1 - p)
      trailRef.current.style.strokeDashoffset = String(TRAIL - p)
      trailRef.current.style.opacity = String(1 - settle)
      const drawing = p > 0 && p < 1
      const pt = base.getPointAtLength(p * len)
      for (const el of [headRef.current, headGlowRef.current]) {
        el.setAttribute('cx', pt.x)
        el.setAttribute('cy', pt.y)
        el.style.opacity = drawing ? '1' : '0'
      }
    }

    let raf = 0
    if (reduced) {
      apply(1, 1)
    } else {
      const start = performance.now()
      const tick = (now) => {
        const t = now - start
        apply(easeInOut(clamp01(t / DRAW_MS)), clamp01((t - DRAW_MS) / SETTLE_MS))
        if (t < DRAW_MS + SETTLE_MS) raf = requestAnimationFrame(tick) // 다 그리면 rAF 종료, 윤곽선·광채는 그대로 유지
      }
      raf = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(raf)
  }, [size, reduced, leaving])

  if (!size) return null
  const stroke = `url(#laser-grad-${uid})`
  const pathProps = { d, pathLength: 1, fill: 'none', stroke, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute overflow-visible"
      style={{
        left: -padX,
        top: -padY,
        width: w,
        height: h + tail,
        opacity: leaving ? 0 : 1,
        transition: reduced ? 'none' : `opacity ${FADE_MS}ms ease-out`,
      }}
      viewBox={`0 0 ${w} ${h + tail}`}
    >
      <defs>
        <linearGradient id={`laser-grad-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2="0">
          <stop offset="0" stopColor="#12b76a" />
          <stop offset="0.55" stopColor="#f2b83d" />
          <stop offset="1" stopColor="#ef7b6c" />
        </linearGradient>
        <filter id={`laser-blur-${uid}`} filterUnits="userSpaceOnUse" x={-30} y={-30} width={w + 60} height={h + tail + 60}>
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>
      {/* 광채: 같은 path 를 굵게 겹쳐 번지게 */}
      <path ref={glowRef} {...pathProps} strokeWidth="7" opacity="0.35" filter={`url(#laser-blur-${uid})`} strokeDasharray="1" strokeDashoffset="1" />
      {/* 본선: 그려진 부분 전체(옅게) + 선두 뒤 꼬리(밝고 굵게) */}
      <path ref={baseRef} {...pathProps} strokeWidth="2" opacity="0.55" strokeDasharray="1" strokeDashoffset="1" />
      <path ref={trailRef} {...pathProps} strokeWidth="2.5" strokeDasharray={`${TRAIL} 2`} strokeDashoffset={TRAIL} />
      {/* 선두: 번짐 광채 + 흰색에 가까운 코어 */}
      <circle ref={headGlowRef} r="8" fill="#ffe7a0" filter={`url(#laser-blur-${uid})`} style={{ opacity: 0 }} />
      <circle ref={headRef} r="3.5" fill="#ffffff" style={{ opacity: 0 }} />
    </svg>
  )
}
