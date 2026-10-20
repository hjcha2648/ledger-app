import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeReceipt } from '../api/receipts'
import { createTransaction } from '../api/transactions'
import { formatKRW } from '../utils/format'
import ThinkingDots from './chat/ThinkingDots'
import Button from './ui/Button'
import ErrorMessage from './ui/ErrorMessage'
import Icon from './ui/Icon'
import Modal from './ui/Modal'

const MAX_BYTES = 5 * 1024 * 1024 // API 계약: 5MB 이하
const ACCEPT = 'image/*,application/pdf' // 모바일은 카메라 촬영도 고를 수 있다
const FIELD = 'field h-9 py-1 text-sm'
const BAD = 'field-error'

const toRow = (it, i) => ({
  key: i,
  include: true,
  type: it.type,
  amount: it.amount_krw == null ? '' : String(it.amount_krw),
  occurred_on: it.occurred_on ?? '', // null → 빨간 표시, 사용자가 채워야 저장 가능
  category_id: it.category_id == null ? '' : String(it.category_id),
  merchant: it.merchant ?? '',
  memo: it.memo ?? '',
  status: 'idle', // 'idle' | 'saved' | 'failed'
  error: '',
})

// 저장 전 검증: 틀린 칸 이름을 돌려준다
function rowProblems(r) {
  const p = {}
  const amount = Number(r.amount)
  if (!r.amount || !Number.isInteger(amount) || amount < 1) p.amount = true
  if (!r.occurred_on) p.occurred_on = true
  if (!r.category_id) p.category_id = true
  return p
}

