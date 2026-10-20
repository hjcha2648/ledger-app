import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'

const NO_PAGE_ENTER = ['/home', '/dashboard', '/chat'] // 홈·챗봇은 자체 등장 연출, 대시보드 요약 카드는 정적이므로 제외. (전환 애니메이션의 transform 이 position: fixed 배경의 기준 영역을 바꾸지 않게 하는 효과도 있다)

export default function AppLayout() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="mx-auto max-w-[58rem] px-4 py-6 sm:py-8">
        {/* 화면이 바뀔 때마다 가벼운 fade-up. 홈(자체 순차 등장)과 대시보드(요약 카드는 정적, 차트는 자체 애니메이션)는 제외 */}
        <div key={pathname} className={NO_PAGE_ENTER.includes(pathname) ? undefined : 'animate-page'}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
