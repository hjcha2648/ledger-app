import Icon from './ui/Icon'

// 거래·정기결제가 함께 쓰는 표 스타일. 데이터 로직은 각 페이지가 가진다.
// columns: [{ label, align?: 'right', srOnly?: boolean }]

export function TableCard({ children }) {
  // relative: sr-only(절대 위치) 요소가 스크롤 영역 밖으로 새어 페이지 가로 스크롤을 만들지 않도록 한다.
  return <div className="card relative overflow-x-auto">{children}</div>
}

export default function DataTable({ columns, children, minWidth = 'min-w-[640px]' }) {
  return (
    <table className={`w-full ${minWidth} text-left text-sm`}>
      <thead>
        <tr className="border-b border-line bg-slate-50/80 text-xs font-semibold tracking-wide text-ink-subtle">
          {columns.map((c) => (
            <th
              key={c.label}
              scope="col"
              className={`px-4 py-3 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}
            >
              {c.srOnly ? <span className="sr-only">{c.label}</span> : c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  )
}

// tone: 거래 페이지의 요약 칩 호버 연동용. 'income'|'expense' = 해당 색 배경으로 강조, 'dim' = 흐리게
const TR_TONE = { income: 'bg-income/10 hover:bg-income/15', expense: 'bg-expense/10 hover:bg-expense/15', dim: 'opacity-40' }

export function Tr({ children, tone }) {
  return <tr className={`transition duration-150 ${TR_TONE[tone] ?? 'hover:bg-slate-50/70'}`}>{children}</tr>
}

export function Td({ children, align, className = '' }) {
  return <td className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''} ${className}`}>{children}</td>
}

export function RowActions({ children }) {
  return <div className="flex justify-end gap-1">{children}</div>
}

// 평소에는 차분한 회색, 마우스를 올리거나 포커스하면 강조되는 아이콘 버튼
export function RowIconButton({ icon, label, tone = 'default', onClick }) {
  const hover = tone === 'danger' ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-100 hover:text-gem-ink'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`focus-ring flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle transition-colors duration-150 ${hover}`}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  )
}
