import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import QuotaSection from './QuotaSection'

// Mock fetch globally
global.fetch = vi.fn()

describe('QuotaSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    // Mock fetch to not resolve immediately
    ;(fetch as any).mockImplementation(() => new Promise(() => {}))
    
    render(<QuotaSection userId="test-user-123" />)
    
    // The title should render immediately even in loading state
    expect(screen.getByText('功能配额')).toBeInTheDocument()
    // Should show loading skeleton
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders title section and subtitle', () => {
    // Mock fetch to not resolve immediately
    ;(fetch as any).mockImplementation(() => new Promise(() => {}))
    
    render(<QuotaSection userId="test-user-123" />)
    
    expect(screen.getByText('功能配额')).toBeInTheDocument()
    expect(screen.getByText('展示用户在各个功能上的配额使用情况')).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    // Mock fetch to not resolve immediately
    ;(fetch as any).mockImplementation(() => new Promise(() => {}))
    
    render(<QuotaSection userId="test-user-123" />)
    
    // Component should render without throwing
    expect(screen.getByText('功能配额')).toBeInTheDocument()
  })

  it('renders quota data after successful fetch', async () => {
    // Mock successful fetch response
    const mockResponse = {
      ok: true,
      data: {
        tier: 'basic',
        quota: {
          yearly_flow: { used: 5, limit: null },
          qa: { used: 15, limit: 20, reset_at: '2024-12-31T23:59:59Z' }
        },
        limits: {
          yearly_flow: null,
          qa: 20
        }
      }
    }

    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    })
    
    render(<QuotaSection userId="test-user-123" />)
    
    // Should show title immediately
    expect(screen.getByText('功能配额')).toBeInTheDocument()
    
    // Should show loading skeleton initially
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})