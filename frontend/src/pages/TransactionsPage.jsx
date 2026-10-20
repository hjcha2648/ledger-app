import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../api/transactions'
import PageHeader from '../components/layout/PageHeader'
import DayDetail from '../components/DayDetail'
import MonthPicker from '../components/MonthPicker'
import ReceiptImportDialog from '../components/ReceiptImportDialog'
import TransactionCalendar from '../components/TransactionCalendar'
import TransactionForm from '../components/TransactionForm'
import DataTable, { RowActions, RowIconButton, Td, TableCard, Tr } from '../components/DataTable'
import TypeBadge from '../components/TypeBadge'
import ViewToggle from '../components/ViewToggle'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import ErrorMessage from '../components/ui/ErrorMessage'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import useCategories from '../hooks/useCategories'
import useMediaQuery from '../hooks/useMediaQuery'
import { groupByDate } from '../utils/calendar'
import { formatDate, formatKRW, formatSignedKRW, typeColorClass } from '../utils/format'
import { currentMonth, formatDayLabel, today } from '../utils/month'

const COLUMNS = [
  { label: '날짜' },
  { label: '유형' },
  { label: '카테고리' },
  { label: '사용처' },
  { label: '메모' },
  { label: '금액', align: 'right' },
  { label: '작업', srOnly: true },
]

