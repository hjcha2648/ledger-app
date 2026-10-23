import { useMemo, useState } from 'react'
import { Pie, PieChart, ResponsiveContainer, Sector } from 'recharts'
import { DONUT_COLORS, DONUT_ETC_COLOR } from '../../constants/chartColors'
import useReducedMotion from '../../hooks/useReducedMotion'
import { formatKRW, formatNumber } from '../../utils/format'
import EmptyState from '../ui/EmptyState'

const MAX_SLICES = DONUT_COLORS.length
const POP_OUT = 9 // 호버한 조각이 바깥으로 튀어나오는 거리(px)
const PREV_ONLY_COLOR = '#cbd5e1' // 이번 달 지출이 없어 도넛 조각이 없는 항목의 점 색

// 목록 열 정의: 헤더·행·합계 행이 같은 grid 를 공유한다. 열 사이 여백은 --g(16px) 하나로 통일하고,
// "이름 + 이번 달 금액" 한 세트 안의 간격만 --pair(10px)로 살짝 좁힌다.
//   이름(고정 폭) | 이번 달(오른쪽 정렬) | 지난달(왼쪽 정렬) | 증감(오른쪽 정렬)
// 각 열은 "내용 폭 + --g" 이다. 지난달·증감 세트는 --shift(20px)만큼 이번 달 금액에서 더 떨어뜨리고,
// 그만큼 목록 오른쪽 마진을 -20px 로 줘서 도넛·이름·이번 달 금액의 위치는 그대로 둔다.
// 지난달 열은 왼쪽 안여백도 --g + 1rem + --shift 이다.
// md 미만에서는 이름 | 이번 달 두 열만 쓰고 지난달·증감은 둘째 줄로 내려간다.
const LIST_VARS = '[--g:1rem] [--shift:1.25rem] [--pair:0.625rem] [--name:5rem] [--cur:4.5rem] [--prev:4rem] [--delta:3rem] lg:[--name:6rem]'
const GRID_COLS =
  'grid-cols-[calc(var(--name)_+_var(--pair))_calc(var(--cur)_+_var(--g))] md:grid-cols-[calc(var(--name)_+_var(--pair))_calc(var(--cur)_+_var(--g))_calc(var(--prev)_+_var(--g)_+_var(--shift))_calc(var(--delta)_+_var(--g))]'

// 이번 달 카테고리를 금액순으로 정렬하고, 색 수보다 많으면 상위 (MAX-1)개 + '기타'로 묶어 행 목록을 만든다.
// 지난달 금액은 같은 category_id(없으면 이름)로 매칭하고, 이번 달에 없는 지난달 카테고리는 맨 아래에 따로 붙인다.
function buildRows(data, prevData) {
  const sorted = [...data].sort((a, b) => b.amount_krw - a.amount_krw)
  const folded = sorted.length > MAX_SLICES
  const head = folded ? sorted.slice(0, MAX_SLICES - 1) : sorted
  const rest = folded ? sorted.slice(MAX_SLICES - 1) : []

  const rows = head.map((c, i) => ({
    rid: c.category_id,
    name: c.name,
    cur: c.amount_krw,
    prev: prevData ? 0 : null, // null: 지난달 조회 실패
    members: [c],
    fill: DONUT_COLORS[i],
    hasSlice: true,
  }))
  if (folded) {
    rows.push({
      rid: 'etc',
      name: '기타',
      cur: rest.reduce((s, c) => s + c.amount_krw, 0),
      prev: prevData ? 0 : null,
      members: rest,
      fill: DONUT_ETC_COLOR,
      hasSlice: true,
    })
  }

  const prevOnly = []
  if (prevData) {
    prevData.forEach((p) => {
      const row = rows.find((r) => r.members.some((m) => m.category_id === p.category_id || m.name === p.name))
      if (row) row.prev += p.amount_krw
      else prevOnly.push({ rid: `prev-${p.category_id}`, name: p.name, cur: 0, prev: p.amount_krw, fill: PREV_ONLY_COLOR, hasSlice: false })
    })
  }
  prevOnly.sort((a, b) => b.prev - a.prev)
  return [...rows, ...prevOnly]
}

