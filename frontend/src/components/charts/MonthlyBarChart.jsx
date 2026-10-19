import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactKRW, formatKRW, formatMonthShort } from '../../utils/format'
import { formatMonthLabel } from '../../utils/month'

const INCOME_COLOR = '#16a34a' // green-600
const EXPENSE_COLOR = '#dc2626' // red-600

function MonthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-gray-900">{formatMonthLabel(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-gray-600">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
          {p.name} {formatKRW(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function MonthlyBarChart({ data }) {
  return (
    <div>
      <div className="h-64" role="img" aria-label="최근 6개월 월별 수입과 지출 막대 차트">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthShort}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatCompactKRW}
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <Tooltip content={<MonthTooltip />} cursor={{ fill: '#f3f4f6' }} isAnimationActive={false} />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: '#374151' }} />
            <Bar dataKey="income_krw" name="수입" fill={INCOME_COLOR} barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="expense_krw" name="지출" fill={EXPENSE_COLOR} barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 text-xs text-gray-600">
        <summary className="cursor-pointer select-none text-gray-500 hover:text-gray-900">표로 보기</summary>
        <table className="mt-2 w-full text-right">
          <thead className="text-gray-500">
            <tr>
              <th className="py-1 text-left font-medium">월</th>
              <th className="py-1 font-medium">수입</th>
              <th className="py-1 font-medium">지출</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
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
