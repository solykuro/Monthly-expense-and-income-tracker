import { useId } from 'react'
import './Segmented.css'

interface Option<T extends string | number> {
  value: T
  label: string
}

interface Props<T extends string | number> {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  hideLabel?: boolean
}

/** 單選切換鈕組（radio group） */
export function Segmented<T extends string | number>({ label, options, value, onChange, hideLabel }: Props<T>) {
  const name = useId()
  return (
    <fieldset className="segmented">
      <legend className={hideLabel ? 'visually-hidden' : 'segmented-legend'}>{label}</legend>
      <div className="segmented-options">
        {options.map((o) => (
          <label key={String(o.value)} className={o.value === value ? 'is-selected' : undefined}>
            <input
              type="radio"
              name={name}
              value={String(o.value)}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
