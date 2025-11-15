import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import QuotaCard from './QuotaCard'

describe('QuotaCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders enabled feature with unlimited quota', () => {
    render(
      <QuotaCard
        title="性格简报"
        used={0}
        limit={null}
        enabled={true}
      />
    )

    expect(screen.getByText('性格简报')).toBeInTheDocument()
    expect(screen.getByText('无限制')).toBeInTheDocument()
    expect(screen.getByText('无限制')).toHaveClass('text-green-600')
  })

  it('renders enabled feature with limited quota under 50%', () => {
    render(
      <QuotaCard
        title="流年报告"
        used={3}
        limit={10}
        enabled={true}
      />
    )

    expect(screen.getByText('流年报告')).toBeInTheDocument()
    expect(screen.getByText('3/10')).toBeInTheDocument()
    expect(screen.getByText('3/10')).toHaveClass('text-green-600')
  })

  it('renders enabled feature with limited quota over 80%', () => {
    render(
      <QuotaCard
        title="智能问答"
        used={9}
        limit={10}
        enabled={true}
      />
    )

    expect(screen.getByText('智能问答')).toBeInTheDocument()
    expect(screen.getByText('9/10')).toBeInTheDocument()
    expect(screen.getByText('9/10')).toHaveClass('text-red-600')
  })

  it('renders disabled feature with upgrade button', () => {
    const onUpgrade = vi.fn()
    render(
      <QuotaCard
        title="家人对比"
        used={0}
        limit={0}
        enabled={false}
        onUpgrade={onUpgrade}
      />
    )

    expect(screen.getByText('家人对比')).toBeInTheDocument()
    expect(screen.getByText('已禁用')).toBeInTheDocument()
    expect(screen.getByText('升级解锁')).toBeInTheDocument()
    
    screen.getByText('升级解锁').click()
    expect(onUpgrade).toHaveBeenCalled()
  })

  it('shows reset time when provided', () => {
    const resetDate = '2024-12-31T23:59:59Z'
    render(
      <QuotaCard
        title="流年报告"
        used={5}
        limit={10}
        enabled={true}
        period="monthly"
        resetAt={resetDate}
      />
    )

    expect(screen.getByText(/重置时间:/)).toBeInTheDocument()
  })
})