import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OtpInput from '../OtpInput'

describe('OtpInput', () => {
  it('renders 6 input boxes', () => {
    render(<OtpInput onChange={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(6)
  })

  it('calls onChange with full code when all 6 digits are entered', () => {
    const onChange = vi.fn()
    render(<OtpInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    '123456'.split('').forEach((digit, i) => {
      fireEvent.change(inputs[i], { target: { value: digit } })
    })
    expect(onChange).toHaveBeenCalledWith('123456')
  })

  it('does not call onChange when fewer than 6 digits are entered', () => {
    const onChange = vi.fn()
    render(<OtpInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: '1' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('fills all boxes from a pasted 6-digit code and calls onChange', () => {
    const onChange = vi.fn()
    render(<OtpInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => '654321' },
    })
    expect(onChange).toHaveBeenCalledWith('654321')
  })
})
