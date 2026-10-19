import { useId } from 'react'
import Icon from './Icon'

export default function Input({ label, error, className = '', id, ...props }) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-gem-ink">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`field ${error ? 'field-error' : ''}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
