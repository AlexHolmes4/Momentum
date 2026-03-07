import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OtpInput from '../OtpInput'

describe('OtpInput', () => {
  it('renders 8 input boxes', () => {
    render(<OtpInput onChange={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(8)
  })

  it('calls onChange with full code when all 8 digits are entered', () => {
    const onChange = vi.fn()
    render(<OtpInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    '12345678'.split('').forEach((digit, i) => {
      fireEvent.change(inputs[i], { target: { value: digit } })
    })
    expect(onChange).toHaveBeenCalledWith('12345678')
  })

  it('does not call onChange when fewer than 8 digits are entered', () => {
    const onChange = vi.fn()
    render(<OtpInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: '1' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('fills all boxes from a pasted 8-digit code and calls onChange', () => {
    const onChange = vi.fn()
    render(<OtpInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => '65432178' },
    })
    expect(onChange).toHaveBeenCalledWith('65432178')
  })
})
