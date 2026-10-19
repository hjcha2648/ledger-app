import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import useReducedMotion from '../../hooks/useReducedMotion'
import { formatCompactKRW, formatKRW, formatMonthShort } from '../../utils/format'
import { formatMonthLabel } from '../../utils/month'

const INCOME_COLOR = '#12b76a' // --color-income (index.css 와 동일)
const EXPENSE_COLOR = '#f04452' // --color-expense (index.css 와 동일)

const SERIES = [
  { key: 'income_krw', name: '수입', color: INCOME_COLOR },
  { key: 'expense_krw', name: '지출', color: EXPENSE_COLOR },
]

// 부호를 붙인 금액: 0 이상 +, 음수 −
const signed = (n) => `${n < 0 ? '−' : '+'}${formatKRW(Math.abs(n))}`

function MonthTooltip({ active, payload, label, hidden }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const diff = row.income_krw - row.expense_krw
  return (
    <div className="min-w-40 rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-pop">
      <p className="mb-1.5 font-semibold text-gem-ink">{formatMonthLabel(label)}</p>
      {SERIES.filter((s) => !hidden[s.key]).map((s) => (
        <p key={s.key} className="num flex items-center justify-between gap-4 text-ink-muted">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
          <span>{formatKRW(row[s.key])}</span>
        </p>
      ))}
      {!hidden.income_krw && !hidden.expense_krw && (
        <p className="num mt-1.5 flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5 font-semibold">
          <span className="text-ink-muted">차액</span>
          <span className={diff < 0 ? 'text-expense-ink' : 'text-income-ink'}>{signed(diff)}</span>
        </p>
      )}
    </div>
  )
}

export default function MonthlyBarChart({ data }) {
  const reduced = useReducedMotion()
  const [hoverIdx, setHoverIdx] = useState(null)
  const [hidden, setHidden] = useState({ income_krw: false, expense_krw: false })

  const toggle = (key) => setHidden((h) => ({ ...h, [key]: !h[key] }))

  // 호버한 월의 막대는 진하게, 나머지는 흐리게
  const renderBar = (props) => (
    <Rectangle
      {...props}
      fillOpacity={hoverIdx != null && props.index !== hoverIdx ? 0.45 : 1}
      style={{ transition: 'fill-opacity 150ms' }}
    />
  )

  return (
    <div>
      {/* 범례 겸 토글: 눌러서 시리즈를 보이거나 숨긴다 */}
      <div className="mb-2 flex justify-end gap-1.5">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={!hidden[s.key]}
            onClick={() => toggle(s.key)}
            className={`focus-ring flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition duration-150 hover:bg-slate-100 ${
              hidden[s.key] ? 'text-ink-subtle line-through opacity-60' : 'text-ink-muted'
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </button>
        ))}
      </div>

      <div className="h-60" role="img" aria-label="최근 6개월 월별 수입과 지출 막대 차트">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barGap={2}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            onMouseMove={(state) => {
              const i = state?.activeTooltipIndex
              setHoverIdx(i == null || i === '' ? null : Number(i))
            }}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 4" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthShort}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatCompactKRW}
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            {/* 호버한 월 뒤에 옅은 accent-soft 세로 밴드 */}
            <Tooltip
              content={<MonthTooltip hidden={hidden} />}
              cursor={{ fill: '#d7f0e1', fillOpacity: 0.6 }}
              isAnimationActive={false}
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                hide={hidden[s.key]}
                barSize={20}
                radius={[8, 8, 0, 0]}
                shape={renderBar}
                isAnimationActive={!reduced}
                animationDuration={700}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="type-caption mt-3">
        <summary className="focus-ring w-fit cursor-pointer select-none rounded text-ink-subtle transition-colors hover:text-gem-ink">
          표로 보기
        </summary>
        <table className="num mt-2 w-full text-right text-ink-muted">
          <thead className="text-ink-subtle">
            <tr>
              <th className="py-1 text-left font-medium">월</th>
              <th className="py-1 font-medium">수입</th>
              <th className="py-1 font-medium">지출</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((d) => (
              <tr key={d.month}>
                <td className="py-1 text-left">{formatMonthLabel(d.month)}</td>
                <td className="py-1">{formatKRW(d.income_krw)}</td>
                <td className="py-1">{formatKRW(d.expense_krw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
