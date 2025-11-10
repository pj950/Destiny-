# BaZi Insights Module Documentation

## Overview

The BaZi Insights module (`lib/bazi-insights.ts`) provides comprehensive analysis of BaZi (八字) charts, including Day Master analysis, Ten Gods relationships, luck cycles, and personality profiling.

## Features

### 1. Day Master Analysis (日主分析)
- Determines the Day Master from the day pillar stem
- Provides elemental attributes (wood, fire, earth, metal, water)
- Identifies yin/yang polarity
- Generates personality keywords and descriptions

### 2. Ten Gods Analysis (十神分析)
- Calculates Ten Gods relationships for all pillars
- Determines strength scores (0-100 normalized)
- Identifies dominant and weak elements
- Provides balance assessment

### 3. Luck Cycles (大运)
- Generates 10-year luck cycles
- Maps to Gregorian calendar years
- Identifies ruling elements and Ten Gods
- Provides influence descriptions

### 4. Personality Profiling
- Generates personality tags from multiple sources
- Categorizes tags (strengths, weaknesses, traits)
- Provides confidence scores
- Supports AI prompt generation

## API Reference

### Types

```typescript
interface DayMaster {
  stem: string          // 天干字符 (甲, 乙, 丙, ...)
  element: WuxingElement // 五行属性
  yin_yang: YinYang     // 阴阳属性
  keywords: string[]     // 人格关键词
  description: string    // 简短描述
}

interface TenGodStrength {
  god: TenGodName       // 十神名称
  strength: number      // 0-100 归一化强度
  element: WuxingElement // 对应五行
  relationship: string  // 与日主的关系描述
  influence: string[]   // 影响方面
}

interface LuckCycle {
  age_start: number        // 开始年龄
  age_end: number          // 结束年龄
  gregorian_start: number  // 公历开始年份
  gregorian_end: number    // 公历结束年份
  stem: string            // 天干
  branch: string          // 地支
  combined: string        // 干支组合
  element: WuxingElement  // 主导五行
  ten_god: TenGodName     // 对应十神
  influence: string       // 影响说明占位符
  description: string     // 详细描述
}

interface BaziInsights {
  day_master: DayMaster
  ten_gods: TenGodsAnalysis
  luck_cycles: LuckCycle[]
  personality_tags: PersonalityTag[]
  analysis_summary: AnalysisSummary
}
```

### Main Functions

#### `calculateDayMaster(chart: BaziChart): DayMaster`
Calculates Day Master attributes from a BaZi chart.

**Parameters:**
- `chart`: BaZi chart object from `computeBazi()`

**Returns:**
- `DayMaster` object with comprehensive analysis

**Example:**
```typescript
const chart = computeBazi('1990-03-15T10:00:00', 'Asia/Shanghai')
const dayMaster = calculateDayMaster(chart)
console.log(dayMaster.stem) // '己'
console.log(dayMaster.element) // 'earth'
console.log(dayMaster.keywords) // ['温润', '滋养', '务实', '耐心', '协调']
```

#### `calculateTenGods(chart: BaziChart): TenGodsAnalysis`
Analyzes Ten Gods relationships and strengths.

**Parameters:**
- `chart`: BaZi chart object

**Returns:**
- `TenGodsAnalysis` with relationships, strengths, and balance metrics

**Example:**
```typescript
const tenGods = calculateTenGods(chart)
console.log(tenGods.relationships.year_stem) // '偏印'
console.log(tenGods.strengths[0]) // Top ten god with strength
console.log(tenGods.balance_score) // 0-100 balance score
```

#### `calculateLuckCycles(chart: BaziChart, birthYear: number): LuckCycle[]`
Generates luck cycles for a BaZi chart.

**Parameters:**
- `chart`: BaZi chart object
- `birthYear`: Birth year for Gregorian mapping

**Returns:**
- Array of `LuckCycle` objects (typically 8 cycles for 80 years)

**Example:**
```typescript
const luckCycles = calculateLuckCycles(chart, 1990)
console.log(luckCycles[0]) // First luck cycle (ages 8-17)
console.log(luckCycles[0].combined) // '辛辰'
console.log(luckCycles[0].ten_god) // '食神'
```

#### `analyzeBaziInsights(chart: BaziChart, birthYear: number): BaziInsights`
Main function that performs complete BaZi analysis.

**Parameters:**
- `chart`: BaZi chart object
- `birthYear`: Birth year for luck cycle calculations

**Returns:**
- Complete `BaziInsights` object with all analyses

**Example:**
```typescript
const insights = analyzeBaziInsights(chart, 1990)
console.log(insights.day_master.stem) // '己'
console.log(insights.ten_gods.balance_score) // 86
console.log(insights.personality_tags) // Personality tags array
console.log(insights.analysis_summary) // Summary analysis
```

#### `toDBFormat(insights: BaziInsights): BaziInsightsDB`
Converts insights to database storage format.

**Parameters:**
- `insights`: Complete insights object

**Returns:**
- Simplified object for database storage

