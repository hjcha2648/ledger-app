import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../api/transactions'
import PageHeader from '../components/layout/PageHeader'
import MonthPicker from '../components/MonthPicker'
import TransactionForm from '../components/TransactionForm'
import DataTable, { RowActions, RowIconButton, Td, TableCard, Tr } from '../components/DataTable'
import TypeBadge from '../components/TypeBadge'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import ErrorMessage from '../components/ui/ErrorMessage'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import useCategories from '../hooks/useCategories'
import { formatDate, formatKRW, formatSignedKRW, typeColorClass } from '../utils/format'
import { currentMonth } from '../utils/month'

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
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (등록) | transaction (수정)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

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

  const totals = useMemo(() => {
    const sum = (type) => transactions.filter((t) => t.type === type).reduce((s, t) => s + t.amount_krw, 0)
    return { income: sum('INCOME'), expense: sum('EXPENSE') }
  }, [transactions])

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader icon="transactions" title="거래 내역" subtitle="수입과 지출을 기록하고 관리해요" />
        <div className="flex items-center gap-3">
          <MonthPicker month={month} onChange={changeMonth} />
          <Button onClick={() => setEditing({})} disabled={cats.loading || Boolean(cats.error)}>
            + 거래 등록
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="chip">
          <span className="h-2 w-2 rounded-full bg-income" />
          수입 <strong className="num-strong text-income-ink">{formatKRW(totals.income)}</strong>
        </span>
        <span className="chip">
          <span className="h-2 w-2 rounded-full bg-expense" />
          지출 <strong className="num-strong text-expense-ink">{formatKRW(totals.expense)}</strong>
        </span>
        <span className="chip">
          <span className="h-2 w-2 rounded-full bg-gem-ink" />
          잔액 <strong className="num-strong">{formatKRW(totals.income - totals.expense)}</strong>
        </span>
      </div>

      <ErrorMessage message={cats.error} onRetry={cats.reload} />
      <ErrorMessage message={actionError} />

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
            {transactions.map((t) => (
              <Tr key={t.id}>
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

      {editing && (
        <Modal title={editing.id ? '거래 수정' : '거래 등록'} onClose={() => setEditing(null)}>
          <TransactionForm
            initial={editing.id ? editing : undefined}
            categories={cats.categories}
            onAddCategory={cats.addCategory}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        </Modal>
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
