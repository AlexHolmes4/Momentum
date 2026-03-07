'use client'
import { useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react'

type Props = {
  onChange: (code: string) => void
  disabled?: boolean
}

export default function OtpInput({ onChange, disabled }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = useRef<string[]>(Array(8).fill(''))

  function notify() {
    const code = digits.current.join('')
    if (code.length === 8) onChange(code)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>, index: number) {
    const val = e.target.value.replace(/\D/g, '').slice(-1)
    digits.current[index] = val
    e.target.value = val
    if (val && index < 7) refs.current[index + 1]?.focus()
    notify()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
      digits.current[index - 1] = ''
      refs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
    pasted.split('').forEach((char, i) => {
      digits.current[i] = char
      if (refs.current[i]) refs.current[i]!.value = char
    })
    refs.current[Math.min(pasted.length, 7)]?.focus()
    notify()
  }

  const boxClass =
    'w-11 h-14 text-center text-xl font-bold text-white bg-gray-800 border border-gray-700 rounded-lg ' +
    'focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50'

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 8 }, (_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKeyDown(e, i)}
          onPaste={handlePaste}
          className={boxClass}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}
