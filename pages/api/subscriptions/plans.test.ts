/**
 * Tests for GET /api/subscriptions/plans
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from './plans'

// Mock dependencies
vi.mock('../../../lib/supabase', () => ({
  supabaseService: {},
}))

describe('/api/subscriptions/plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 405 for non-GET requests', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
  })

  it('should return all subscription plans', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)

    const data = JSON.parse(res._getData())
    expect(data.ok).toBe(true)
    expect(data.data).toHaveLength(4)

    // Check plan properties
    const plans = data.data
    expect(plans.some((p: any) => p.id === 'free')).toBe(true)
    expect(plans.some((p: any) => p.id === 'basic')).toBe(true)
    expect(plans.some((p: any) => p.id === 'premium')).toBe(true)
    expect(plans.some((p: any) => p.id === 'vip')).toBe(true)
  })

  it('should include pricing information', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    const data = JSON.parse(res._getData())
    const basicPlan = data.data.find((p: any) => p.id === 'basic')

    expect(basicPlan.price).toBeDefined()
    expect(basicPlan.price.monthly).toBe(299)
    expect(basicPlan.price.yearly).toBe(2999)
  })

  it('should include vip plan with correct pricing', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    const data = JSON.parse(res._getData())
    const vipPlan = data.data.find((p: any) => p.id === 'vip')

    expect(vipPlan.price).toBeDefined()
    expect(vipPlan.price.monthly).toBe(1499)
    expect(vipPlan.price.yearly).toBe(14999)
  })

  it('should include features for each plan', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    const data = JSON.parse(res._getData())
    const plan = data.data[0]

    expect(plan.features).toBeDefined()
    expect(plan.features.character_profile).toBeDefined()
    expect(plan.features.yearly_flow).toBeDefined()
    expect(plan.features.qa).toBeDefined()
    expect(plan.features.family_comparison).toBeDefined()
    expect(plan.features.export).toBeDefined()
  })
})
