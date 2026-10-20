import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import useMediaQuery from '../../hooks/useMediaQuery'
import useReducedMotion from '../../hooks/useReducedMotion'
import { formatCompactKRW, formatKRW, formatMonthShort } from '../../utils/format'
import { formatMonthLabel } from '../../utils/month'

const INCOME_COLOR = '#22b35e' // --color-income (index.css 와 동일)
const EXPENSE_COLOR = '#ef7b6c' // --color-expense (index.css 와 동일)

const EXPENSE_INK = '#c2412d' // --color-expense-ink: 금액 라벨용 진한 톤

// 지출이 주인공: 막대는 굵고 진하게·선은 굵게, 수입은 좁고 옅게·선은 가늘게 보조 역할
const SERIES = [
  { key: 'income_krw', name: '수입', color: INCOME_COLOR, lineColor: '#169a4c', barSize: 14, barOpacity: 0.5, lineWidth: 2, lineOpacity: 0.6, dotR: 3 },
  { key: 'expense_krw', name: '지출', color: EXPENSE_COLOR, lineColor: '#e0594a', barSize: 26, barOpacity: 1, lineWidth: 3, lineOpacity: 1, dotR: 4.5 },
]

const MODES = [
  { key: 'bar', label: '막대' },
  { key: 'line', label: '선' },
  { key: 'both', label: '둘 다' },
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
  // 좌우 가장자리 여백을 넓혀 그래프(월별 막대 묶음)끼리 더 붙어 보이게 한다. 좁은 화면(375px)에서는 묶음이 겹치지 않도록 늘리지 않는다.
  const wide = useMediaQuery('(min-width: 640px)')
  const edge = wide ? 48 : 0 // 축 안쪽 여백(첫·끝 막대 묶음과 가장자리 사이)
  const [hidden, setHidden] = useState({ income_krw: false, expense_krw: false })
  const [mode, setMode] = useState('both') // 'bar' | 'line' | 'both' (저장하지 않는 화면 상태)
  const showBars = mode !== 'line'
  const showLines = mode !== 'bar'

  const toggle = (key) => setHidden((h) => ({ ...h, [key]: !h[key] }))

  // 호버한 월의 막대는 그대로, 나머지는 시리즈별 기본 불투명도의 45%로 흐리게
  const barShape = (base) => (props) => (
    <Rectangle
      {...props}
      fillOpacity={hoverIdx != null && props.index !== hoverIdx ? base * 0.45 : base}
      style={{ transition: 'fill-opacity 150ms' }}
    />
  )

  const selectedIdx = data.length - 1 // 선택한 달은 항상 마지막

  // 지출 금액 라벨: 막대(또는 선의 점) 위에 모든 달 같은 크기로 항상 표시, 0이면 생략
  const renderExpenseLabel = ({ x, y, width, value }) => {
    if (!value) return null
    const cx = Number(x) + (width != null ? Number(width) / 2 : 0)
    return (
      <text x={cx} y={Number(y) - (width != null ? 6 : 14)} textAnchor="middle" fontSize={12} fontWeight={700} fill={EXPENSE_INK}>
        {formatCompactKRW(value)}
      </text>
    )
  }

  // 월 라벨: 선택한 달은 굵고 진하게
  const renderMonthTick = ({ x, y, payload, index }) => (
    <text
      x={x}
      y={Number(y) + 12}
      textAnchor="middle"
      fontSize={12}
      fontWeight={index === selectedIdx ? 700 : 400}
      fill={index === selectedIdx ? '#1f1f1f' : '#64748b'}
    >
      {formatMonthShort(payload.value)}
    </text>
  )

  return (
    <div>
      {/* 범례 겸 토글: 눌러서 시리즈를 보이거나 숨긴다 */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="차트 표시 방식" className="flex rounded-full bg-slate-50 p-0.5 ring-1 ring-line">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mode === m.key}
              onClick={() => setMode(m.key)}
              className={`focus-ring rounded-full px-3 py-1 text-xs transition-colors duration-150 ${
                mode === m.key ? 'bg-white font-semibold text-gem-ink shadow-soft' : 'text-ink-muted hover:text-gem-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
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
      </div>

      <div className="h-72 sm:h-[300px]" role="img" aria-label="최근 6개월 월별 수입과 지출 막대·선 차트">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            barGap={2}
            margin={{ top: 20, right: wide ? 28 : 8, left: wide ? 12 : 0, bottom: 0 }}
            onMouseMove={(state) => {
              const i = state?.activeTooltipIndex
              setHoverIdx(i == null || i === '' ? null : Number(i))
            }}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 4" />
            <XAxis
              padding={{ left: edge, right: edge }}
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={renderMonthTick}
            />
            <YAxis
              tickFormatter={formatCompactKRW}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={[0, (max) => Math.max(max * 1.12, 1)]}
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
                hide={hidden[s.key] || !showBars}
                barSize={s.barSize}
                radius={[8, 8, 0, 0]}
                shape={barShape(s.barOpacity)}
                isAnimationActive={!reduced}
                animationDuration={700}
                animationEasing="ease-out"
              >
                {s.key === 'expense_krw' && <LabelList dataKey="expense_krw" content={renderExpenseLabel} />}
              </Bar>
            ))}
            {/* 추세선: 월 중앙(막대 쌍의 가운데)에 점이 놓이고, 막대 뒤에 그려지지 않도록 막대 다음에 둔다 */}
            {SERIES.map((s) => (
              <Line
                key={`${s.key}-line`}
                dataKey={s.key}
                name={s.name}
                type="monotone"
                stroke={s.lineColor}
                strokeWidth={s.lineWidth}
                strokeOpacity={s.lineOpacity}
                dot={{ r: s.dotR, fill: s.lineColor, stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: s.dotR + 1, fill: s.lineColor, stroke: '#ffffff', strokeWidth: 2 }}
                hide={hidden[s.key] || !showLines}
                isAnimationActive={!reduced}
                animationDuration={700}
                animationEasing="ease-out"
              >
                {/* 막대가 없는 "선" 모드에서는 지출 라벨을 선의 점 위에 표시 */}
                {s.key === 'expense_krw' && !showBars && <LabelList dataKey="expense_krw" content={renderExpenseLabel} />}
              </Line>
            ))}
          </ComposedChart>
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
