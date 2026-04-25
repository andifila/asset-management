// src/components/NumInput.jsx
import { useState, useEffect } from 'react'

const toDisplay = (val) => {
  if (val === '' || val == null) return ''
  const n = Number(val)
  return n > 0 ? n.toLocaleString('id-ID') : ''
}

export default function NumInput({ value, onChange, placeholder, className, style, autoFocus }) {
  const [display, setDisplay] = useState(() => toDisplay(value))

  useEffect(() => {
    setDisplay(toDisplay(value))
  }, [value])

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\./g, '').replace(/,/g, '')
    if (raw !== '' && !/^\d+$/.test(raw)) return
    const num = raw === '' ? '' : Number(raw)
    setDisplay(raw === '' ? '' : Number(raw).toLocaleString('id-ID'))
    onChange(num)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder ?? '0'}
      className={className}
      style={style}
      autoFocus={autoFocus}
    />
  )
}
