import type { ChangeEventHandler, FC, KeyboardEventHandler, Ref } from 'react'
import { X, ChevronDown } from 'lucide-react'

export interface LocationInputRowProps {
  value: string
  placeholder?: string
  buttonLabel?: string
  onChange: (value: string) => void
  onApply: () => void
  onClear?: () => void
  onOpenRecentList?: () => void
  inputRef?: Ref<HTMLInputElement>
}

export const LocationInputRow: FC<LocationInputRowProps> = ({
  value,
  placeholder = 'Enter location',
  buttonLabel = 'Use location',
  onChange,
  onApply,
  onClear,
  onOpenRecentList,
  inputRef,
}) => {
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onChange(event.target.value)
  }

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onApply()
    }
  }

  const hasValue = value.trim() !== ''

  return (
    <div className="location-row">
      <div className="location-input-shell">
        <input
          className="location-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          ref={inputRef}
          placeholder={placeholder}
        />
        {hasValue && onClear && (
          <button
            type="button"
            className="location-input-clear"
            onClick={onClear}
            aria-label="Clear"
          >
            <X size={18} strokeWidth={2.5} aria-hidden />
          </button>
        )}
        {!hasValue && onOpenRecentList && (
          <button
            type="button"
            className="location-input-recent-trigger"
            onClick={onOpenRecentList}
            aria-label="Choose from recent locations"
          >
            <ChevronDown size={20} strokeWidth={2.5} aria-hidden />
          </button>
        )}
      </div>
      <button type="button" className="btn-location" onClick={onApply}>
        {buttonLabel}
      </button>
    </div>
  )
}


