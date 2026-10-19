import { Link } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import ParrotLogo from '../components/ui/ParrotLogo'
import { HOME_PHRASE } from '../constants/app'
import { NAV_LINKS } from '../constants/nav'

// 순차 등장: 문구 → 아이콘 3개(100ms 간격) → 하단 문구
const delay = (ms) => ({ animationDelay: `${ms}ms` })

// 로그인 후 첫 화면(현관): 천천히 떠다니는 메시 그라데이션 배경 위에 큰 문구와 큰 아이콘 3개만 둔다.
// 아이콘에는 칸(카드)·이름·설명 없이 모션만 적용된다: hover 시 6px 떠오름 + accent 색 + 선 그리기.
export default function HomePage() {
  return (
    <>
      {/* 배경: 브랜드 색 블러 원 4개가 22~30초 주기로 떠다니고, 위에 옅은 점 패턴을 얹는다 */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] animate-[drift-a_24s_ease-in-out_infinite] rounded-full bg-income/30 blur-[100px] motion-reduce:animate-none" />
        <div className="absolute top-1/4 -right-28 h-[26rem] w-[26rem] animate-[drift-b_28s_ease-in-out_infinite] rounded-full bg-[#f2b83d]/35 blur-[110px] motion-reduce:animate-none" />
        <div className="absolute -bottom-32 left-1/4 h-[30rem] w-[30rem] animate-[drift-c_26s_ease-in-out_infinite] rounded-full bg-[#f4a3a8]/40 blur-[120px] motion-reduce:animate-none" />
        <div className="absolute bottom-1/4 -left-32 h-80 w-80 animate-[drift-d_30s_ease-in-out_infinite] rounded-full bg-[#14b8a6]/20 blur-[90px] motion-reduce:animate-none" />
        <div className="dot-pattern absolute inset-0" />
      </div>

      <div className="relative z-10 flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-12 text-center sm:gap-16">
        <h1
          className="animate-fade-up text-3xl leading-tight font-bold tracking-tighter break-keep sm:text-5xl lg:text-6xl"
          style={delay(0)}
        >
          {HOME_PHRASE.lead} <span className="text-gradient">{HOME_PHRASE.accent}</span>
        </h1>

        <nav className="flex items-center justify-center gap-6 sm:gap-16">
          {NAV_LINKS.map((l, i) => (
            <Link
              key={l.to}
              to={l.to}
              aria-label={`${l.label}: ${l.desc}`}
              className="focus-ring group animate-fade-up rounded-3xl p-2 text-ink-muted transition duration-300 hover:-translate-y-1.5 hover:text-accent focus-visible:-translate-y-1.5 focus-visible:text-accent motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0"
              style={delay(160 + i * 100)}
            >
              <Icon name={l.icon} draw strokeWidth={1.4} className="h-16 w-16 sm:h-28 sm:w-28" />
            </Link>
          ))}
        </nav>

        <p className="animate-fade-up flex items-center gap-2 text-xs text-ink-subtle" style={delay(560)}>
          <ParrotLogo size={20} />
          오늘도 가볍게 기록해요
        </p>
      </div>
    </>
  )
}
