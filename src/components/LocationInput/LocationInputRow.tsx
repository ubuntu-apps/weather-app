import type { ChangeEventHandler, FC } from 'react'

export interface LocationInputRowProps {
  value: string
  placeholder?: string
  buttonLabel?: string
  onChange: (value: string) => void
  onApply: () => void
}

export const LocationInputRow: FC<LocationInputRowProps> = ({
  value,
  placeholder = 'Enter location',
  buttonLabel = 'Use location',
  onChange,
  onApply,
}) => {
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onChange(event.target.value)
  }

  return (
    <div className="location-row">
      <div className="location-input-shell">
        <input
          className="location-input"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
        />
      </div>
      <button type="button" className="btn-location" onClick={onApply}>
        {buttonLabel}
      </button>
    </div>
  )
}


