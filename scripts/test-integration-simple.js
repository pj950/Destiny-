/**
 * Simple integration test for BaZi Insights
 * Tests the complete workflow without database dependencies
 */

const { computeBazi } = require('../lib/bazi')
const { analyzeBaziInsights, toDBFormat } = require('../lib/bazi-insights')

function testIntegration() {
  console.log('Testing BaZi Insights Integration')
  console.log('==================================')
  
  try {
    // Test data
    const testCases = [
      {
        birthISO: '1990-03-15T10:00:00',
        timezone: 'Asia/Shanghai',
        name: 'Test Case 1'
      },
      {
        birthISO: '1985-08-20T15:00:00',
        timezone: 'Asia/Shanghai',
        name: 'Test Case 2'
      }
    ]
    
    let allPassed = true
    
    testCases.forEach((testCase, index) => {
      console.log(`\n--- ${testCase.name} ---`)
      
      // Step 1: Compute BaZi chart
      const chart = computeBazi(testCase.birthISO, testCase.timezone)
      console.log(`✓ Computed BaZi: ${chart.bazi.day}`)
      
      // Step 2: Analyze insights
      const birthYear = new Date(testCase.birthISO).getFullYear()
      const insights = analyzeBaziInsights(chart, birthYear)
      console.log(`✓ Analyzed insights - Day Master: ${insights.day_master.stem}`)
      
      // Step 3: Convert to DB format
      const insightsDB = toDBFormat(insights)
      console.log(`✓ Converted to DB format`)
      
      // Step 4: Validate data structure
      const validations = [
        insightsDB.day_master === insights.day_master.stem,
        insightsDB.ten_gods.relationships !== undefined,
        insightsDB.ten_gods.strengths !== undefined,
        insightsDB.luck_cycles !== undefined && insightsDB.luck_cycles.length > 0
      ]
      
      const passed = validations.every(v => v === true)
      
      if (passed) {
        console.log(`✓ All validations passed`)
      } else {
        console.log(`✗ Some validations failed`)
        allPassed = false
      }
      
      // Step 5: Display key metrics
      console.log(`  Day Master: ${insights.day_master.stem} (${insights.day_master.element})`)
      console.log(`  Balance Score: ${insights.ten_gods.balance_score}/100`)
      console.log(`  Top Ten God: ${insights.ten_gods.strengths[0]?.god} (${insights.ten_gods.strengths[0]?.strength}%)`)
      console.log(`  Personality Tags: ${insights.personality_tags.length} generated`)
      console.log(`  Luck Cycles: ${insights.luck_cycles.length} generated`)
    })
    
    console.log(`\n=== Final Result ===`)
    if (allPassed) {
      console.log('✓ All integration tests passed!')
      return true
    } else {
      console.log('✗ Some integration tests failed')
      return false
    }
    
  } catch (error) {
    console.error('Integration test failed:', error.message)
    return false
  }
}

// Run the test
const result = testIntegration()
process.exit(result ? 0 : 1)