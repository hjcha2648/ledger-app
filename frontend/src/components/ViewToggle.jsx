import { useRef } from 'react'
import Icon from './ui/Icon'

const OPTIONS = [
  { value: 'table', label: '표 보기', icon: 'list' },
  { value: 'calendar', label: '캘린더 보기', icon: 'calendar' },
]

// 아이콘만 보이는 슬라이드 스위치: 하나의 알약형 indicator 가 선택된 칸으로 좌우 이동한다 (role=tablist).
// 두 칸의 폭이 같으므로 indicator 는 transform(translateX 0 → 100%)만으로 움직인다.
// 이름은 호버·키보드 포커스 때 글씨만(말풍선 없이) 즉시 나타난다. 선택은 클릭, 좌우 방향키, Home/End, Enter/Space.
// 초기 위치는 첫 렌더에 이미 정해져 있어 날아가는 깜빡임이 없다.
export default function ViewToggle({ value, onChange }) {
  const refs = useRef({})
  const selectedIndex = OPTIONS.findIndex((o) => o.value === value)

  const onKeyDown = (e) => {
    let next = null
    if (e.key === 'ArrowRight') next = OPTIONS[(selectedIndex + 1) % OPTIONS.length]
    else if (e.key === 'ArrowLeft') next = OPTIONS[(selectedIndex - 1 + OPTIONS.length) % OPTIONS.length]
    else if (e.key === 'Home') next = OPTIONS[0]
    else if (e.key === 'End') next = OPTIONS[OPTIONS.length - 1]
    if (!next) return
    e.preventDefault()
    onChange(next.value)
    refs.current[next.value]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="거래 보기 방식"
      onKeyDown={onKeyDown}
      className="relative inline-grid shrink-0 grid-cols-2 rounded-full border border-line bg-white p-0.5 shadow-soft"
    >
      <span
        aria-hidden="true"
        className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/2)] rounded-full bg-accent-soft shadow-soft transition-transform duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(${selectedIndex * 100}%)` }}
      />
      {OPTIONS.map((o, i) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[o.value] = el
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={o.label}
            title={o.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`focus-ring group relative z-10 inline-flex h-10 w-[2.625rem] items-center justify-center rounded-full transition-colors duration-[220ms] ease-out motion-reduce:transition-none sm:h-9 ${
              selected ? 'text-accent-ink' : 'text-ink-muted hover:text-gem-ink'
            }`}
          >
            <Icon name={o.icon} className="h-[18px] w-[18px]" />
            {/* 이름: 글씨만, 아이콘 아래 absolute(레이아웃을 밀지 않음). 첫 칸은 왼쪽 맞춤, 둘째 칸은 오른쪽 맞춤이라 화면 밖으로 잘리지 않는다 */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-full z-20 mt-1 text-xs font-medium whitespace-nowrap text-slate-700 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none ${
                i === 0 ? 'left-0' : 'right-0'
              }`}
            >
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
