import { useRef, useState } from 'react'
import { WEEKDAYS, buildMonthGrid, formatMonthDay, formatMonthLabel, today } from '../utils/month'
import { CELL_TINT, DIM_CHILDREN } from '../constants/hoverTone'
import { formatCompactKRW, formatKRW } from '../utils/format'

const DOT = { INCOME: 'bg-income', EXPENSE: 'bg-expense' }
// 요일 글자색: 지출색(#f04452)·수입색과 혼동되지 않게 채도를 낮춘 rose/sky
const WEEKDAY_TEXT = { 0: 'text-rose-400', 6: 'text-sky-500' }
const MAX_DOTS = 5 // 점 최대 개수. 넘으면 마지막(5번째) 자리를 "+남은 건수"로 바꾼다
const MINUS = '−'
// 선택 칸 표시: 배경은 그대로 두고 둘레에만 2px 테두리. 색은 테마의 회색 테두리(입력창·보조 버튼의 border-slate-300)와 같은 값 (inset 그림자라 칸 크기·주변 칸 위치가 변하지 않는다)
const SELECT_BORDER = 'shadow-[inset_0_0_0_2px_var(--color-slate-300)]'

// 칸 스타일을 정하는 유일한 함수. 우선순위:
//   1) 이번 달이 아닌 칸 → 항상 비활성 (칩 호버 효과 없음)
//   2) 합계 칩 호버 중(hover) → 그 종류가 있는 칸은 초록/빨강 옅은 배경, 그 외 모든 칸은 흐리게 (색·흐림 정도는 표 행과 같은 constants/hoverTone.js 값)
//   3) 호버가 없으면 기본 (hover 시 옅은 accent-soft)
//   + 선택된 칸은 평소(호버가 없을 때)에만 테마 회색(slate-300) 2px 테두리를 갖고, 칩 호버 중에는 테두리 없이 호버 규칙(틴트·흐림)만 따른다.
// 반환: cell(배경·흐림·포커스), ring(선택 테두리, 호버 중에는 빈 값)
function cellStyle({ inMonth, selected, hover, incomeCount, expenseCount }) {
  if (!inMonth) return { cell: 'cursor-default bg-slate-50', ring: '' }
  let cell = 'focus-ring bg-white hover:bg-accent-soft/30'
  if (hover) {
    const has = (hover === 'INCOME' ? incomeCount : expenseCount) > 0
    cell = has ? `focus-ring ${CELL_TINT[hover]}` : `focus-ring bg-white ${DIM_CHILDREN}`
  }
  return { cell: `cursor-pointer ${cell}`, ring: selected && !hover ? SELECT_BORDER : '' }
}

function ariaLabel(date, g) {
  const parts = [formatMonthDay(date)]
  if (g?.income) parts.push(`수입 ${g.incomeCount}건 ${formatKRW(g.income)}`)
  if (g?.expense) parts.push(`지출 ${g.expenseCount}건 ${formatKRW(g.expense)}`)
  if (!g) parts.push('거래 없음')
  return parts.join(', ')
}

function titleText(g) {
  if (!g) return undefined
  const parts = []
  if (g.income) parts.push(`수입 +${formatKRW(g.income)}`)
  if (g.expense) parts.push(`지출 ${MINUS}${formatKRW(g.expense)}`)
  return parts.join(' / ')
}

// 거래 1건당 점 1개(수입 먼저, 지출 나중). MAX_DOTS 를 넘으면 앞의 (MAX-1)개 + 남은 건수
function dotsFor(g) {
  if (!g) return { types: [], more: 0 }
  const all = [...Array(g.incomeCount).fill('INCOME'), ...Array(g.expenseCount).fill('EXPENSE')]
  if (all.length <= MAX_DOTS) return { types: all, more: 0 }
  return { types: all.slice(0, MAX_DOTS - 1), more: all.length - (MAX_DOTS - 1) }
}

