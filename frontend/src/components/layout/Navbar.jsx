import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { APP_NAME } from '../../constants/app'
import { NAV_LINKS } from '../../constants/nav'
import { useAuth } from '../../auth/AuthContext'
import HoverLabel from '../ui/HoverLabel'
import Icon from '../ui/Icon'
import ParrotLogo from '../ui/ParrotLogo'

const ICON_ZOOM = 'transition-transform duration-150 group-hover:scale-125'
const ITEM =
  'focus-ring group relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150 sm:h-12 sm:w-12'

export default function Navbar() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const isHome = useLocation().pathname === '/home' // 홈(현관)에는 큰 아이콘이 있으므로 메뉴 아이콘을 숨긴다

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4">
        <Link to="/home" aria-label={`${APP_NAME} 홈`} className="focus-ring flex items-center gap-1.5 rounded-full pr-2 sm:gap-2.5">
          <ParrotLogo className="h-10 w-10 sm:h-12 sm:w-12" />
          <span className="text-gradient text-2xl font-bold tracking-tight sm:text-3xl">{APP_NAME}</span>
        </Link>

        {!isHome && (
          <nav className="flex items-center gap-0.5 rounded-full bg-slate-50 p-1 ring-1 ring-line sm:gap-1">
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                aria-label={l.label}
                className={({ isActive }) =>
                  `${ITEM} ${isActive ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted hover:bg-slate-100 hover:text-gem-ink'}`
                }
              >
                <Icon name={l.icon} className={`h-6 w-6 sm:h-7 sm:w-7 ${ICON_ZOOM}`} />
                <HoverLabel label={l.label} />
              </NavLink>
            ))}
          </nav>
        )}

        <button
          type="button"
          onClick={handleLogout}
          aria-label="로그아웃"
          className={`${ITEM} bg-slate-50 text-ink-muted ring-1 ring-line hover:bg-slate-100 hover:text-gem-ink`}
        >
          <Icon name="logout" className={`h-5 w-5 sm:h-6 sm:w-6 ${ICON_ZOOM}`} />
          <HoverLabel label="로그아웃" />
        </button>
      </div>
    </header>
  )
}
