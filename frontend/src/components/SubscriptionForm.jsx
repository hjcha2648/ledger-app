import { useState } from 'react'
import { fieldErrorsFrom } from '../utils/formErrors'
import { CYCLE_LABEL } from '../utils/format'
import { today } from '../utils/month'
import Button from './ui/Button'
import ErrorMessage from './ui/ErrorMessage'
import Input from './ui/Input'
import Select from './ui/Select'

const CYCLE_OPTIONS = Object.entries(CYCLE_LABEL).map(([value, label]) => ({ value, label }))

// 등록 전용 폼 (정기결제 수정 기능은 없다)
// categories: 지출 카테고리만 전달
export default function SubscriptionForm({ categories, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    amount: '',
    billing_cycle: 'MONTHLY',
    billing_anchor_date: today(),
    category_id: String(categories.find((c) => c.name === '구독·정기결제')?.id ?? ''),
    memo: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const errors = {}
    const amount = Number(form.amount)
    if (!form.name.trim()) errors.name = '서비스명을 입력해 주세요.'
    if (!form.amount || !Number.isInteger(amount) || amount < 1) errors.amount = '1원 이상의 정수를 입력해 주세요.'
    if (!form.billing_anchor_date) errors.billing_anchor_date = '결제 기준일을 선택해 주세요.'
    if (!form.category_id) errors.category_id = '카테고리를 선택해 주세요.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    try {
      await onSubmit({
        name: form.name.trim(),
        amount_krw: amount,
        billing_cycle: form.billing_cycle,
        billing_anchor_date: form.billing_anchor_date,
        category_id: Number(form.category_id),
        memo: form.memo.trim() || null,
      })
    } catch (err) {
      setFieldErrors(fieldErrorsFrom(err, { amount_krw: 'amount' }))
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Input
        label="서비스명"
        name="name"
        value={form.name}
        onChange={onChange}
        error={fieldErrors.name}
        maxLength={120}
        placeholder="예: 넷플릭스"
        autoFocus
      />
      <Input
        label="결제 금액 (원)"
        name="amount"
        type="number"
        inputMode="numeric"
        min="1"
        step="1"
        value={form.amount}
        onChange={onChange}
        error={fieldErrors.amount}
      />
      <div className="grid grid-cols-2 gap-3">
        <Select label="결제 주기" name="billing_cycle" value={form.billing_cycle} onChange={onChange} options={CYCLE_OPTIONS} />
        <Input
          label="결제 기준일"
          name="billing_anchor_date"
          type="date"
          value={form.billing_anchor_date}
          onChange={onChange}
          error={fieldErrors.billing_anchor_date}
        />
      </div>
      <Select
        label="지출 카테고리"
        name="category_id"
        value={form.category_id}
        onChange={onChange}
        error={fieldErrors.category_id}
        options={[
          { value: '', label: '카테고리 선택' },
          ...categories.map((c) => ({ value: String(c.id), label: c.name })),
        ]}
      />
      <Input label="메모 (선택)" name="memo" value={form.memo} onChange={onChange} maxLength={500} />

      <ErrorMessage message={error} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          취소
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? '저장 중…' : '등록'}
        </Button>
      </div>
    </form>
  )
}
