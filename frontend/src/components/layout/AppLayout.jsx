import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'

const NO_PAGE_ENTER = ['/home', '/dashboard'] // 홈은 자체 순차 등장, 대시보드 요약 카드는 정적이므로 제외

export default function AppLayout() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        {/* 화면이 바뀔 때마다 가벼운 fade-up. 홈(자체 순차 등장)과 대시보드(요약 카드는 정적, 차트는 자체 애니메이션)는 제외 */}
        <div key={pathname} className={NO_PAGE_ENTER.includes(pathname) ? undefined : 'animate-page'}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
