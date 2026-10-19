const BASE =
  'focus-ring inline-flex select-none items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100'

const VARIANTS = {
  primary: 'bg-gem-ink text-white shadow-soft hover:bg-black disabled:bg-slate-300 disabled:shadow-none',
  secondary:
    'border border-slate-300 bg-white text-gem-ink hover:border-slate-400 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white shadow-soft hover:bg-red-700 disabled:bg-red-300 disabled:shadow-none',
  soft: 'bg-slate-100 text-ink-muted hover:bg-slate-200 hover:text-gem-ink disabled:text-slate-400',
  softDanger: 'bg-red-50 text-red-700 hover:bg-red-100 disabled:text-red-300',
  ghost: 'text-ink-muted hover:bg-slate-100 hover:text-gem-ink disabled:text-slate-400',
}

// loading: 스피너를 보여주고 클릭을 막는다 (children 은 그대로 표시)
export default function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  loading = false,
  disabled = false,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  )
}
