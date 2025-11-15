/**
 * Script to create Stripe products and prices for subscription plans
 * 
 * Usage:
 *   ts-node scripts/setup-stripe-products.ts
 * 
 * This script creates products and prices in your Stripe account and outputs
 * the Price IDs that you need to add to your .env.local file.
 */

import Stripe from 'stripe'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})

const PLANS = [
  {
    id: 'basic',
    name: 'Basic Subscription',
    description: 'Ideal for casual users and enthusiasts',
    prices: {
      monthly: { amount: 29900, interval: 'month' as const }, // ₹299
      yearly: { amount: 299900, interval: 'year' as const },  // ₹2,999
    },
  },
  {
    id: 'premium',
    name: 'Premium Subscription',
    description: 'Advanced features for dedicated users',
    prices: {
      monthly: { amount: 69900, interval: 'month' as const }, // ₹699
      yearly: { amount: 699900, interval: 'year' as const },  // ₹6,999
    },
  },
  {
    id: 'vip',
    name: 'VIP Subscription',
    description: 'Ultimate access with priority support',
    prices: {
      monthly: { amount: 149900, interval: 'month' as const }, // ₹1,499
      yearly: { amount: 1499900, interval: 'year' as const },  // ₹14,999
    },
  },
]

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe products and prices...\n')

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ Error: STRIPE_SECRET_KEY environment variable is not set')
    process.exit(1)
  }

  const envVars: string[] = []

  for (const plan of PLANS) {
    console.log(`📦 Creating product: ${plan.name}`)

    // Create product
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: {
        plan_id: plan.id,
      },
    })

    console.log(`   ✅ Product created: ${product.id}`)

    // Create monthly price
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.prices.monthly.amount,
      currency: 'inr',
      // One-time payment (not recurring)
      metadata: {
        plan_id: plan.id,
        billing_cycle: 'monthly',
      },
    })

    console.log(`   💰 Monthly price created: ${monthlyPrice.id} (₹${plan.prices.monthly.amount / 100})`)
    envVars.push(`STRIPE_PRICE_${plan.id.toUpperCase()}_MONTHLY=${monthlyPrice.id}`)

    // Create yearly price
    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.prices.yearly.amount,
      currency: 'inr',
      // One-time payment (not recurring)
      metadata: {
        plan_id: plan.id,
        billing_cycle: 'yearly',
      },
    })

    console.log(`   💰 Yearly price created: ${yearlyPrice.id} (₹${plan.prices.yearly.amount / 100})`)
    envVars.push(`STRIPE_PRICE_${plan.id.toUpperCase()}_YEARLY=${yearlyPrice.id}`)

    console.log('')
  }

  console.log('✅ All products and prices created successfully!\n')
  console.log('📝 Add these to your .env.local file:\n')
  console.log(envVars.join('\n'))
  console.log('')
}

// Run the script
setupStripeProducts()
  .then(() => {
    console.log('✨ Setup complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error setting up Stripe products:', error.message)
    process.exit(1)
  })
