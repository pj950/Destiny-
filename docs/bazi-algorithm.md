# BaZi Algorithm Documentation

## Overview

This document describes the BaZi (八字, Eight Characters) calculation algorithm implemented in `lib/bazi.ts`. The algorithm computes the Four Pillars of Destiny based on a person's birth date, time, and timezone, and derives the Five Elements (Wuxing) balance.

## Algorithm Components

### 1. Heavenly Stems (天干, Tiangan)

The 10 Heavenly Stems cycle through in order:

| Index | Character | Element | Yin/Yang |
|-------|-----------|---------|----------|
| 0     | 甲 (Jia)  | Wood    | Yang     |
| 1     | 乙 (Yi)   | Wood    | Yin      |
| 2     | 丙 (Bing) | Fire    | Yang     |
| 3     | 丁 (Ding) | Fire    | Yin      |
| 4     | 戊 (Wu)   | Earth   | Yang     |
| 5     | 己 (Ji)   | Earth   | Yin      |
| 6     | 庚 (Geng) | Metal   | Yang     |
| 7     | 辛 (Xin)  | Metal   | Yin      |
| 8     | 壬 (Ren)  | Water   | Yang     |
| 9     | 癸 (Gui)  | Water   | Yin      |

### 2. Earthly Branches (地支, Dizhi)

The 12 Earthly Branches cycle through in order:

| Index | Character | Element | Hour Range      | Zodiac |
|-------|-----------|---------|-----------------|--------|
| 0     | 子 (Zi)   | Water   | 23:00-01:00     | Rat    |
| 1     | 丑 (Chou) | Earth   | 01:00-03:00     | Ox     |
| 2     | 寅 (Yin)  | Wood    | 03:00-05:00     | Tiger  |
| 3     | 卯 (Mao)  | Wood    | 05:00-07:00     | Rabbit |
| 4     | 辰 (Chen) | Earth   | 07:00-09:00     | Dragon |
| 5     | 巳 (Si)   | Fire    | 09:00-11:00     | Snake  |
| 6     | 午 (Wu)   | Fire    | 11:00-13:00     | Horse  |
| 7     | 未 (Wei)  | Earth   | 13:00-15:00     | Goat   |
| 8     | 申 (Shen) | Metal   | 15:00-17:00     | Monkey |
| 9     | 酉 (You)  | Metal   | 17:00-19:00     | Rooster|
| 10    | 戌 (Xu)   | Earth   | 19:00-21:00     | Dog    |
| 11    | 亥 (Hai)  | Water   | 21:00-23:00     | Pig    |

### 3. Four Pillars Calculation

#### Year Pillar (年柱)
- Calculated from the lunar calendar year
- Uses the `solarlunar` library to convert Gregorian to Lunar
- Important: The year changes at the beginning of Spring (立春), not January 1st

#### Month Pillar (月柱)
- Calculated from the lunar calendar month
- Solar terms determine the exact month boundaries
- Uses the `solarlunar` library for accurate conversion

#### Day Pillar (日柱)
- Calculated from the lunar calendar day
- The day pillar stem is the foundation for hour pillar calculation
- Uses the `solarlunar` library for accurate conversion

#### Hour Pillar (时柱)
- Branch: Determined by the birth hour using 2-hour periods (12 branches for 24 hours)
- Stem: Calculated using the formula: `(dayStemIndex * 2 + hourBranchIndex) % 10`
- Important edge case: The day starts at 23:00 (子 hour) of the previous calendar day

### 4. Hour Calculation Details

The hour branch is determined by:
```
hourIndex = floor((hour + 1) % 24 / 2)
```

This means:
- 23:00-00:59 → 子 (index 0)
- 01:00-02:59 → 丑 (index 1)
- And so on...

The hour stem follows the "Five Rat Formula" (五鼠遁):
```
hourStemIndex = (dayStemIndex * 2 + hourBranchIndex) % 10
```

### 5. Five Elements (Wuxing) Calculation

The Five Elements balance is calculated from all eight characters (4 stems + 4 branches):

#### Element Sources
1. **Visible Stems**: Each pillar's heavenly stem contributes its element
2. **Visible Branches**: Each pillar's earthly branch contributes its element
3. **Hidden Stems**: Each branch contains 1-3 hidden stems that contribute partial elements

