import { TYPE_LABEL } from '../utils/format'

// 수입/지출 라벨 칩 (색 + 글자로 함께 구분)
export default function TypeBadge({ type }) {
  const tone = type === 'INCOME' ? 'bg-income/10 text-income-ink' : 'bg-expense/10 text-expense-ink'
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{TYPE_LABEL[type]}</span>
}
