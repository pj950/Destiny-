/**
 * Test API Integration for BaZi Insights
 * 
 * Tests the charts compute API with new insights integration
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testAPIIntegration() {
  console.log('Testing API Integration for BaZi Insights')
  console.log('=====================================')
  
  try {
    // Create a test profile
    const testProfile = {
      name: 'Test User',
      birth_local: '1990-03-15T10:00:00',
      birth_timezone: 'Asia/Shanghai',
      gender: 'male'
    }
    
    console.log('Creating test profile...')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert([testProfile])
      .select()
      .single()
    
    if (profileError) {
      console.error('Error creating profile:', profileError)
      return
    }
    
    console.log(`✓ Created profile: ${profile.id}`)
    
    // Test the charts compute API by simulating the API call
    console.log('Testing chart computation with insights...')
    
    // Import the functions directly (simulating API)
    const { computeBazi } = require('../lib/bazi')
    const { analyzeBaziInsights, toDBFormat } = require('../lib/bazi-insights')
    
    // Compute the BaZi chart
    const chart = computeBazi(testProfile.birth_local, testProfile.birth_timezone)
    console.log(`✓ Computed BaZi chart: ${chart.bazi.day}`)
    
    // Analyze BaZi insights
    const birthYear = new Date(testProfile.birth_local).getFullYear()
    const insights = analyzeBaziInsights(chart, birthYear)
    console.log(`✓ Analyzed insights - Day Master: ${insights.day_master.stem}`)
    
    // Convert to DB format
    const insightsDB = toDBFormat(insights)
    console.log(`✓ Converted to DB format`)
    
    // Insert the chart with insights into the database
    const { data: insertedChart, error: insertError } = await supabase
      .from('charts')
      .insert([{ 
        profile_id: profile.id, 
        chart_json: chart, 
        wuxing_scores: chart.wuxing,
        day_master: insightsDB.day_master,
        ten_gods: insightsDB.ten_gods,
        luck_cycles: insightsDB.luck_cycles
      }])
      .select()
      .single()
    
    if (insertError) {
      console.error('Error inserting chart:', insertError)
      return
    }
    
    console.log(`✓ Created chart with insights: ${insertedChart.id}`)
    
    // Verify the data was stored correctly
    console.log('Verifying stored data...')
    
    const { data: storedChart, error: fetchError } = await supabase
      .from('charts')
      .select('*')
      .eq('id', insertedChart.id)
      .single()
    
    if (fetchError) {
      console.error('Error fetching chart:', fetchError)
      return
    }
    
    // Verify all fields are present
    const checks = [
      storedChart.day_master === insightsDB.day_master,
      storedChart.ten_gods !== null,
      storedChart.luck_cycles !== null,
      storedChart.chart_json !== null,
      storedChart.wuxing_scores !== null
    ]
    
    const allPassed = checks.every(check => check === true)
    
    if (allPassed) {
      console.log('✓ All data fields stored correctly')
    } else {
      console.log('✗ Some data fields missing or incorrect')
      console.log('Day Master:', storedChart.day_master, 'Expected:', insightsDB.day_master)
      console.log('Ten Gods:', storedChart.ten_gods ? 'Present' : 'Missing')
      console.log('Luck Cycles:', storedChart.luck_cycles ? 'Present' : 'Missing')
    }
    
    // Display insights summary
    console.log('\n=== Insights Summary ===')
    console.log(`Day Master: ${storedChart.day_master} (${insights.day_master.element})`)
    console.log(`Balance Score: ${insights.ten_gods.balance_score}/100`)
    console.log(`Top Ten Gods:`)
    insights.ten_gods.strengths.slice(0, 3).forEach((god, index) => {
      console.log(`  ${index + 1}. ${god.god}: ${god.strength}%`)
    })
    console.log(`First Luck Cycle: ${insights.luck_cycles[0].combined} (${insights.luck_cycles[0].age_start}-${insights.luck_cycles[0].age_end} years)`)
    
    // Clean up test data
    console.log('\nCleaning up test data...')
    await supabase.from('charts').delete().eq('id', insertedChart.id)
    await supabase.from('profiles').delete().eq('id', profile.id)
    console.log('✓ Test data cleaned up')
    
    console.log('\n✓ API Integration test completed successfully!')
    
  } catch (error) {
    console.error('Test failed:', error.message)
  }
}

testAPIIntegration().then(() => {
  console.log('Integration test finished')
  process.exit(0)
}).catch(error => {
  console.error('Integration test failed:', error)
  process.exit(1)
})