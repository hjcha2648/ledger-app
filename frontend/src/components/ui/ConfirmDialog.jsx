import Button from './Button'
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
      <p className="text-sm text-gray-600">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          취소
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>
          {loading ? '처리 중…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
