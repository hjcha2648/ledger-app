import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { APP_NAME } from '../../constants/app'
import { NAV_LINKS } from '../../constants/nav'
import { useAuth } from '../../auth/AuthContext'
import HoverLabel from '../ui/HoverLabel'
import Icon from '../ui/Icon'
import Logo from '../ui/Logo'

// 아이콘만 보인다(배경·테두리 없음). 버튼 크기(모바일 40px, sm 이상 48px)는 그대로라 터치 영역이 줄지 않는다.
// 호버·포커스: 아이콘 색이 gem-ink 로 바뀌고 1.1배 커진다(동작 줄이기면 색만). focus-visible 링은 아이콘 둘레의 둥근 outline.
const ICON_ZOOM = 'transition-transform duration-150 group-hover:scale-110 group-focus-visible:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100'
const ITEM =
  'focus-ring group relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none sm:h-12 sm:w-12'

export default function Navbar() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isHome = pathname === '/home' // 홈(현관)에는 큰 아이콘이 있으므로 메뉴 아이콘을 숨긴다

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/75 backdrop-blur-md">
      <div className="mx-auto grid max-w-[60rem] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-4 sm:gap-4 sm:px-4">
        <Link to="/home" aria-label={`${APP_NAME} 홈`} className="focus-ring col-start-1 flex items-center gap-0.5 justify-self-start rounded-full pr-2 sm:gap-1">
          <Logo className="h-8 w-8 sm:h-10 sm:w-10" />
          {/* 이름은 로고보다 크게. 큰 글자의 줄 높이가 상단 바 높이를 키우지 않도록 위아래 여백을 음수로 상쇄 */}
          <span className="text-gradient-brand font-brand font-bold -my-[0.2em] text-[1.875rem] tracking-normal sm:text-[2.75rem]">{APP_NAME}</span>
        </Link>

        {!isHome && (
          <nav className="col-start-2 flex items-center gap-1 sm:gap-2">
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                aria-label={l.label}
                onClick={(e) => {
                  // 이미 /chat 이면 같은 경로라 화면이 유지되므로, 일반 클릭일 때만 첫 화면으로 초기화한다 (새 탭·창 열기 동작은 그대로)
                  if (l.to !== '/chat' || pathname !== '/chat') return
                  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                  e.preventDefault()
                  navigate('/chat', { replace: true, state: { resetKey: Date.now() } })
                }}
                className={({ isActive }) =>
                  `${ITEM} ${isActive ? 'text-accent' : 'text-slate-600 hover:text-gem-ink focus-visible:text-gem-ink'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon name={l.icon} className={`h-6 w-6 sm:h-7 sm:w-7 ${ICON_ZOOM}`} />
                    {/* 현재 메뉴 표시: 아이콘 아래 4px accent 점 */}
                    {isActive && <span aria-hidden="true" className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent sm:bottom-1" />}
                    <HoverLabel label={l.label} />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}

        <button
          type="button"
          onClick={handleLogout}
          aria-label="로그아웃"
          className={`${ITEM} col-start-3 justify-self-end text-slate-600 hover:text-gem-ink focus-visible:text-gem-ink`}
        >
          <Icon name="logout" className={`h-5 w-5 sm:h-6 sm:w-6 ${ICON_ZOOM}`} />
          <HoverLabel label="로그아웃" />
        </button>
      </div>
    </header>
  )
}