// 영수증·명세서 인식 (docs/api-contract.md 영수증 절): 파일 선택 → 분석 → 수정 가능한 초안 → 확인한 항목만 기존 POST /api/transactions 로 저장.
// 분석 결과는 입력 초안일 뿐이며 자동 저장하지 않고, 파일은 서버에 남지 않는다.
export default function ReceiptImportDialog({ categories, onClose, onSaved }) {
  const inputRef = useRef(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileError, setFileError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [rows, setRows] = useState(null) // null = 아직 분석 전
  const [warnings, setWarnings] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  const pickFile = (e) => {
    const f = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 change 가 일어나게
    if (!f) return
    setAnalyzeError('')
    if (f.size > MAX_BYTES) {
      setFile(null)
      setPreviewUrl('')
      setFileError('파일은 5MB 이하만 올릴 수 있습니다.')
      return
    }
    setFileError('')
    setFile(f)
    setPreviewUrl(f.type.startsWith('image/') ? URL.createObjectURL(f) : '')
  }

  const analyze = async () => {
    if (!file || analyzing) return
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const res = await analyzeReceipt(file)
      if (!alive.current) return
      setRows(res.items.map(toRow))
      setWarnings(res.warnings ?? [])
    } catch (err) {
      if (alive.current) setAnalyzeError(err.message)
    } finally {
      if (alive.current) setAnalyzing(false)
    }
  }

  const patch = (key, changes) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...changes } : r)))
  const changeType = (key, type) => patch(key, { type, category_id: '' }) // 유형이 바뀌면 카테고리는 다시 고른다

  const pending = useMemo(() => (rows ?? []).filter((r) => r.include && r.status !== 'saved'), [rows])
  const invalidCount = pending.filter((r) => Object.keys(rowProblems(r)).length > 0).length
  const savedCount = (rows ?? []).filter((r) => r.status === 'saved').length
  const allDone = rows && rows.length > 0 && rows.every((r) => r.status === 'saved' || !r.include) && savedCount > 0

  // 선택 항목 저장: 항목마다 createTransaction 을 순서대로 호출하고, 일부가 실패해도 나머지는 저장한다
  const saveSelected = async () => {
    if (saving || pending.length === 0 || invalidCount > 0) return
    setSaving(true)
    let saved = 0
    for (const r of pending) {
      try {
        await createTransaction({
          type: r.type,
          amount_krw: Number(r.amount),
          occurred_on: r.occurred_on,
          category_id: Number(r.category_id),
          merchant: r.merchant.trim() || null,
          memo: r.memo.trim() || null,
        })
        saved += 1
        if (alive.current) patch(r.key, { status: 'saved', error: '' })
      } catch (err) {
        if (alive.current) patch(r.key, { status: 'failed', error: err.message })
      }
    }
    if (saved > 0) onSaved?.() // 거래 목록 새로고침
    if (alive.current) setSaving(false)
  }

  const reset = () => {
    setRows(null)
    setWarnings([])
    setFile(null)
    setPreviewUrl('')
    setAnalyzeError('')
  }

  return (
    <Modal title="영수증으로 추가" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-ink-muted">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>AI 인식 결과는 틀릴 수 있어요. 저장 전에 꼭 확인하세요. 영수증 파일은 서버에 남지 않고, 확인한 항목만 거래로 저장돼요.</span>
        </p>

        {rows === null ? (
          <>
            <input ref={inputRef} type="file" accept={ACCEPT} onChange={pickFile} className="sr-only" tabIndex={-1} aria-label="영수증 파일 선택" />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={analyzing}
              className="focus-ring flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-8 text-center text-sm text-ink-muted transition-colors hover:border-accent hover:bg-accent-soft/40 disabled:opacity-50 motion-reduce:transition-none"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="선택한 영수증 미리보기" className="max-h-52 rounded-lg object-contain" />
              ) : (
                <Icon name="receipt" className="h-8 w-8" />
              )}
              <span className="font-medium text-gem-ink">{file ? file.name : '영수증·카드 명세서 사진 또는 PDF 선택'}</span>
              <span className="text-xs">{file ? '눌러서 다른 파일 선택' : 'JPEG·PNG·WEBP 이미지 또는 PDF, 5MB 이하'}</span>
            </button>
            {fileError && <ErrorMessage message={fileError} />}
            <ErrorMessage message={analyzeError} onRetry={file ? analyze : undefined} />
            {analyzing && (
              <div className="flex justify-center py-1">
                <ThinkingDots srText="영수증을 분석하는 중입니다" />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                닫기
              </Button>
              <Button onClick={analyze} loading={analyzing} disabled={!file}>
                분석하기
              </Button>
            </div>
          </>
        ) : (
          <>
            {warnings.length > 0 && (
              <ul className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}

            <ul className="space-y-3">
              {rows.map((r, idx) => {
                const bad = r.status === 'saved' ? {} : rowProblems(r)
                const locked = r.status === 'saved' || saving
                const typeCats = categories.filter((c) => c.type === r.type)
                return (
                  <li key={r.key} className={`rounded-2xl border p-4 ${r.status === 'saved' ? 'border-income/40 bg-income/5' : 'border-line'} ${!r.include ? 'opacity-60' : ''}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-gem-ink">
                        <input
                          type="checkbox"
                          checked={r.include}
                          disabled={locked}
                          onChange={(e) => patch(r.key, { include: e.target.checked })}
                          className="h-4 w-4 accent-[#0f9d58]"
                        />
                        저장할 항목 {idx + 1}
                        {Number(r.amount) > 0 && <span className="num font-normal text-ink-muted">· {formatKRW(Number(r.amount))}</span>}
                      </label>
                      {r.status === 'saved' && <span className="flex items-center gap-1 text-xs font-semibold text-income-ink"><Icon name="check" className="h-4 w-4" />저장됨</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <label className="text-xs text-ink-muted">
                        날짜
                        <input type="date" value={r.occurred_on} disabled={locked} onChange={(e) => patch(r.key, { occurred_on: e.target.value })} aria-invalid={bad.occurred_on || undefined} className={`${FIELD} mt-1 ${bad.occurred_on ? BAD : ''}`} />
                      </label>
                      <label className="text-xs text-ink-muted">
                        유형
                        <select value={r.type} disabled={locked} onChange={(e) => changeType(r.key, e.target.value)} className={`${FIELD} mt-1`}>
                          <option value="EXPENSE">지출</option>
                          <option value="INCOME">수입</option>
                        </select>
                      </label>
                      <label className="text-xs text-ink-muted">
                        금액(원)
                        <input type="number" inputMode="numeric" min="1" value={r.amount} disabled={locked} onChange={(e) => patch(r.key, { amount: e.target.value })} aria-invalid={bad.amount || undefined} className={`${FIELD} num mt-1 ${bad.amount ? BAD : ''}`} />
                      </label>
                      <label className="text-xs text-ink-muted">
                        카테고리
                        <select value={r.category_id} disabled={locked} onChange={(e) => patch(r.key, { category_id: e.target.value })} aria-invalid={bad.category_id || undefined} className={`${FIELD} mt-1 ${bad.category_id ? BAD : ''}`}>
                          <option value="">선택</option>
                          {typeCats.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-ink-muted">
                        사용처
                        <input type="text" maxLength={100} value={r.merchant} disabled={locked} onChange={(e) => patch(r.key, { merchant: e.target.value })} className={`${FIELD} mt-1`} />
                      </label>
                      <label className="text-xs text-ink-muted">
                        메모
                        <input type="text" maxLength={200} value={r.memo} disabled={locked} onChange={(e) => patch(r.key, { memo: e.target.value })} className={`${FIELD} mt-1`} />
                      </label>
                    </div>
                    {r.status === 'failed' && <p role="alert" className="mt-2 text-xs text-red-600">저장하지 못했어요: {r.error}</p>}
                  </li>
                )
              })}
            </ul>

            {invalidCount > 0 && !allDone && (
              <p role="alert" className="text-sm text-red-600">
                빨간 칸 {invalidCount}개 항목을 채워야 저장할 수 있어요. 저장하지 않을 항목은 체크를 풀어 주세요.
              </p>
            )}
            {allDone && <p role="status" className="text-sm font-medium text-income-ink">{savedCount}건을 저장했어요.</p>}

            <div className="flex flex-wrap justify-end gap-2">
              {!allDone && (
                <Button variant="ghost" onClick={reset} disabled={saving}>
                  다른 파일 선택
                </Button>
              )}
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                닫기
              </Button>
              {!allDone && (
                <Button onClick={saveSelected} loading={saving} disabled={pending.length === 0 || invalidCount > 0}>
                  선택 항목 저장{pending.length > 0 ? ` (${pending.length})` : ''}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
