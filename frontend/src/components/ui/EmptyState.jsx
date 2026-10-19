import Icon from './Icon'

export default function EmptyState({ message, icon = 'inbox' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-ink-subtle">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="text-sm text-ink-subtle">{message}</p>
    </div>
  )
}
