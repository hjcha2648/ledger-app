import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSubscription, deleteSubscription, listSubscriptions } from '../api/subscriptions'
import SubscriptionForm from '../components/SubscriptionForm'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import ErrorMessage from '../components/ui/ErrorMessage'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import useCategories from '../hooks/useCategories'
import { CYCLE_LABEL, formatDate, formatKRW } from '../utils/format'

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const cats = useCategories()
  const expenseCategories = useMemo(() => cats.categories.filter((c) => c.type === 'EXPENSE'), [cats.categories])
  const categoryName = useMemo(() => new Map(cats.categories.map((c) => [c.id, c.name])), [cats.categories])

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    setReloadKey((k) => k + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    listSubscriptions()
      .then((data) => !cancelled && setSubs(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const handleCreate = async (payload) => {
    await createSubscription(payload)
    setCreating(false)
    reload()
  }

  const handleDelete = async () => {
    setDeleteBusy(true)
    setActionError('')
    try {
      await deleteSubscription(deleting.id)
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
        <h1 className="text-xl font-semibold">정기결제</h1>
        <Button onClick={() => setCreating(true)} disabled={cats.loading || Boolean(cats.error)}>
          + 정기결제 등록
        </Button>
      </div>

      <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        참고용 목록입니다. 가계부 거래나 대시보드 통계에는 자동으로 반영되지 않습니다. 실제 결제는 거래 내역에서
        직접 입력해 주세요.
      </p>

      <ErrorMessage message={cats.error} onRetry={cats.reload} />
      <ErrorMessage message={actionError} />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorMessage message={error} onRetry={reload} />
          </div>
        ) : subs.length === 0 ? (
          <EmptyState message="등록된 정기결제가 없습니다." />
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">서비스명</th>
                <th className="px-4 py-2 text-right font-medium">금액</th>
                <th className="px-4 py-2 font-medium">주기</th>
                <th className="px-4 py-2 font-medium">결제 기준일</th>
                <th className="px-4 py-2 font-medium">카테고리</th>
                <th className="px-4 py-2 font-medium">메모</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subs.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">{formatKRW(s.amount_krw)}</td>
                  <td className="px-4 py-2.5">{CYCLE_LABEL[s.billing_cycle]}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{formatDate(s.billing_anchor_date)}</td>
                  <td className="px-4 py-2.5">{categoryName.get(s.category_id) ?? '-'}</td>
                  <td className="max-w-48 truncate px-4 py-2.5 text-gray-600">{s.memo || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <Button variant="ghost" className="!px-2 !py-1" onClick={() => setDeleting(s)}>
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <Modal title="정기결제 등록" onClose={() => setCreating(false)}>
          <SubscriptionForm
            categories={expenseCategories}
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          message={`'${deleting.name}' 정기결제를 목록에서 삭제할까요? 기존 거래 내역에는 영향이 없습니다.`}
          loading={deleteBusy}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
