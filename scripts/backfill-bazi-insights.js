/**
 * Backfill script for existing charts with BaZi insights
 * 
 * This script will:
 * 1. Fetch all existing charts without day_master, ten_gods, or luck_cycles
 * 2. Calculate the insights using the new analysis functions
 * 3. Update the charts with the new data
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

// Import the BaZi functions (we'll need to compile this or run via tsx)
const { computeBazi } = require('../lib/bazi')
const { analyzeBaziInsights, toDBFormat } = require('../lib/bazi-insights')

async function backfillCharts() {
  console.log('Starting backfill process...')
  
  try {
    // Fetch all charts that need backfilling
    const { data: charts, error: fetchError } = await supabase
      .from('charts')
      .select('id, chart_json, profile_id')
      .or('day_master.is.null,ten_gods.is.null,luck_cycles.is.null')
    
    if (fetchError) {
      console.error('Error fetching charts:', fetchError)
      return
    }
    
    console.log(`Found ${charts.length} charts to backfill`)
    
    // Get profile data for birth year extraction
    const profileIds = charts.map(chart => chart.profile_id)
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, birth_local')
      .in('id', profileIds)
    
    if (profileError) {
      console.error('Error fetching profiles:', profileError)
      return
    }
    
    const profileMap = new Map(profiles.map(p => [p.id, p]))
    
    let successCount = 0
    let errorCount = 0
    
    // Process each chart
    for (const chart of charts) {
      try {
        const profile = profileMap.get(chart.profile_id)
        if (!profile) {
          console.error(`Profile not found for chart ${chart.id}`)
          errorCount++
          continue
        }
        
        // Calculate insights
        const birthYear = new Date(profile.birth_local).getFullYear()
        const insights = analyzeBaziInsights(chart.chart_json, birthYear)
        const insightsDB = toDBFormat(insights)
        
        // Update the chart
        const { error: updateError } = await supabase
          .from('charts')
          .update({
            day_master: insightsDB.day_master,
            ten_gods: insightsDB.ten_gods,
            luck_cycles: insightsDB.luck_cycles,
            updated_at: new Date().toISOString()
          })
          .eq('id', chart.id)
        
        if (updateError) {
          console.error(`Error updating chart ${chart.id}:`, updateError)
          errorCount++
        } else {
          console.log(`✓ Updated chart ${chart.id} (Day Master: ${insightsDB.day_master})`)
          successCount++
        }
        
      } catch (error) {
        console.error(`Error processing chart ${chart.id}:`, error)
        errorCount++
      }
      
      // Add a small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log(`\nBackfill completed:`)
    console.log(`✓ Successfully updated: ${successCount} charts`)
    console.log(`✗ Failed to update: ${errorCount} charts`)
    
  } catch (error) {
    console.error('Unexpected error during backfill:', error)
  }
}

// Run the backfill
backfillCharts().then(() => {
  console.log('Backfill script finished')
  process.exit(0)
}).catch(error => {
  console.error('Backfill script failed:', error)
  process.exit(1)
})