export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <p className="whitespace-pre-line">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
          다시 시도
        </button>
      )}
    </div>
  )
}
