import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatKRW } from '../../utils/format'
import EmptyState from '../ui/EmptyState'

// 모노톤 5단계(인접 구분 검증 완료). 상위 4개 + 나머지는 '기타'로 묶는다.
const SLICE_COLORS = ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db']
const MAX_SLICES = SLICE_COLORS.length

function foldSlices(items) {
  if (items.length <= MAX_SLICES) return items
  const head = items.slice(0, MAX_SLICES - 1)
  const rest = items.slice(MAX_SLICES - 1)
  return [...head, { category_id: 'etc', name: '기타', amount_krw: rest.reduce((s, c) => s + c.amount_krw, 0) }]
}

function SliceTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const { name, amount_krw } = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-gray-900">{name}</p>
      <p className="text-gray-600">
        {formatKRW(amount_krw)} · {((amount_krw / total) * 100).toFixed(1)}%
      </p>
    </div>
  )
}

export default function CategoryPieChart({ data }) {
  if (!data.length) return <EmptyState message="이 달의 지출 내역이 없습니다." />

  const slices = foldSlices([...data].sort((a, b) => b.amount_krw - a.amount_krw))
  const total = slices.reduce((s, c) => s + c.amount_krw, 0)

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0" role="img" aria-label="카테고리별 지출 비율 도넛 차트">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount_krw"
              nameKey="name"
              innerRadius="58%"
              outerRadius="100%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((s, i) => (
                <Cell key={s.category_id} fill={SLICE_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip content={<SliceTooltip total={total} />} isAnimationActive={false} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 겸 표: 색만으로 구분하지 않도록 이름·금액·비율을 함께 표시 */}
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.category_id} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: SLICE_COLORS[i] }} />
            <span className="min-w-0 flex-1 truncate text-gray-700">{s.name}</span>
            <span className="text-gray-900">{formatKRW(s.amount_krw)}</span>
            <span className="w-12 text-right text-gray-500">{((s.amount_krw / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