## Integration with Charts API

The insights module is integrated into `pages/api/charts/compute.ts`:

```typescript
// Compute the BaZi chart
const chart = computeBazi(profile.birth_local, profile.birth_timezone)

// Analyze BaZi insights
const birthYear = new Date(profile.birth_local).getFullYear()
const insights = analyzeBaziInsights(chart, birthYear)
const insightsDB = toDBFormat(insights)

// Insert the chart into the database with new insights fields
const { data: inserted, error: insertErr } = await supabaseService
  .from('charts')
  .insert([{ 
    profile_id, 
    chart_json: chart, 
    wuxing_scores: chart.wuxing,
    day_master: insightsDB.day_master,
    ten_gods: insightsDB.ten_gods,
    luck_cycles: insightsDB.luck_cycles
  }])
```

## Database Schema

The insights are stored in the `charts` table with these new columns:

```sql
-- Day Master (日主) field to store the Heavenly Stem of the Day Pillar
ALTER TABLE charts ADD COLUMN IF NOT EXISTS day_master TEXT;

-- Ten Gods (十神) field to store Ten Gods relationships
ALTER TABLE charts ADD COLUMN IF NOT EXISTS ten_gods JSONB;

-- Luck Cycles (大运) field to store 10-year luck cycle data
ALTER TABLE charts ADD COLUMN IF NOT EXISTS luck_cycles JSONB;
```

## Ten Gods Mapping

The module uses traditional Ten Gods relationships:

| Relationship | Same Element | Generates Me | I Generate | Controls Me | I Control |
|-------------|--------------|--------------|------------|-------------|------------|
| Same Yang | 比肩 | 正印 | 食神 | 正官 | 正财 |
| Same Yin | 劫财 | 偏印 | 伤官 | 七杀 | 偏财 |

### Ten Gods Descriptions

- **正印**: Learning, reputation, noble people, motherly love, security
- **偏印**: Skills, intuition, religion, non-traditional, profound
- **正官**: Career, status, discipline, responsibility, authority
- **七杀**: Power, challenges, pressure, courage, transformation
- **正财**: Wealth, practicality, stability, wife, moderation
- **偏财**: Opportunities, speculation, social, father, generosity
- **食神**: Expression, enjoyment, creativity, children, optimism
- **伤官**: Rebellion, talent, criticism, innovation, emotions
- **比肩**: Confidence, independence, competition, friends, equality
- **劫财**: Ambition, adventure, social, brothers, rivalry

## Testing

The module includes comprehensive unit tests in `lib/bazi-insights.test.ts`:

```bash
# Run BaZi insights tests
npm test lib/bazi-insights.test.ts

# Run all BaZi-related tests
npm test lib/bazi*.test.ts
```

### Test Coverage

- Day Master calculation and validation
- Ten Gods relationships and strength analysis
- Luck cycle generation and date mapping
- Personality tag generation
- Database format conversion
- Integration tests with real birth dates

## Validation Script

Use the validation script to test with sample birth dates:

```bash
npx tsx scripts/validate-bazi-insights.js
```

This script tests the module with multiple birth dates and validates:
- Day Master calculation
- Ten Gods analysis
- Luck cycles
- Personality tags
- Consistency across calculations

## Backfill Script

For existing charts without insights data, use the backfill script:

```bash
node scripts/backfill-bazi-insights.js
```

This script:
1. Fetches charts without insights data
2. Calculates insights using the new module
3. Updates charts with the new data

## Performance Considerations

- The module uses efficient algorithms for Ten Gods calculation
- Luck cycle generation is optimized for 80-year spans
- Personality tag generation is cached where possible
- Database format conversion minimizes data size

## Future Enhancements

1. **Enhanced Hidden Stems**: More accurate calculation of branch hidden stems
2. **Advanced Luck Cycles**: Support for different luck calculation methods
3. **Seasonal Adjustments**: Consider seasonal factors in analysis
4. **Compatibility Analysis**: Support for relationship compatibility
5. **Time-based Variations**: Different analysis based on time of day

## Error Handling

The module includes comprehensive error handling:
- Invalid input validation
- Graceful degradation for missing data
- Clear error messages for debugging
- Fallback values for edge cases

## Contributing

When modifying the insights module:

1. Update corresponding tests
2. Add new test cases for edge conditions
3. Update documentation
4. Run validation script with sample data
5. Test with real birth dates for accuracy

## Integration with AI Systems

The insights module is designed to work with AI prompt generation:

```typescript
// Generate AI prompt from insights
const prompt = `分析以下八字命盘：
日主：${insights.day_master.stem}（${insights.day_master.element}）
十神强度：${insights.ten_gods.strengths.map(g => `${g.god}:${g.strength}%`).join(', ')}
五行平衡：${insights.ten_gods.balance_score}/100
性格标签：${insights.personality_tags.map(t => t.tag).join(', ')}

请提供详细的性格分析和人生建议。`
```

This structured data enables consistent and accurate AI analysis of BaZi charts.