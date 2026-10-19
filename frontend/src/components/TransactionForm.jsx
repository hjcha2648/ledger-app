import { useState } from 'react'
import { today } from '../utils/month'
import { TYPE_LABEL } from '../utils/format'
import Button from './ui/Button'
import ErrorMessage from './ui/ErrorMessage'
import Input from './ui/Input'
import Select from './ui/Select'

// initial: 수정 시 기존 거래, 등록 시 undefined
// onSubmit(payload): Promise — 실패하면 throw
// onAddCategory({name, type}): Promise<category>
export default function TransactionForm({ initial, categories, onSubmit, onAddCategory, onCancel }) {
  const [form, setForm] = useState({
    type: initial?.type ?? 'EXPENSE',
    amount: initial ? String(initial.amount_krw) : '',
    occurred_on: initial?.occurred_on ?? today(),
    category_id: initial ? String(initial.category_id) : '',
    merchant: initial?.merchant ?? '',
    memo: initial?.memo ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState(null) // null=숨김, string=입력 중
  const [categoryError, setCategoryError] = useState('')

  const typeCategories = categories.filter((c) => c.type === form.type)
  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }))
  const onChange = (e) => set(e.target.name, e.target.value)

  const changeType = (type) => {
    // 유형이 바뀌면 기존 카테고리는 유효하지 않으므로 초기화
    setForm((f) => ({ ...f, type, category_id: '' }))
    setNewCategory(null)
  }

  const addCategory = async () => {
    const name = newCategory.trim()
    if (!name) {
      setCategoryError('카테고리 이름을 입력해 주세요.')
      return
    }
    setCategoryError('')
    try {
      const created = await onAddCategory({ name, type: form.type })
      set('category_id', String(created.id))
      setNewCategory(null)
    } catch (err) {
      setCategoryError(err.message)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const errors = {}
    const amount = Number(form.amount)
    if (!form.amount || !Number.isInteger(amount) || amount < 1) errors.amount = '1원 이상의 정수를 입력해 주세요.'
    if (!form.occurred_on) errors.occurred_on = '거래일을 선택해 주세요.'
    if (!form.category_id) errors.category_id = '카테고리를 선택해 주세요.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    try {
      await onSubmit({
        type: form.type,
        amount_krw: amount,
        occurred_on: form.occurred_on,
        category_id: Number(form.category_id),
        merchant: form.merchant.trim() || null,
        memo: form.memo.trim() || null,
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <span className="mb-1 block text-sm font-medium text-gray-700">유형</span>
        <div className="grid grid-cols-2 gap-2">
          {['EXPENSE', 'INCOME'].map((t) => {
            const active = form.type === t
            const activeClass = t === 'INCOME' ? 'border-green-600 bg-green-50 text-green-700' : 'border-red-600 bg-red-50 text-red-700'
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => changeType(t)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${active ? activeClass : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'}`}
              >
                {TYPE_LABEL[t]}
              </button>
            )
          })}
        </div>
      </div>

      <Input
        label="금액 (원)"
        name="amount"
        type="number"
        inputMode="numeric"
        min="1"
        step="1"
        value={form.amount}
        onChange={onChange}
        error={fieldErrors.amount}
        autoFocus
      />
      <Input
        label="거래일"
        name="occurred_on"
        type="date"
        value={form.occurred_on}
        onChange={onChange}
        error={fieldErrors.occurred_on}
      />

      <div>
        <Select
          label="카테고리"
          name="category_id"
          value={form.category_id}
          onChange={onChange}
          error={fieldErrors.category_id}
          options={[
            { value: '', label: '카테고리 선택' },
            ...typeCategories.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
        />
        {newCategory === null ? (
          <button
            type="button"
            onClick={() => setNewCategory('')}
            className="mt-1 text-xs font-medium text-gray-600 underline hover:text-gray-900"
          >
            + 새 {TYPE_LABEL[form.type]} 카테고리 추가
          </button>
        ) : (
          <div className="mt-2">
            <div className="flex gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCategory()
                  }
                }}
                maxLength={30}
                placeholder="카테고리 이름"
                aria-label="새 카테고리 이름"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <Button variant="secondary" onClick={addCategory}>
                추가
              </Button>
              <Button variant="ghost" onClick={() => setNewCategory(null)}>
                취소
              </Button>
            </div>
            {categoryError && <p className="mt-1 text-xs text-red-600">{categoryError}</p>}
          </div>
        )}
      </div>

      <Input label="사용처 (선택)" name="merchant" value={form.merchant} onChange={onChange} maxLength={100} />
      <Input label="메모 (선택)" name="memo" value={form.memo} onChange={onChange} maxLength={500} />

      <ErrorMessage message={error} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          취소
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? '저장 중…' : initial ? '수정' : '등록'}
        </Button>
      </div>
    </form>
  )
}
