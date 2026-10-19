import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../api/transactions'
import MonthPicker from '../components/MonthPicker'
import TransactionForm from '../components/TransactionForm'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import ErrorMessage from '../components/ui/ErrorMessage'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import useCategories from '../hooks/useCategories'
import { TYPE_LABEL, formatDate, formatKRW, formatSignedKRW, typeColorClass } from '../utils/format'
import { currentMonth } from '../utils/month'

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">거래 내역</h1>
        <div className="flex items-center gap-3">
          <MonthPicker month={month} onChange={changeMonth} />
          <Button onClick={() => setEditing({})} disabled={cats.loading || Boolean(cats.error)}>
            + 거래 등록
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
        <span>
          수입 <strong className="text-green-600">{formatKRW(totals.income)}</strong>
        </span>
        <span>
          지출 <strong className="text-red-600">{formatKRW(totals.expense)}</strong>
        </span>
        <span>
          잔액 <strong>{formatKRW(totals.income - totals.expense)}</strong>
        </span>
      </div>

      <ErrorMessage message={cats.error} onRetry={cats.reload} />
      <ErrorMessage message={actionError} />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorMessage message={error} onRetry={reload} />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState message="이 달에 등록된 거래가 없습니다." />
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">날짜</th>
                <th className="px-4 py-2 font-medium">유형</th>
                <th className="px-4 py-2 font-medium">카테고리</th>
                <th className="px-4 py-2 font-medium">사용처</th>
                <th className="px-4 py-2 font-medium">메모</th>
                <th className="px-4 py-2 text-right font-medium">금액</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{formatDate(t.occurred_on)}</td>
                  <td className="px-4 py-2.5">{TYPE_LABEL[t.type]}</td>
                  <td className="px-4 py-2.5">{categoryName.get(t.category_id) ?? '-'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{t.merchant || '-'}</td>
                  <td className="max-w-48 truncate px-4 py-2.5 text-gray-600">{t.memo || '-'}</td>
                  <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold ${typeColorClass(t.type)}`}>
                    {formatSignedKRW(t.type, t.amount_krw)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <Button variant="ghost" className="!px-2 !py-1" onClick={() => setEditing(t)}>
                      수정
                    </Button>
                    <Button variant="ghost" className="!px-2 !py-1" onClick={() => setDeleting(t)}>
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
