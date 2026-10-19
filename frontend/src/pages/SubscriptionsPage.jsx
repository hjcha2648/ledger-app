import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSubscription, deleteSubscription, listSubscriptions } from '../api/subscriptions'
import PageHeader from '../components/layout/PageHeader'
import SubscriptionForm from '../components/SubscriptionForm'
import DataTable, { RowActions, RowIconButton, Td, TableCard, Tr } from '../components/DataTable'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import ErrorMessage from '../components/ui/ErrorMessage'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import useCategories from '../hooks/useCategories'
import { CYCLE_LABEL, formatDate, formatKRW } from '../utils/format'

const COLUMNS = [
  { label: '서비스명' },
  { label: '금액', align: 'right' },
  { label: '주기' },
  { label: '결제 기준일' },
  { label: '카테고리' },
  { label: '메모' },
  { label: '작업', srOnly: true },
]

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader icon="subscriptions" title="정기결제" subtitle="구독 서비스를 목록으로 관리해요" />
        <Button onClick={() => setCreating(true)} disabled={cats.loading || Boolean(cats.error)}>
          + 정기결제 등록
        </Button>
      </div>

      <div className="flex gap-3 rounded-2xl border border-accent/15 bg-accent-soft/60 px-4 py-3 text-sm text-gem-ink">
        <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
        <p>
          참고용 목록입니다. 거래 내역이나 대시보드 통계에는 자동으로 반영되지 않습니다. 실제 결제는 거래 내역에서
          직접 입력해 주세요.
        </p>
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
        ) : subs.length === 0 ? (
          <EmptyState message="등록된 정기결제가 없습니다." />
        ) : (
          <DataTable columns={COLUMNS}>
            {subs.map((s) => (
              <Tr key={s.id}>
                <Td className="font-medium">{s.name}</Td>
                <Td align="right" className="num-strong whitespace-nowrap">
                  {formatKRW(s.amount_krw)}
                </Td>
                <Td>
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                    {CYCLE_LABEL[s.billing_cycle]}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-ink-muted">{formatDate(s.billing_anchor_date)}</Td>
                <Td>{s.category_name ?? categoryName.get(s.category_id) ?? '-'}</Td>
                <Td className="max-w-48 truncate text-ink-muted">{s.memo || '-'}</Td>
                <Td align="right" className="whitespace-nowrap">
                  <RowActions>
                    <RowIconButton icon="trash" label="정기결제 삭제" tone="danger" onClick={() => setDeleting(s)} />
                  </RowActions>
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </TableCard>

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
