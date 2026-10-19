import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

// 모바일: 하단 시트(아래에서 올라옴), 데스크톱: 중앙 카드(fade + scale). 배경은 반투명 + 블러.
export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    // 모달이 열려 있는 동안 뒤 화면 스크롤 방지
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  // body 에 직접 그려, 페이지 전환 애니메이션이 만드는 쌓임 맥락(상단 바 아래로 깔림)에 갇히지 않게 한다.
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-panel max-h-[92vh] w-full overflow-y-auto rounded-t-sheet border border-line bg-white p-6 shadow-pop sm:max-w-md sm:rounded-sheet"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="type-heading text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle transition-colors duration-150 hover:bg-slate-100 hover:text-gem-ink"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
