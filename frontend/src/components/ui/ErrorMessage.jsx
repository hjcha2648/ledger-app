import Icon from './Icon'

export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      <div>
        <p className="whitespace-pre-line">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="focus-ring mt-1.5 rounded font-semibold text-red-700 underline-offset-2 hover:underline"
          >
            다시 시도
          </button>
        )}
      </div>
    </div>
  )
}
