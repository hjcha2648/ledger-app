import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

// 로그인 상태에서 /login, /register 에 오면 대시보드로 보낸다.
export default function PublicRoute() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
