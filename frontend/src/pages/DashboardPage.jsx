import { useCallback, useEffect, useState } from 'react'
import { getDashboard } from '../api/dashboard'
import CategoryPieChart from '../components/charts/CategoryPieChart'
import MonthlyBarChart from '../components/charts/MonthlyBarChart'
import MonthPicker from '../components/MonthPicker'
import ErrorMessage from '../components/ui/ErrorMessage'
import Spinner from '../components/ui/Spinner'
import { formatKRW } from '../utils/format'
import { currentMonth } from '../utils/month'

function SummaryCard({ label, value, valueClass = 'text-gray-900' }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  )
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

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
    getDashboard(month)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [month, reloadKey])

  const summary = data?.summary

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">대시보드</h1>
        <MonthPicker month={month} onChange={changeMonth} />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorMessage message={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="총수입" value={formatKRW(summary.income_krw)} valueClass="text-green-600" />
            <SummaryCard label="총지출" value={formatKRW(summary.expense_krw)} valueClass="text-red-600" />
            <SummaryCard
              label="잔액"
              value={`${summary.balance_krw < 0 ? '−' : ''}${formatKRW(Math.abs(summary.balance_krw))}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="카테고리별 지출">
              <CategoryPieChart data={data.expense_by_category} />
            </ChartCard>
            <ChartCard title="최근 6개월 수입·지출">
              <MonthlyBarChart data={data.monthly_compare} />
            </ChartCard>
          </div>

          <p className="text-xs text-gray-500">
            직접 입력한 거래만 집계됩니다. 정기결제 목록의 금액은 포함되지 않습니다.
          </p>
        </>
      )}
    </div>
  )
}
