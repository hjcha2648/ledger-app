export default function Spinner({ label = '불러오는 중…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-ink-subtle" role="status">
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-accent motion-reduce:animate-none" />
      {label}
    </div>
  )
}
