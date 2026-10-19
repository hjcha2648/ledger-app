import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Button from '../ui/Button'

const LINKS = [
  { to: '/dashboard', label: '대시보드' },
  { to: '/transactions', label: '거래 내역' },
  { to: '/subscriptions', label: '정기결제' },
]

export default function Navbar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <span className="text-lg font-bold">가계부</span>
        <nav className="order-last flex w-full gap-1 sm:order-none sm:w-auto">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <Button variant="secondary" onClick={handleLogout} className="!px-3 !py-1.5">
          로그아웃
        </Button>
      </div>
    </header>
  )
}
