import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlanCard from './PlanCard'
import { SubscriptionPlan } from '../../lib/subscription'

const mockPlan: SubscriptionPlan = {
  id: 'premium',
  name: 'Premium',
  description: 'Advanced features for dedicated users',
  price: {
    monthly: 699,
    yearly: 6999,
  },
  billing_cycles: ['monthly', 'yearly'],
  features: {
    character_profile: true,
    yearly_flow: {
      enabled: true,
      limit: null,
      period: null,
    },
    qa: {
      enabled: true,
      limit: 100,
      period: 'monthly',
    },
    family_comparison: true,
    export: {
      enabled: true,
      formats: ['pdf', 'excel'],
    },
  },
}

describe('PlanCard', () => {
  it('renders plan information correctly', () => {
    const onUpgrade = vi.fn()
    render(
      <PlanCard
        plan={mockPlan}
        isCurrentPlan={false}
        isBillingMonthly={true}
        onUpgrade={onUpgrade}
      />
    )

    expect(screen.getByText('Premium')).toBeInTheDocument()
    expect(screen.getByText('Advanced features for dedicated users')).toBeInTheDocument()
    expect(screen.getByText('₹699')).toBeInTheDocument()
    expect(screen.getByText('/月')).toBeInTheDocument()
  })

  it('shows yearly price when isBillingMonthly is false', () => {
    const onUpgrade = vi.fn()
    render(
      <PlanCard
        plan={mockPlan}
        isCurrentPlan={false}
        isBillingMonthly={false}
        onUpgrade={onUpgrade}
      />
    )

    expect(screen.getByText('₹6999')).toBeInTheDocument()
    expect(screen.getByText('/年')).toBeInTheDocument()
  })

  it('displays current plan badge when isCurrentPlan is true', () => {
    const onUpgrade = vi.fn()
    render(
      <PlanCard
        plan={mockPlan}
        isCurrentPlan={true}
        isBillingMonthly={true}
        onUpgrade={onUpgrade}
      />
    )

    const currentPlanTexts = screen.getAllByText('当前计划')
    expect(currentPlanTexts.length).toBeGreaterThan(0)
  })

  it('shows upgrade button when not current plan', () => {
    const onUpgrade = vi.fn()
    render(
      <PlanCard
        plan={mockPlan}
        isCurrentPlan={false}
        isBillingMonthly={true}
        onUpgrade={onUpgrade}
      />
    )

    expect(screen.getByText('立即升级')).toBeInTheDocument()
  })

  it('displays key features', () => {
    const onUpgrade = vi.fn()
    render(
      <PlanCard
        plan={mockPlan}
        isCurrentPlan={false}
        isBillingMonthly={true}
        onUpgrade={onUpgrade}
      />
    )

    expect(screen.getByText('无限流年分析')).toBeInTheDocument()
    expect(screen.getByText('每月100条QA')).toBeInTheDocument()
    expect(screen.getByText('家族对比分析')).toBeInTheDocument()
  })

  it('displays annual savings when yearly billing', () => {
    const onUpgrade = vi.fn()
    render(
      <PlanCard
        plan={mockPlan}
        isCurrentPlan={false}
        isBillingMonthly={false}
        onUpgrade={onUpgrade}
      />
    )

    const savings = (699 * 12 - 6999).toFixed(0)
    expect(screen.getByText(`年度节省 ₹${savings}`)).toBeInTheDocument()
  })
})
