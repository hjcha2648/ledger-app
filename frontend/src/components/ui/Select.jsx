import { useId } from 'react'
import Icon from './Icon'

// options: [{ value, label }], fieldClassName: <select> 자체에 덧붙일 클래스(예: 알약형 rounded-full)
export default function Select({ label, error, options, className = '', fieldClassName = '', id, ...props }) {
  const autoId = useId()
  const selectId = id ?? autoId
  const errorId = `${selectId}-error`
  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-gem-ink">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`field ${error ? 'field-error' : ''} ${fieldClassName}`}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
