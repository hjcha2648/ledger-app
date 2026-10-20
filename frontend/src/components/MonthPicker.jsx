import { formatMonthLabel, shiftMonth } from '../utils/month'
import Icon from './ui/Icon'

const ARROW =
  'focus-ring flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-slate-100 hover:text-gem-ink active:scale-95'

// 알약형 컨테이너: [‹] 2026년 10월 [›]. compact: 더 작은 알약 칩 (챗봇 헤더 등)
export default function MonthPicker({ month, onChange, compact = false }) {
  const arrow = compact ? ARROW.replace('h-8 w-8', 'h-7 w-7') : ARROW
  const icon = compact ? 'h-4 w-4' : 'h-5 w-5'
  return (
    <div className={`inline-flex items-center rounded-full border border-line bg-white shadow-soft ${compact ? 'p-0.5' : 'p-1'}`}>
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} aria-label="이전 달" className={arrow}>
        <Icon name="chevronLeft" className={icon} />
      </button>
      <span className={`num-strong text-center ${compact ? 'min-w-24 text-xs' : 'min-w-28 text-sm'}`} aria-live="polite">
        {formatMonthLabel(month)}
      </span>
      <button type="button" onClick={() => onChange(shiftMonth(month, 1))} aria-label="다음 달" className={arrow}>
        <Icon name="chevronRight" className={icon} />
      </button>
    </div>
  )
}
