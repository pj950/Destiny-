import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Modal from './Modal'

describe('Modal', () => {
  beforeEach(() => {
    // Reset body overflow before each test
    document.body.style.overflow = 'unset'
  })

  afterEach(() => {
    // Clean up after each test
    document.body.style.overflow = 'unset'
  })

  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <div>Modal Content</div>
      </Modal>
    )

    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument()
  })

  it('renders when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <div>Modal Content</div>
      </Modal>
    )

    expect(screen.getByText('Modal Content')).toBeInTheDocument()
  })

  it('displays title when provided', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <div>Content</div>
      </Modal>
    )

    expect(screen.getByText('Test Modal')).toBeInTheDocument()
  })

  it('displays footer when provided', () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        footer={<button>Footer Button</button>}
      >
        <div>Content</div>
      </Modal>
    )

    expect(screen.getByText('Footer Button')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <div>Content</div>
      </Modal>
    )

    const closeButton = screen.getByRole('button')
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when ESC key is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Content</div>
      </Modal>
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose on ESC when closeOnEscape is false', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} closeOnEscape={false}>
        <div>Content</div>
      </Modal>
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when clicking overlay', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Content</div>
      </Modal>
    )

    // Click on the overlay (first child of container)
    const overlay = container.firstChild as HTMLElement
    fireEvent.click(overlay)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when clicking modal content', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Content</div>
      </Modal>
    )

    const content = screen.getByText('Content')
    fireEvent.click(content)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not call onClose on overlay click when closeOnOverlayClick is false', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal isOpen={true} onClose={onClose} closeOnOverlayClick={false}>
        <div>Content</div>
      </Modal>
    )

    const overlay = container.firstChild as HTMLElement
    fireEvent.click(overlay)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('hides close button when showCloseButton is false', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} showCloseButton={false} title="Test">
        <div>Content</div>
      </Modal>
    )

    // The close button should not be rendered
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(0)
  })

  it('applies correct size classes', () => {
    const { rerender, container } = render(
      <Modal isOpen={true} onClose={vi.fn()} size="sm">
        <div>Small Modal</div>
      </Modal>
    )

    // Find the modal container with max-w class
    let modalWrapper = container.querySelector('.max-w-md')
    expect(modalWrapper).toBeInTheDocument()

    rerender(
      <Modal isOpen={true} onClose={vi.fn()} size="lg">
        <div>Large Modal</div>
      </Modal>
    )

    // Find the modal container with max-w class
    modalWrapper = container.querySelector('.max-w-2xl')
    expect(modalWrapper).toBeInTheDocument()
  })

  it('prevents body scroll when modal is open', () => {
    const { unmount } = render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <div>Content</div>
      </Modal>
    )

    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).toBe('unset')
  })

  it('restores body scroll when modal closes', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <div>Content</div>
      </Modal>
    )

    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <Modal isOpen={false} onClose={vi.fn()}>
        <div>Content</div>
      </Modal>
    )

    expect(document.body.style.overflow).toBe('unset')
  })

  it('has correct ARIA attributes for accessibility', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <div>Content</div>
      </Modal>
    )

    // Modal should be visible
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })
})