// 월 달력: 날짜별 수입·지출 합계. 데이터(byDate)와 선택 상태는 부모(TransactionsPage)가 가진다.
// month 'YYYY-MM', byDate: groupByDate() 결과, selectedDate: 'YYYY-MM-DD', onSelectDate(date)
// highlightType: 'INCOME' | 'EXPENSE' | null — 합계 칩을 가리키는 동안 해당 유형 거래가 있는 날 칸을 색으로 칠하고 나머지는 흐리게
export default function TransactionCalendar({ month, byDate, selectedDate, onSelectDate, highlightType = null }) {
  const cells = buildMonthGrid(month)
  const todayStr = today()
  const [focusDate, setFocusDate] = useState(selectedDate)
  const cellRefs = useRef({})

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const select = (date) => {
    setFocusDate(date)
    onSelectDate(date)
  }

  // 방향키: 좌우 ±1일, 상하 ±7일 (해당 월 안의 칸만). Enter/Space: 선택
  const onKeyDown = (e, date) => {
    const idx = cells.findIndex((c) => c.date === date)
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (delta != null) {
      e.preventDefault()
      const target = cells[idx + delta]
      if (target?.inMonth) {
        setFocusDate(target.date)
        cellRefs.current[target.date]?.focus()
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(date)
    }
  }

  return (
    <div className="card animate-fade-in overflow-hidden p-0" key={month}>
      <div role="grid" aria-label={`${formatMonthLabel(month)} 거래 달력`} className="flex flex-col gap-px bg-slate-100">
        <div role="row" className="grid grid-cols-7 gap-px bg-slate-100">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              role="columnheader"
              className={`bg-white py-2.5 text-center text-xs font-medium ${WEEKDAY_TEXT[i] ?? 'text-ink-subtle'}`}
            >
              {w}
            </div>
          ))}
        </div>

        {weeks.map((week) => (
          <div key={week[0].date} role="row" className="grid grid-cols-7 gap-px bg-slate-100">
            {week.map((c) => {
              const g = c.inMonth ? byDate.get(c.date) : undefined
              const selected = c.inMonth && c.date === selectedDate
              const isToday = c.date === todayStr && c.inMonth
              const dots = dotsFor(g)
              const tabbable = c.inMonth && c.date === focusDate
              const st = cellStyle({
                inMonth: c.inMonth,
                selected,
                hover: highlightType,
                incomeCount: g?.incomeCount ?? 0,
                expenseCount: g?.expenseCount ?? 0,
              })
              return (
                <div
                  key={c.date}
                  ref={(el) => {
                    if (el) cellRefs.current[c.date] = el
                  }}
                  role="gridcell"
                  tabIndex={tabbable ? 0 : -1}
                  aria-selected={c.inMonth ? selected : undefined}
                  aria-disabled={c.inMonth ? undefined : true}
                  aria-label={c.inMonth ? ariaLabel(c.date, g) : undefined}
                  aria-hidden={c.inMonth ? undefined : true}
                  title={c.inMonth ? titleText(g) : undefined}
                  onClick={c.inMonth ? () => select(c.date) : undefined}
                  onKeyDown={c.inMonth ? (e) => onKeyDown(e, c.date) : undefined}
                  onFocus={c.inMonth ? () => setFocusDate(c.date) : undefined}
                  className={`relative flex h-[4.5rem] min-w-0 flex-col items-start overflow-hidden p-1 text-left transition duration-150 *:transition-opacity *:duration-150 motion-reduce:transition-none motion-reduce:*:transition-none sm:h-[5.5rem] sm:p-1.5 lg:h-[6.5rem] ${st.cell} ${st.ring}`}
                >
                  <span
                    className={
                      isToday
                        ? 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gem-ink px-1 text-[11px] font-semibold text-white'
                        : `inline-flex h-5 items-center px-0.5 text-xs font-medium ${c.inMonth ? WEEKDAY_TEXT[c.weekday] ?? 'text-gem-ink' : 'text-slate-300'}`
                    }
                  >
                    {c.day}
                  </span>

                  {g && (
                    <span className="num mt-0.5 flex w-full min-w-0 flex-col text-[10px] leading-[14px] font-medium sm:text-[11px]">
                      {g.income > 0 && <span className="truncate text-income-ink">+{formatCompactKRW(g.income)}</span>}
                      {g.expense > 0 && <span className="truncate text-expense-ink">{MINUS}{formatCompactKRW(g.expense)}</span>}
                    </span>
                  )}

                  {/* 건수 점: 금액 아래, 칸 왼쪽 하단(날짜 숫자와 같은 왼쪽 선). 한 줄(wrap 없음), 장식이라 aria-hidden */}
                  {dots.types.length > 0 && (
                    <span aria-hidden="true" className="mt-auto flex w-full flex-nowrap items-center justify-start gap-[3px] pb-0.5 pl-0.5 sm:gap-1">
                      {dots.types.map((type, i) => (
                        <span key={i} className={`h-[5px] w-[5px] shrink-0 rounded-full sm:h-1.5 sm:w-1.5 ${DOT[type]}`} />
                      ))}
                      {dots.more > 0 && <span className="num shrink-0 text-[9px] leading-none text-ink-subtle">+{dots.more}</span>}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