#### Hidden Stems (Earthly Branch Roots)
Each earthly branch contains hidden stems that represent its internal energy:
- 子 → 癸
- 丑 → 己, 癸, 辛
- 寅 → 甲, 丙, 戊
- 卯 → 乙
- 辰 → 戊, 乙, 癸
- 巳 → 丙, 戊, 庚
- 午 → 丁, 己
- 未 → 己, 丁, 乙
- 申 → 庚, 壬, 戊
- 酉 → 辛
- 戌 → 戊, 辛, 丁
- 亥 → 壬, 甲

#### Configurable Weights
The Five Elements calculation supports configurable weights:
- `stemWeight` (default: 1.0) - Weight for visible heavenly stems
- `branchWeight` (default: 1.0) - Weight for visible earthly branches
- `hiddenStemWeight` (default: 0.3) - Weight for hidden stems within branches

Multiple hidden stems in a single branch share the weight equally.

#### Output
The wuxing scores are rounded to 1 decimal place and represent the relative strength of each element:
```typescript
{
  wood: number,
  fire: number,
  earth: number,
  metal: number,
  water: number
}
```

## Timezone Handling

The algorithm properly handles timezone conversion:
1. Input datetime is parsed in the specified timezone
2. Calculation uses local time for determining hour, day, month, year
3. UTC timestamp is stored in metadata for reference
4. The same UTC moment in different timezones may result in different hour pillars

## Assumptions and Limitations

### Assumptions
1. **Lunar Calendar**: We rely on the `solarlunar` library (v2.0.7) for solar-to-lunar conversion
2. **Solar Terms**: The library handles solar term boundaries for year and month transitions
3. **Time Zone Data**: We use Luxon's IANA timezone database for accurate timezone conversion
4. **Hour Boundaries**: Traditional 2-hour periods (12 branches) are used for hour calculation

### Limitations
1. **Date Range**: The `solarlunar` library supports dates from 1900 to 2100
2. **Precision**: Hour pillar assumes birth time is known to the hour; minute/second are not considered
3. **Daylight Saving Time**: Handled by Luxon but may affect hour pillar for births near DST transitions
4. **Simplified Wuxing**: The Five Elements calculation is simplified and doesn't account for:
   - Seasonal strength adjustments
   - Complex interactions (generation/destruction cycles)
   - Special combinations or clashes
5. **No Luck Pillars**: This implementation only calculates the birth chart (Four Pillars), not the Luck Pillars (大运)

### Edge Cases Handled
1. **Midnight Boundary**: Births at 23:00-23:59 correctly map to 子 hour (next day in BaZi)
2. **Lunar Month Transitions**: Solar term boundaries are respected for month pillar
3. **Timezone Conversion**: Different timezones with same UTC time produce correct hour pillars
4. **Invalid Input**: Throws descriptive errors for invalid datetimes or timezones

## Testing

The test suite (`lib/bazi.test.ts`) includes:
- Standard daytime births
- Midnight and near-midnight edge cases (子 hour)
- Early morning births (寅 hour)
- Lunar month transition boundaries
- Timezone conversion validation
- Stable/repeatable output verification
- Five Elements balance validation
- Custom weight configuration
- Error handling for invalid inputs

Tests ensure that the algorithm produces stable, repeatable results across environments.

## API Contract

The `computeBazi` function maintains backward compatibility with the existing API:

```typescript
function computeBazi(
  birthISO: string,      // ISO 8601 datetime
  timezone: string,      // IANA timezone name
  wuxingConfig?: {       // Optional configuration
    stemWeight?: number,
    branchWeight?: number,
    hiddenStemWeight?: number
  }
): BaziChart
```

Output structure:
```typescript
{
  bazi: {
    year: string,   // e.g., "庚午"
    month: string,  // e.g., "辛巳"
    day: string,    // e.g., "庚辰"
    hour: string    // e.g., "壬午"
  },
  pillars: {
    year: { stem: string, branch: string, combined: string },
    month: { stem: string, branch: string, combined: string },
    day: { stem: string, branch: string, combined: string },
    hour: { stem: string, branch: string, combined: string }
  },
  wuxing: {
    wood: number,
    fire: number,
    earth: number,
    metal: number,
    water: number
  },
  meta: {
    lunar: any,           // Raw lunar calendar data
    utc: string | null,   // UTC ISO timestamp
    timezone: string      // Input timezone
  }
}
```

## References

1. Traditional BaZi calculation methods
2. Five Rat Formula (五鼠遁) for hour stem derivation
3. Hidden Stems (地支藏干) traditional associations
4. solarlunar library: https://github.com/yize/solarlunar
5. Luxon library: https://moment.github.io/luxon/
