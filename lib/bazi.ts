import { DateTime } from 'luxon'
import solarlunar from 'solarlunar'

const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

const STEM_ELEMENTS: Record<string, string> = {
  '甲': 'wood', '乙': 'wood',
  '丙': 'fire', '丁': 'fire',
  '戊': 'earth', '己': 'earth',
  '庚': 'metal', '辛': 'metal',
  '壬': 'water', '癸': 'water',
}

const BRANCH_ELEMENTS: Record<string, string> = {
  '寅': 'wood', '卯': 'wood',
  '巳': 'fire', '午': 'fire',
  '辰': 'earth', '戌': 'earth', '丑': 'earth', '未': 'earth',
  '申': 'metal', '酉': 'metal',
  '亥': 'water', '子': 'water',
}

const HIDDEN_STEMS: Record<string, string[]> = {
  '子': ['癸'],
  '丑': ['己', '癸', '辛'],
  '寅': ['甲', '丙', '戊'],
  '卯': ['乙'],
  '辰': ['戊', '乙', '癸'],
  '巳': ['丙', '戊', '庚'],
  '午': ['丁', '己'],
  '未': ['己', '丁', '乙'],
  '申': ['庚', '壬', '戊'],
  '酉': ['辛'],
  '戌': ['戊', '辛', '丁'],
  '亥': ['壬', '甲'],
}

export interface BaziPillar {
  stem: string
  branch: string
  combined: string
}

export interface WuxingScores {
  wood: number
  fire: number
  earth: number
  metal: number
  water: number
}

export interface BaziChart {
  bazi: {
    year: string
    month: string
    day: string
    hour: string
  }
  pillars: {
    year: BaziPillar
    month: BaziPillar
    day: BaziPillar
    hour: BaziPillar
  }
  wuxing: WuxingScores
  meta: {
    lunar: any
    utc: string | null
    timezone: string
  }
}

export interface WuxingConfig {
  stemWeight?: number
  branchWeight?: number
  hiddenStemWeight?: number
}

function getHourBranch(hour: number): string {
  const hourIndex = Math.floor(((hour + 1) % 24) / 2)
  return EARTHLY_BRANCHES[hourIndex]
}

function getHourStem(dayStemIndex: number, hour: number): string {
  const hourBranchIndex = Math.floor(((hour + 1) % 24) / 2)
  const hourStemIndex = (dayStemIndex * 2 + hourBranchIndex) % 10
  return HEAVENLY_STEMS[hourStemIndex]
}

function parsePillar(ganZhiStr: string): BaziPillar {
  if (!ganZhiStr || ganZhiStr.length < 2) {
    return { stem: '甲', branch: '子', combined: '甲子' }
  }
  return {
    stem: ganZhiStr[0],
    branch: ganZhiStr[1],
    combined: ganZhiStr,
  }
}

function computeWuxing(
  yearPillar: BaziPillar,
  monthPillar: BaziPillar,
  dayPillar: BaziPillar,
  hourPillar: BaziPillar,
  config: WuxingConfig = {}
): WuxingScores {
  const {
    stemWeight = 1.0,
    branchWeight = 1.0,
    hiddenStemWeight = 0.3,
  } = config

  const counts: Record<string, number> = {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  }

  const pillars = [yearPillar, monthPillar, dayPillar, hourPillar]

  for (const pillar of pillars) {
    const stemElement = STEM_ELEMENTS[pillar.stem]
    if (stemElement) {
      counts[stemElement] += stemWeight
    }

    const branchElement = BRANCH_ELEMENTS[pillar.branch]
    if (branchElement) {
      counts[branchElement] += branchWeight
    }

    const hiddenStems = HIDDEN_STEMS[pillar.branch] || []
    for (const hiddenStem of hiddenStems) {
      const hiddenElement = STEM_ELEMENTS[hiddenStem]
      if (hiddenElement) {
        counts[hiddenElement] += hiddenStemWeight / hiddenStems.length
      }
    }
  }

  return {
    wood: Math.round(counts.wood * 10) / 10,
    fire: Math.round(counts.fire * 10) / 10,
    earth: Math.round(counts.earth * 10) / 10,
    metal: Math.round(counts.metal * 10) / 10,
    water: Math.round(counts.water * 10) / 10,
  }
}

export function computeBazi(
  birthISO: string,
  timezone: string,
  wuxingConfig?: WuxingConfig
): BaziChart {
  const dt = DateTime.fromISO(birthISO, { zone: timezone })
  
  if (!dt.isValid) {
    throw new Error(`Invalid ISO datetime or timezone: ${birthISO}, ${timezone}`)
  }

  const year = dt.year
  const month = dt.month
  const day = dt.day
  const hour = dt.hour

  const lunar = solarlunar.solar2lunar(year, month, day)

  if (!lunar || !lunar.gzYear || !lunar.gzMonth || !lunar.gzDay) {
    throw new Error(`Failed to compute lunar calendar for ${year}-${month}-${day}`)
  }

  const yearPillar = parsePillar(lunar.gzYear)
  const monthPillar = parsePillar(lunar.gzMonth)
  const dayPillar = parsePillar(lunar.gzDay)

  const dayStemIndex = HEAVENLY_STEMS.indexOf(dayPillar.stem)
  if (dayStemIndex === -1) {
    throw new Error(`Invalid day stem: ${dayPillar.stem}`)
  }

  const hourStem = getHourStem(dayStemIndex, hour)
  const hourBranch = getHourBranch(hour)
  const hourPillar: BaziPillar = {
    stem: hourStem,
    branch: hourBranch,
    combined: hourStem + hourBranch,
  }

  const wuxing = computeWuxing(yearPillar, monthPillar, dayPillar, hourPillar, wuxingConfig)

  return {
    bazi: {
      year: yearPillar.combined,
      month: monthPillar.combined,
      day: dayPillar.combined,
      hour: hourPillar.combined,
    },
    pillars: {
      year: yearPillar,
      month: monthPillar,
      day: dayPillar,
      hour: hourPillar,
    },
    wuxing,
    meta: {
      lunar,
      utc: dt.toUTC().toISO(),
      timezone,
    },
  }
}