export default function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth)
  // 보기 방식은 URL 쿼리(?view=calendar)로 유지한다. 쿼리가 없으면 표.
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'calendar' ? 'calendar' : 'table'
  const setView = (v) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (v === 'calendar') next.set('view', 'calendar')
      else next.delete('view')
      return next
    })
  const [selectedDate, setSelectedDate] = useState(null) // 캘린더에서 고른 날짜 (null = 기본 날짜)
  const [sheetOpen, setSheetOpen] = useState(false) // 모바일 하단 시트(날짜 상세)
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (등록) | transaction (수정)
  const [receiptOpen, setReceiptOpen] = useState(false) // 영수증으로 추가 모달
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [catFilter, setCatFilter] = useState(null) // 카테고리 보기: 선택한 category_id (null = 전체)
  const [chipFocus, setChipFocus] = useState(null) // 요약 칩 호버·포커스: 'INCOME' | 'EXPENSE' | null

  const cats = useCategories()
  // 로딩 표시는 effect가 아닌 이벤트 시점에 켠다 (effect 안 동기 setState 방지)
  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    setReloadKey((k) => k + 1)
  }, [])
  const changeMonth = (m) => {
    setLoading(true)
    setError('')
    setMonth(m)
    setSelectedDate(null) // 월을 바꾸면 선택 날짜 초기화
    setSheetOpen(false)
  }

  useEffect(() => {
    let cancelled = false
    listTransactions(month)
      .then((data) => !cancelled && setTransactions(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [month, reloadKey])

  const categoryName = useMemo(() => new Map(cats.categories.map((c) => [c.id, c.name])), [cats.categories])

  // 카테고리 보기: 이미 불러온 그 달 거래를 프론트에서 걸러 보여준다 (API·백엔드 변경 없음)
  const categoryOptions = useMemo(() => {
    const byId = new Map()
    transactions.forEach((t) => {
      const name = t.category_name ?? categoryName.get(t.category_id) ?? '-'
      const o = byId.get(t.category_id) ?? { id: t.category_id, name, count: 0 }
      o.count += 1
      byId.set(t.category_id, o)
    })
    return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))
  }, [transactions, categoryName])
  // 월을 바꾸거나 거래를 지워 선택한 카테고리가 목록에 없어지면 자동으로 전체로 본다
  const activeCat = categoryOptions.some((c) => c.id === catFilter) ? catFilter : null
  const visible = useMemo(
    () => (activeCat == null ? transactions : transactions.filter((t) => t.category_id === activeCat)),
    [transactions, activeCat],
  )

  // 캘린더: 이미 받은 월 거래를 날짜별로 묶는다. 선택 날짜가 없으면 오늘(해당 월이면) 또는 그 달 1일.
  const byDate = useMemo(() => groupByDate(visible), [visible])
  const effectiveDate = selectedDate?.startsWith(month) ? selectedDate : today().startsWith(month) ? today() : `${month}-01`
  const categoryLabel = (t) => t.category_name ?? categoryName.get(t.category_id) ?? '-'
  const selectDate = (date) => {
    setSelectedDate(date)
    if (!isDesktop) setSheetOpen(true)
  }
  // 날짜 상세에서의 수정·삭제·등록: 모바일 시트를 닫고 기존 모달을 연다
  const detailActions = {
    onEdit: (t) => {
      setSheetOpen(false)
      setEditing(t)
    },
    onDelete: (t) => {
      setSheetOpen(false)
      setDeleting(t)
    },
    onCreate: (date) => {
      setSheetOpen(false)
      setEditing({ initialDate: date })
    },
  }

  const totals = useMemo(() => {
    const sum = (type) => visible.filter((t) => t.type === type).reduce((s, t) => s + t.amount_krw, 0)
    return { income: sum('INCOME'), expense: sum('EXPENSE') }
  }, [visible])

  // 수입·지출 칩을 가리키면 해당 거래를 유형 색(수입 초록·지출 빨강)으로 강조하고 나머지는 흐리게 (잔액 칩은 해당 없음)
  const rowTone = (t) => {
    if (!chipFocus) return undefined
    if (chipFocus === t.type) return t.type === 'INCOME' ? 'income' : 'expense'
    return 'dim'
  }
  // 캘린더 보기에서 칩을 가리키면 칩도 같은 색 계열로 살짝 강조한다 (표 보기·잔액 칩은 그대로)
  const chipTone = (key) =>
    view === 'calendar' && chipFocus === key
      ? key === 'INCOME'
        ? 'border-income/40 bg-income/10'
        : 'border-expense/40 bg-expense/10'
      : ''
  const chipProps = (key) => ({
    tabIndex: 0,
    onMouseEnter: () => setChipFocus(key),
    onMouseLeave: () => setChipFocus(null),
    onFocus: () => setChipFocus(key),
    onBlur: () => setChipFocus(null),
  })

  const handleSubmit = async (payload) => {
    if (editing?.id) await updateTransaction(editing.id, payload)
    else await createTransaction(payload)
    setEditing(null)
    reload()
  }

  const handleDelete = async () => {
    setDeleteBusy(true)
    setActionError('')
    try {
      await deleteTransaction(deleting.id)
      setDeleting(null)
      reload()
    } catch (err) {
      setDeleting(null)
      setActionError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 헤더: 왼쪽 [제목 블록], 오른쪽 [월 선택기, 카테고리 선택, 보기 스위치]. 좁아지면 줄바꿈 */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <PageHeader icon="transactions" title="거래 내역" subtitle="수입과 지출을 기록하고 관리해요" />
        <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto lg:justify-end">
          <MonthPicker month={month} onChange={changeMonth} />
          {!loading && !error && categoryOptions.length > 0 && (
            <Select
              aria-label="카테고리별 보기"
              className="w-full sm:w-auto"
              fieldClassName="h-[2.625rem] min-w-[10.5rem] rounded-full pr-10 pl-4 whitespace-nowrap focus:border-slate-400 focus:bg-white focus:ring-0"
              value={activeCat == null ? '' : String(activeCat)}
              onChange={(e) => setCatFilter(e.target.value === '' ? null : Number(e.target.value))}
              options={[
                { value: '', label: '전체 카테고리' },
                ...categoryOptions.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
            />
          )}
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {/* 합계 칩(왼쪽) + [영수증으로 추가][+ 거래 등록](오른쪽 끝, 같은 높이). 좁아지면 줄바꿈 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip focus-ring transition-colors duration-150 motion-reduce:transition-none ${chipTone('INCOME')}`} {...chipProps('INCOME')}>
          <span className="h-2 w-2 rounded-full bg-income" />
          수입 <strong className="num-strong text-income-ink">{formatKRW(totals.income)}</strong>
        </span>
        <span className={`chip focus-ring transition-colors duration-150 motion-reduce:transition-none ${chipTone('EXPENSE')}`} {...chipProps('EXPENSE')}>
          <span className="h-2 w-2 rounded-full bg-expense" />
          지출 <strong className="num-strong text-expense-ink">{formatKRW(totals.expense)}</strong>
        </span>
        <span className="chip">
          <span className="h-2 w-2 rounded-full bg-gem-ink" />
          잔액 <strong className="num-strong">{formatKRW(totals.income - totals.expense)}</strong>
        </span>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
          <Button variant="secondary" className="h-10 sm:h-9" onClick={() => setReceiptOpen(true)} disabled={cats.loading || Boolean(cats.error)}>
            <Icon name="receipt" className="h-4 w-4" />
            영수증으로 추가
          </Button>
          <Button className="h-10 flex-1 sm:h-9 sm:flex-none" onClick={() => setEditing({})} disabled={cats.loading || Boolean(cats.error)}>
            + 거래 등록
          </Button>
        </div>
      </div>

      <ErrorMessage message={cats.error} onRetry={cats.reload} />
      <ErrorMessage message={actionError} />

      {view === 'calendar' ? (
        loading ? (
          <div className="card">
            <Spinner />
          </div>
        ) : error ? (
          <div className="card p-4">
            <ErrorMessage message={error} onRetry={reload} />
          </div>
        ) : (
          <div className="space-y-5">
            <TransactionCalendar
              month={month}
              byDate={byDate}
              selectedDate={effectiveDate}
              onSelectDate={selectDate}
              highlightType={chipFocus}
            />
            {isDesktop && (
              <section className="card p-5" aria-label="선택한 날짜의 거래">
                <DayDetail date={effectiveDate} group={byDate.get(effectiveDate)} categoryLabel={categoryLabel} {...detailActions} />
              </section>
            )}
          </div>
        )
      ) : (
        <TableCard>
          {loading ? (
            <Spinner />
          ) : error ? (
            <div className="p-4">
              <ErrorMessage message={error} onRetry={reload} />
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState message="이 달에 등록된 거래가 없습니다." />
          ) : (
            <DataTable columns={COLUMNS}>
              {visible.map((t) => (
                <Tr key={t.id} tone={rowTone(t)}>
                  <Td className="whitespace-nowrap text-ink-muted">{formatDate(t.occurred_on)}</Td>
                  <Td>
                    <TypeBadge type={t.type} />
                  </Td>
                  <Td>{t.category_name ?? categoryName.get(t.category_id) ?? '-'}</Td>
                  <Td className="text-ink-muted">{t.merchant || '-'}</Td>
                  <Td className="max-w-48 truncate text-ink-muted">{t.memo || '-'}</Td>
                  <Td align="right" className={`num-strong whitespace-nowrap ${typeColorClass(t.type)}`}>
                    {formatSignedKRW(t.type, t.amount_krw)}
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    <RowActions>
                      <RowIconButton icon="edit" label="거래 수정" onClick={() => setEditing(t)} />
                      <RowIconButton icon="trash" label="거래 삭제" tone="danger" onClick={() => setDeleting(t)} />
                    </RowActions>
                  </Td>
                </Tr>
              ))}
            </DataTable>
          )}
        </TableCard>
      )}

      {!isDesktop && sheetOpen && view === 'calendar' && (
        <Modal title={formatDayLabel(effectiveDate)} onClose={() => setSheetOpen(false)}>
          <DayDetail
            date={effectiveDate}
            group={byDate.get(effectiveDate)}
            categoryLabel={categoryLabel}
            showTitle={false}
            {...detailActions}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={editing.id ? '거래 수정' : '거래 등록'} onClose={() => setEditing(null)}>
          <TransactionForm
            initial={editing.id ? editing : undefined}
            initialDate={editing.id ? undefined : editing.initialDate}
            categories={cats.categories}
            onAddCategory={cats.addCategory}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {receiptOpen && (
        <ReceiptImportDialog categories={cats.categories} onClose={() => setReceiptOpen(false)} onSaved={reload} />
      )}

      {deleting && (
        <ConfirmDialog
          message={`${formatDate(deleting.occurred_on)} ${formatSignedKRW(deleting.type, deleting.amount_krw)} 거래를 삭제할까요? 되돌릴 수 없습니다.`}
          loading={deleteBusy}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
