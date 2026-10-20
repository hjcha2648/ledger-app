import { useCallback, useEffect, useState } from 'react'
import { getDashboard } from '../api/dashboard'
import CategoryPieChart from '../components/charts/CategoryPieChart'
import MonthlyBarChart from '../components/charts/MonthlyBarChart'
import PageHeader from '../components/layout/PageHeader'
import MonthPicker from '../components/MonthPicker'
import MonthlyEmailDialog from '../components/MonthlyEmailDialog'
import Button from '../components/ui/Button'
import ErrorMessage from '../components/ui/ErrorMessage'
import Icon from '../components/ui/Icon'
import Spinner from '../components/ui/Spinner'
import { formatKRW } from '../utils/format'
import { currentMonth, shiftMonth } from '../utils/month'

const TONES = {
  income: { badge: 'bg-income/10 text-income-ink', value: 'text-income-ink' },
  expense: { badge: 'bg-expense/10 text-expense-ink', value: 'text-expense-ink' },
  balance: { badge: 'bg-slate-100 text-gem-ink', value: 'text-gem-ink' },
}

// 요약 카드: 아이콘 배지 + 라벨 + 금액 + 보조 문구. 정적인 카드 (hover·클릭·등장 애니메이션 없음)
function SummaryCard({ icon, label, hint, value, tone }) {
  const t = TONES[tone]
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.badge}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <p className="type-body font-medium">{label}</p>
      </div>
      <p className={`num-strong mt-4 text-2xl sm:text-[1.75rem] ${t.value}`}>{value}</p>
      <p className="type-caption mt-1">{hint}</p>
    </div>
  )
}

// 차트 카드: 제목 + 설명 위계
function ChartCard({ title, description, children }) {
  return (
    <section className="card p-5">
      <h2 className="type-heading">{title}</h2>
      <p className="type-caption mb-5 mt-0.5">{description}</p>
      {children}
    </section>
  )
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth)
  const [data, setData] = useState(null)
  const [prevCategories, setPrevCategories] = useState(null) // 지난달 카테고리별 지출. 조회 실패 시 null
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [mailOpen, setMailOpen] = useState(false) // 명세서 메일 모달

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    setReloadKey((k) => k + 1)
  }, [])
  const changeMonth = (m) => {
    setLoading(true)
    setError('')
    setMonth(m)
  }

  useEffect(() => {
    let cancelled = false
    // 이번 달과 지난달을 병렬 조회. 지난달만 실패하면 조용히 null 로 두고, 이번 달 실패만 오류로 다룬다.
    // cancelled 플래그로 월을 바꾼 뒤 늦게 도착한 이전 응답은 버린다.
    Promise.allSettled([getDashboard(month), getDashboard(shiftMonth(month, -1))]).then(([cur, prev]) => {
      if (cancelled) return
      if (cur.status === 'fulfilled') {
        setData(cur.value)
        setPrevCategories(prev.status === 'fulfilled' ? prev.value.expense_by_category : null)
      } else {
        setError(cur.reason?.message ?? '대시보드를 불러오지 못했습니다.')
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [month, reloadKey])

  const summary = data?.summary

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader icon="dashboard" title="대시보드" subtitle="이번 달 수입과 지출을 한눈에" />
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker month={month} onChange={changeMonth} />
          <Button variant="soft" onClick={() => setMailOpen(true)}>
            <Icon name="mail" className="h-4 w-4" />
            명세서 메일로 받기
          </Button>
        </div>
      </div>

      {mailOpen && <MonthlyEmailDialog month={month} onClose={() => setMailOpen(false)} />}

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorMessage message={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <SummaryCard
              icon="arrowUp"
              label="총수입"
              hint="이번 달 들어온 돈"
              value={formatKRW(summary.income_krw)}
              tone="income"
            />
            <SummaryCard
              icon="arrowDown"
              label="총지출"
              hint="이번 달 나간 돈"
              value={formatKRW(summary.expense_krw)}
              tone="expense"
            />
            <SummaryCard
              icon="wallet"
              label="잔액"
              hint="수입에서 지출을 뺀 금액"
              value={`${summary.balance_krw < 0 ? '−' : ''}${formatKRW(Math.abs(summary.balance_krw))}`}
              tone="balance"
            />
          </div>

          <div className="space-y-5">
            <ChartCard title="카테고리별 지출" description="선택한 달의 지출 비율과 지난달 비교">
              <CategoryPieChart data={data.expense_by_category} prevData={prevCategories} />
            </ChartCard>
            <ChartCard title="최근 6개월 수입·지출" description="선택한 달까지의 월별 비교">
              <MonthlyBarChart data={data.monthly_compare} />
            </ChartCard>
          </div>

          <p className="type-caption flex items-center gap-1.5">
            <Icon name="info" className="h-4 w-4 shrink-0" />
            직접 입력한 거래만 집계됩니다. 정기결제 목록의 금액은 포함되지 않습니다.
          </p>
        </>
      )}
    </div>
  )
}
