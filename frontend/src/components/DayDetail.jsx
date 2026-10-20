import { RowActions, RowIconButton } from './DataTable'
import Button from './ui/Button'
import EmptyState from './ui/EmptyState'
import { formatDayLabel } from '../utils/month'
import { formatKRW, formatSignedKRW, typeColorClass } from '../utils/format'

// 선택한 날짜의 거래 목록 (캘린더 아래 카드 또는 모바일 하단 시트 안에서 쓴다).
// 수정·삭제·등록 동작은 부모(TransactionsPage)의 핸들러를 그대로 받는다.
// group: groupByDate() 항목(없으면 거래 없는 날), showTitle: 시트 안에서는 제목이 모달 제목과 겹치므로 끈다
export default function DayDetail({ date, group, categoryLabel, onEdit, onDelete, onCreate, showTitle = true }) {
  const createButton = (
    <Button variant="soft" onClick={() => onCreate(date)}>
      + 이 날짜로 등록
    </Button>
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {showTitle && <h2 className="type-heading">{formatDayLabel(date)}</h2>}
          {group && (
            <p className="num mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-muted">
              {group.income > 0 && <span>수입 <strong className="num-strong text-income-ink">{formatKRW(group.income)}</strong></span>}
              {group.expense > 0 && <span>지출 <strong className="num-strong text-expense-ink">{formatKRW(group.expense)}</strong></span>}
            </p>
          )}
        </div>
        {group && createButton}
      </div>

      {group ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {group.items.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gem-ink">{categoryLabel(t)}</p>
                <p className="type-caption truncate">{[t.merchant, t.memo].filter(Boolean).join(' · ') || '-'}</p>
              </div>
              <span className={`num-strong shrink-0 text-sm ${typeColorClass(t.type)}`}>{formatSignedKRW(t.type, t.amount_krw)}</span>
              <RowActions>
                <RowIconButton icon="edit" label="거래 수정" onClick={() => onEdit(t)} />
                <RowIconButton icon="trash" label="거래 삭제" tone="danger" onClick={() => onDelete(t)} />
              </RowActions>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center">
          <EmptyState message="이 날은 거래가 없어요" />
          <div className="-mt-6 pb-2">{createButton}</div>
        </div>
      )}
    </div>
  )
}
