import { APP_NAME, APP_TAGLINE } from '../../constants/app'
import ParrotLogo from '../ui/ParrotLogo'

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 pt-6 pb-36">
      {/* 배경: 홈 화면과 같은 톤의 아주 옅은 브랜드 색 블러 원 */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-income/20 blur-3xl" />
        <div className="absolute top-1/2 -right-24 h-72 w-72 rounded-full bg-[#f2b83d]/20 blur-3xl" />
        <div className="absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-expense/15 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* 하단 여백(pb-36)으로 전체를 위로 올려, 입력 카드가 화면 세로 중앙 부근에 오도록 한다. */}
        {/* 로고 → 이름 → 문구를 중앙 정렬로 쌓고, 서로의 간격은 좁게 유지 */}
        <div className="mb-5 flex flex-col items-center text-center">
          <ParrotLogo className="h-20 w-20" />
          <h1 className="text-gradient text-6xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="-mt-1 text-base break-keep text-ink-subtle">{APP_TAGLINE}</p>
        </div>
        <div className="card rounded-sheet p-6 shadow-pop">
          <h2 className="type-heading text-lg">{title}</h2>
          {subtitle && <p className="type-body mt-1">{subtitle}</p>}
          <div className="mt-4">{children}</div>
        </div>
        {footer && <p className="mt-4 text-center text-sm text-ink-subtle">{footer}</p>}
      </div>
    </div>
  )
}