// 증감 표시: ▲ 14%(지출 증가=expense 색) / ▼ 8%(감소=income 색) / 변화 없음·비교 불가 "-"
function delta(cur, prev) {
  if (prev == null) return { text: '-', cls: 'text-ink-subtle' }
  if (prev === 0) return cur > 0 ? { text: '신규', cls: 'text-ink-muted' } : { text: '-', cls: 'text-ink-subtle' }
  if (cur === 0) return { text: '없음', cls: 'text-ink-muted' }
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return { text: '-', cls: 'text-ink-subtle' }
  return pct > 0 ? { text: `▲ ${pct}%`, cls: 'text-expense-ink' } : { text: `▼ ${Math.abs(pct)}%`, cls: 'text-income-ink' }
}

// 도넛 안쪽 구멍에 들어가도록 금액 자릿수에 따라 글자 크기를 단계로 줄인다
function totalSizeClass(text) {
  if (text.length <= 8) return 'text-xl'
  if (text.length <= 11) return 'text-lg'
  if (text.length <= 14) return 'text-base'
  return 'text-sm'
}

export default function CategoryPieChart({ data, prevData }) {
  const reduced = useReducedMotion()
  const [hoverId, setHoverId] = useState(null) // 마우스·포커스로 가리킨 행(도넛·목록 양방향)
  const [pinnedId, setPinnedId] = useState(null) // 클릭으로 고정한 행

  // 호버(activeId 변경)로 다시 렌더돼도 Pie 의 data 참조가 바뀌지 않도록, 데이터가 바뀔 때만 다시 계산한다.
  const rows = useMemo(() => buildRows(data, prevData ?? null), [data, prevData])
  const slices = useMemo(() => rows.filter((r) => r.hasSlice), [rows])
  const total = slices.reduce((s, c) => s + c.cur, 0)
  const prevTotal = prevData ? prevData.reduce((s, c) => s + c.amount_krw, 0) : null
  const activeId = hoverId ?? pinnedId
  const totalText = formatKRW(total)
  const totalDelta = delta(total, prevTotal)

  if (!data.length) return <EmptyState message="이 달의 지출 내역이 없습니다." />

  // 조각 모양: 활성 조각은 바깥으로 확대, 나머지는 흐리게
  const renderShape = (props) => {
    const id = props.payload?.rid
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

  const fade = 'transition-opacity duration-150 motion-reduce:transition-none'
  const togglePin = (id) => setPinnedId((p) => (p === id ? null : id))
  // 열 구성(md 이상): 이름+이번 달 | 지난달 | 증감

  return (
    <div className="relative flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-5">
      <div
        className="relative z-10 aspect-square w-full max-w-[300px] shrink-0 md:-my-[15px] md:w-[55%] md:-translate-x-3"
        role="img"
        aria-label="카테고리별 지출 비율 도넛 차트"
      >
        {/* 등장 효과는 Recharts 애니메이션이 아니라 이 래퍼의 CSS 마스크(index.css .donut-reveal)로 한다.
            Recharts 애니메이션은 그리는 도중 호버로 다시 렌더되면 늦어지거나 처음부터 다시 돌아 반응이 지연됐다. */}
        <div className={`h-full w-full ${reduced ? '' : 'donut-reveal'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="cur"
              nameKey="name"
              innerRadius="52%"
              outerRadius="90%"
              paddingAngle={slices.length > 1 ? 3 : 0}
              stroke="#ffffff"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              shape={renderShape}
              isAnimationActive={false}
              onMouseEnter={(_, i) => setHoverId(slices[i].rid)}
              onMouseLeave={() => setHoverId(null)}
              onClick={(_, i) => togglePin(slices[i].rid)}
            />
          </PieChart>
        </ResponsiveContainer>
        </div>

        {/* 도넛 중앙: 항상 총 지출 (호버해도 바뀌지 않는다). 구멍 지름의 약 70% 안에 들어가게 폭을 제한 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
          <div className="w-[36%]">
            <p className="type-caption">총 지출</p>
            <p className={`num-strong leading-tight break-keep text-gem-ink ${totalSizeClass(totalText)}`}>{totalText}</p>
          </div>
        </div>
      </div>

      {/* 카테고리 목록: 이름(고정 폭) 바로 옆에 이번 달 금액, 오른쪽에 지난달·증감. 도넛과 양방향 연동, 클릭하면 고정/해제.
          항목마다 설명 줄 자리를 미리 잡아(md 이상) 호버해도 높이가 변하지 않는다 */}
      <div className="flex w-full min-w-0 md:-mr-5 md:w-auto md:flex-none md:-translate-y-3">
        <div className={`relative z-10 w-full text-[13px] md:w-fit ${LIST_VARS}`}>
          <div className={`mb-1 hidden px-[var(--g)] text-xs text-ink-subtle md:grid md:-translate-y-2 ${GRID_COLS}`} aria-hidden="true">
            <span />
            <span className="pr-[var(--g)] text-right md:-translate-x-2">이번 달</span>
            <span className="pl-[calc(var(--g)+1rem+var(--shift))]">지난달</span>
            <span className="text-right md:translate-x-1.5">증감</span>
          </div>
          <ul>
            {rows.map((r) => {
              const isActive = r.rid === activeId
              const d = delta(r.cur, r.prev)
              return (
                <li key={r.rid}>
                  <button
                    type="button"
                    aria-pressed={r.rid === pinnedId}
                    onMouseEnter={() => setHoverId(r.rid)}
                    onMouseLeave={() => setHoverId(null)}
                    onFocus={() => setHoverId(r.rid)}
                    onBlur={() => setHoverId(null)}
                    onClick={() => togglePin(r.rid)}
                    style={{ backgroundColor: isActive ? `${r.fill}1f` : undefined }}
                    className="focus-ring block w-full rounded-xl px-[var(--g)] py-1 text-left transition-colors duration-150 motion-reduce:transition-none"
                  >
                    <span className={`grid items-center ${GRID_COLS}`}>
                      <span className="flex min-w-0 items-center gap-2.5 pr-[var(--pair)]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.fill }} />
                        <span className={`min-w-0 truncate font-medium ${isActive ? 'text-gem-ink' : 'text-ink-muted'}`}>{r.name}</span>
                      </span>
                      <span className="num-strong pr-[var(--g)] text-right text-gem-ink md:-translate-x-2">{formatNumber(r.cur)}</span>
                      <span className="num hidden pl-[calc(var(--g)+1rem+var(--shift))] text-xs text-slate-500 md:block">
                        {r.prev == null || r.prev === 0 ? '-' : formatNumber(r.prev)}
                      </span>
                      <span className={`num hidden pl-[var(--g)] text-right text-xs md:block md:translate-x-1.5 ${d.cls}`}>{d.text}</span>
                      {/* 모바일·태블릿: 둘째 줄에 지난달과 증감을 한 줄로 */}
                      <span className="num col-span-full mt-0.5 block pl-5 text-xs text-slate-500 md:hidden">
                        지난달 {r.prev == null || r.prev === 0 ? '-' : formatNumber(r.prev)} ·{' '}
                        <span className={d.cls}>{d.text}</span>
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`num type-caption hidden h-4 truncate pl-[1.125rem] md:block ${fade} ${isActive ? 'opacity-100' : 'opacity-0'}`}
                    >
                      {r.cur > 0 && total > 0 ? `이번 달 총 지출의 ${((r.cur / total) * 100).toFixed(1)}%` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* 합계 행: 같은 grid */}
          <div className="mt-1 border-t border-slate-100 px-[var(--g)] pt-2">
            <div className={`grid items-center ${GRID_COLS}`}>
              <span className="pl-[1.125rem] font-medium text-ink-muted">합계</span>
              <span className="num-strong pr-[var(--g)] text-right text-gem-ink md:-translate-x-2">{formatNumber(total)}</span>
              <span className="num hidden pl-[calc(var(--g)+1rem+var(--shift))] text-xs text-slate-500 md:block">
                {prevTotal == null || prevTotal === 0 ? '-' : formatNumber(prevTotal)}
              </span>
              <span className={`num hidden pl-[var(--g)] text-right text-xs md:block md:translate-x-1.5 ${totalDelta.cls}`}>{totalDelta.text}</span>
              <p className="num col-span-full mt-0.5 pl-[1.125rem] text-xs text-slate-500 md:hidden">
                지난달 {prevTotal == null || prevTotal === 0 ? '-' : formatNumber(prevTotal)} · <span className={totalDelta.cls}>{totalDelta.text}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
