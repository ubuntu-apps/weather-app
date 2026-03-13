import type { ChangeEventHandler, FC, KeyboardEventHandler, Ref } from 'react'

export interface LocationInputRowProps {
  value: string
  placeholder?: string
  buttonLabel?: string
  onChange: (value: string) => void
  onApply: () => void
  inputRef?: Ref<HTMLInputElement>
}

export const LocationInputRow: FC<LocationInputRowProps> = ({
  value,
  placeholder = 'Enter location',
  buttonLabel = 'Use location',
  onChange,
  onApply,
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
      </div>
      <button type="button" className="btn-location" onClick={onApply}>
        {buttonLabel}
      </button>
    </div>
  )
}


