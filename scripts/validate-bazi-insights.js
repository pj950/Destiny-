/**
 * Validation script for BaZi insights
 * 
 * Tests the new insights module with sample birth dates
 */

const { computeBazi } = require('../lib/bazi')
const { analyzeBaziInsights, toDBFormat } = require('../lib/bazi-insights')

function validateBirthDate(birthISO, timezone, expectedDayMaster) {
  console.log(`\n=== Testing: ${birthISO} (${timezone}) ===`)
  
  try {
    const chart = computeBazi(birthISO, timezone)
    const birthYear = new Date(birthISO).getFullYear()
    const insights = analyzeBaziInsights(chart, birthYear)
    
    console.log(`BaZi: ${chart.bazi.year} ${chart.bazi.month} ${chart.bazi.day} ${chart.bazi.hour}`)
    console.log(`Day Master: ${insights.day_master.stem} (${insights.day_master.element}, ${insights.day_master.yin_yang})`)
    console.log(`Day Master Keywords: ${insights.day_master.keywords.join(', ')}`)
    
    if (expectedDayMaster) {
      const match = insights.day_master.stem === expectedDayMaster
      console.log(`Expected Day Master: ${expectedDayMaster} - ${match ? '✓ PASS' : '✗ FAIL'}`)
    }
    
    console.log(`Top 3 Ten Gods:`)
    insights.ten_gods.strengths.slice(0, 3).forEach((god, index) => {
      console.log(`  ${index + 1}. ${god.god}: ${god.strength}% (${god.element})`)
    })
    
    console.log(`Balance Score: ${insights.ten_gods.balance_score}/100`)
    console.log(`Dominant Elements: ${insights.ten_gods.dominant_elements.join(', ')}`)
    console.log(`Weak Elements: ${insights.ten_gods.weak_elements.join(', ')}`)
    
    console.log(`First Luck Cycle:`)
    const firstCycle = insights.luck_cycles[0]
    console.log(`  ${firstCycle.age_start}-${firstCycle.age_end} years (${firstCycle.gregorian_start}-${firstCycle.gregorian_end})`)
    console.log(`  ${firstCycle.combined} - ${firstCycle.ten_god} (${firstCycle.element})`)
    
    console.log(`Personality Tags (sample):`)
    insights.personality_tags.slice(0, 5).forEach(tag => {
      console.log(`  ${tag.tag} (${tag.category}, ${tag.confidence}%, ${tag.source})`)
    })
    
    return true
    
  } catch (error) {
    console.error(`Error: ${error.message}`)
    return false
  }
}

// Test cases
const testCases = [
  {
    birthISO: '1990-03-15T10:00:00',
    timezone: 'Asia/Shanghai',
    expectedDayMaster: '己'
  },
  {
    birthISO: '1985-08-20T15:00:00',
    timezone: 'Asia/Shanghai',
    expectedDayMaster: '辛'
  },
  {
    birthISO: '1995-12-25T08:30:00',
    timezone: 'Asia/Shanghai',
    expectedDayMaster: null // Unknown, just testing
  },
  {
    birthISO: '2000-01-01T00:00:00',
    timezone: 'Asia/Shanghai',
    expectedDayMaster: null // Unknown, just testing
  }
]

console.log('BaZi Insights Validation')
console.log('=======================')

let passCount = 0
testCases.forEach(testCase => {
  const result = validateBirthDate(
    testCase.birthISO,
    testCase.timezone,
    testCase.expectedDayMaster
  )
  if (result) passCount++
})

console.log(`\n=== Summary ===`)
console.log(`Total tests: ${testCases.length}`)
console.log(`Passed: ${passCount}`)
console.log(`Failed: ${testCases.length - passCount}`)

if (passCount === testCases.length) {
  console.log('✓ All validation tests passed!')
} else {
  console.log('✗ Some validation tests failed')
}