export default function Spinner({ label = '불러오는 중…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      {label}
    </div>
  )
}
