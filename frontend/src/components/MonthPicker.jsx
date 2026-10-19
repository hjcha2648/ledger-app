import { formatMonthLabel, shiftMonth } from '../utils/month'
import Icon from './ui/Icon'

const ARROW =
  'focus-ring flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-slate-100 hover:text-gem-ink active:scale-95'

// 알약형 컨테이너: [‹] 2026년 10월 [›]
export default function MonthPicker({ month, onChange }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white p-1 shadow-soft">
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} aria-label="이전 달" className={ARROW}>
        <Icon name="chevronLeft" className="h-5 w-5" />
      </button>
      <span className="num-strong min-w-28 text-center text-sm" aria-live="polite">
        {formatMonthLabel(month)}
      </span>
      <button type="button" onClick={() => onChange(shiftMonth(month, 1))} aria-label="다음 달" className={ARROW}>
        <Icon name="chevronRight" className="h-5 w-5" />
      </button>
    </div>
  )
}
