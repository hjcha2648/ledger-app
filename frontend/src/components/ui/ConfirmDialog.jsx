import Button from './Button'
import Icon from './Icon'
import Modal from './Modal'

export default function ConfirmDialog({
  title = '삭제 확인',
  message,
  confirmLabel = '삭제',
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <Icon name="trash" className="h-5 w-5" />
        </span>
        <p className="type-body pt-2 leading-relaxed">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          취소
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {loading ? '처리 중…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
