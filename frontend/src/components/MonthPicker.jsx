import { formatMonthLabel, shiftMonth } from '../utils/month'
import Button from './ui/Button'

export default function MonthPicker({ month, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="secondary" onClick={() => onChange(shiftMonth(month, -1))} aria-label="이전 달" className="!px-3">
        ‹
      </Button>
      <span className="min-w-28 text-center text-sm font-semibold">{formatMonthLabel(month)}</span>
      <Button variant="secondary" onClick={() => onChange(shiftMonth(month, 1))} aria-label="다음 달" className="!px-3">
        ›
      </Button>
    </div>
  )
}
