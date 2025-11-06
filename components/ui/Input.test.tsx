import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Input from './Input'

describe('Input Component', () => {
  it('renders input with label', () => {
    render(<Input label="Name" />)
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByText(/name/i)).toBeInTheDocument()
  })

  it('renders input without label', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('applies placeholder text', () => {
    render(<Input placeholder="Enter your name" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('placeholder', 'Enter your name')
  })

  it('shows helper text when provided', () => {
    render(<Input label="Email" helperText="Please enter a valid email" />)
    expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument()
  })

  it('shows error state with error message', () => {
    render(<Input label="Password" error="Password is required" />)
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toHaveClass('border-red-300')
  })

  it('does not show helper text when error is present', () => {
    render(
      <Input 
        label="Email" 
        helperText="Please enter a valid email"
        error="Email is invalid" 
      />
    )
    expect(screen.queryByText(/please enter a valid email/i)).not.toBeInTheDocument()
    expect(screen.getByText(/email is invalid/i)).toBeInTheDocument()
  })

  it('applies disabled state', () => {
    render(<Input disabled />)
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
    expect(input).toHaveClass('disabled:opacity-50')
  })

  it('handles value changes', () => {
    const handleChange = vi.fn()
    render(<Input value="test" onChange={handleChange} />)
    
    const input = screen.getByRole('textbox')
    input.dispatchEvent(new Event('change', { bubbles: true }))
    
    expect(handleChange).toHaveBeenCalled()
  })

  it('renders left icon', () => {
    render(
      <Input 
        leftIcon={<span data-testid="left-icon">@</span>}
      />
    )
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
  })

  it('renders right icon', () => {
    render(
      <Input 
        rightIcon={<span data-testid="right-icon">✓</span>}
      />
    )
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Input className="custom-input" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-input')
  })

  it('generates unique id when not provided', () => {
    render(<Input label="Test" />)
    const input = screen.getByLabelText(/test/i)
    const label = screen.getByText(/test/i)
    
    expect(input.id).toBeTruthy()
    expect(label.getAttribute('for')).toBe(input.id)
  })

  it('uses provided id', () => {
    render(<Input id="custom-id" label="Test" />)
    const input = screen.getByLabelText(/test/i)
    const label = screen.getByText(/test/i)
    
    expect(input.id).toBe('custom-id')
    expect(label.getAttribute('for')).toBe('custom-id')
  })

  it('handles different input types', () => {
    render(<Input type="email" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('type', 'email')
  })
})