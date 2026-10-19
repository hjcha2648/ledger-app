import { useState } from 'react'
import { Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts'
import { DONUT_COLORS, DONUT_ETC_COLOR } from '../../constants/chartColors'
import useReducedMotion from '../../hooks/useReducedMotion'
import { formatKRW } from '../../utils/format'
import EmptyState from '../ui/EmptyState'

const MAX_SLICES = DONUT_COLORS.length
const POP_OUT = 9 // 호버한 조각이 바깥으로 튀어나오는 거리(px)
const sliceColor = (s, i) => (s.category_id === 'etc' ? DONUT_ETC_COLOR : DONUT_COLORS[i])

// 색 수보다 많으면 상위 (MAX-1)개 + '기타'로 묶는다
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
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-pop">
      <p className="font-semibold text-gem-ink">{name}</p>
      <p className="num text-ink-muted">
        {formatKRW(amount_krw)} · {((amount_krw / total) * 100).toFixed(1)}%
      </p>
    </div>
  )
}

export default function CategoryPieChart({ data }) {
  const reduced = useReducedMotion()
  const [hoverId, setHoverId] = useState(null) // 마우스·포커스로 가리킨 조각
  const [pinnedId, setPinnedId] = useState(null) // 범례 클릭으로 고정한 조각

  if (!data.length) return <EmptyState message="이 달의 지출 내역이 없습니다." />

  // fill 을 데이터에 넣어 도넛 조각·범례 점이 같은 색을 쓰게 한다
  const slices = foldSlices([...data].sort((a, b) => b.amount_krw - a.amount_krw)).map((s, i) => ({
    ...s,
    fill: sliceColor(s, i),
  }))
  const total = slices.reduce((s, c) => s + c.amount_krw, 0)
  const activeId = hoverId ?? pinnedId
  const activeIdx = slices.findIndex((s) => s.category_id === activeId)
  const active = activeIdx >= 0 ? slices[activeIdx] : null

  // 조각 모양: 활성 조각은 바깥으로 확대, 나머지는 흐리게
  const renderShape = (props) => {
    const id = props.payload?.category_id
    const isActive = activeId != null && id === activeId
    const dim = activeId != null && !isActive
    return (
      <Sector
        {...props}
        fill={props.payload?.fill ?? props.fill}
        outerRadius={isActive ? props.outerRadius + POP_OUT : props.outerRadius}
        fillOpacity={dim ? 0.35 : 1}
        style={{ cursor: 'pointer', transition: 'fill-opacity 150ms' }}
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0" role="img" aria-label="카테고리별 지출 비율 도넛 차트">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount_krw"
              nameKey="name"
              innerRadius="56%"
              outerRadius="86%"
              paddingAngle={slices.length > 1 ? 3 : 0}
              stroke="#ffffff"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              shape={renderShape}
              isAnimationActive={!reduced}
              animationDuration={800}
              animationEasing="ease-out"
              onMouseEnter={(_, i) => setHoverId(slices[i].category_id)}
              onMouseLeave={() => setHoverId(null)}
            />
            <Tooltip content={<SliceTooltip total={total} />} isAnimationActive={false} />
          </PieChart>
        </ResponsiveContainer>

        {/* 도넛 중앙: 평소엔 총 지출, 조각을 가리키면 해당 카테고리 정보로 교체 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
          <div key={active ? active.category_id : 'total'} className="animate-fade-in max-w-[7rem]">
            {active ? (
              <>
                <p className="type-caption truncate">{active.name}</p>
                <p className="num-strong text-base text-gem-ink">{formatKRW(active.amount_krw)}</p>
                <p className="num type-caption">{((active.amount_krw / total) * 100).toFixed(1)}%</p>
              </>
            ) : (
              <>
                <p className="type-caption">총 지출</p>
                <p className="num-strong text-base text-gem-ink">{formatKRW(total)}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 범례 겸 표: 도넛과 양방향 연동, 클릭하면 고정/해제 */}
      <ul className="w-full min-w-0 flex-1 space-y-1 text-[13px] sm:text-sm">
        {slices.map((s) => {
          const isActive = s.category_id === activeId
          const dim = activeId != null && !isActive
          return (
            <li key={s.category_id}>
              <button
                type="button"
                aria-pressed={s.category_id === pinnedId}
                onMouseEnter={() => setHoverId(s.category_id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => setHoverId(s.category_id)}
                onBlur={() => setHoverId(null)}
                onClick={() => setPinnedId((p) => (p === s.category_id ? null : s.category_id))}
                className={`focus-ring flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition duration-150 ${
                  isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
                } ${dim ? 'opacity-50' : ''}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.fill }} />
                <span className="min-w-0 flex-1 truncate text-ink-muted">{s.name}</span>
                <span className="num text-gem-ink">{formatKRW(s.amount_krw)}</span>
                <span className="num w-10 text-right text-ink-subtle">{((s.amount_krw / total) * 100).toFixed(0)}%</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
