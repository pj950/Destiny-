import { BaziChart, WuxingScores } from './bazi'
import { 
  DayMaster, 
  TenGodsAnalysis, 
  TenGodStrength, 
  TenGodName,
  LuckCycle,
  PersonalityTag,
  BaziInsights,
  WuxingElement,
  YinYang,
  BaziInsightsDB
} from '../types/bazi-insights'

// 天干属性
const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

// 天干五行属性
const STEM_ELEMENTS: Record<string, WuxingElement> = {
  '甲': 'wood', '乙': 'wood',
  '丙': 'fire', '丁': 'fire', 
  '戊': 'earth', '己': 'earth',
  '庚': 'metal', '辛': 'metal',
  '壬': 'water', '癸': 'water',
}

// 天干阴阳属性
const STEM_YIN_YANG: Record<string, YinYang> = {
  '甲': 'yang', '乙': 'yin',
  '丙': 'yang', '丁': 'yin',
  '戊': 'yang', '己': 'yin', 
  '庚': 'yang', '辛': 'yin',
  '壬': 'yang', '癸': 'yin',
}

// 日主人格关键词
const DAY_MASTER_KEYWORDS: Record<string, { keywords: string[], description: string }> = {
  '甲': { 
    keywords: ['领导力', '开拓', '正直', '积极', '目标导向'], 
    description: '如参天大树，向上生长，具有领导才能和开拓精神' 
  },
  '乙': { 
    keywords: ['柔韧', '适应', '艺术', '敏感', '合作'], 
    description: '如花草藤蔓，柔韧适应，具有艺术气质和合作精神' 
  },
  '丙': { 
    keywords: ['热情', '慷慨', '表达', '乐观', '影响力'], 
    description: '如太阳之火，热情光明，具有强烈的表现欲和影响力' 
  },
  '丁': { 
    keywords: ['细致', '温暖', '思考', '神秘', '内敛'], 
    description: '如烛光之火，温暖细致，具有思考深度和神秘感' 
  },
  '戊': { 
    keywords: ['稳重', '诚信', '包容', '传统', '责任感'], 
    description: '如大地之土，稳重包容，具有诚信和强烈的责任感' 
  },
  '己': { 
    keywords: ['温润', '滋养', '务实', '耐心', '协调'], 
    description: '如田园之土，温润滋养，具有务实精神和协调能力' 
  },
  '庚': { 
    keywords: ['果断', '刚毅', '正义', '变革', '执行力'], 
    description: '如刀剑之金，刚毅果断，具有正义感和强大的执行力' 
  },
  '辛': { 
    keywords: ['精致', '审美', '创新', '敏感', '完美主义'], 
    description: '如珠宝之金，精致华美，具有审美能力和创新精神' 
  },
  '壬': { 
    keywords: ['智慧', '流动', '包容', '适应', '洞察力'], 
    description: '如江河之水，智慧流动，具有强大的适应力和洞察力' 
  },
  '癸': { 
    keywords: ['温柔', '直觉', '同情', '内省', '治愈力'], 
    description: '如雨露之水，温柔滋润，具有强烈的直觉和治愈能力' 
  },
}

// 十神关系映射
function getTenGod(dayMasterStem: string, targetStem: string): TenGodName {
  const dayElement = STEM_ELEMENTS[dayMasterStem]
  const targetElement = STEM_ELEMENTS[targetStem]
  const dayYinYang = STEM_YIN_YANG[dayMasterStem]
  const targetYinYang = STEM_YIN_YANG[targetStem]

  // 相同五行（比劫）
  if (dayElement === targetElement) {
    return dayYinYang === targetYinYang ? '比肩' : '劫财'
  }

  // 五行相生关系
  const generates: Record<string, string> = {
    'wood': 'fire',    // 木生火
    'fire': 'earth',    // 火生土
    'earth': 'metal',   // 土生金
    'metal': 'water',   // 金生水
    'water': 'wood'     // 水生木
  }

  // 五行相克关系
  const overcomes: Record<string, string> = {
    'wood': 'earth',    // 木克土
    'fire': 'metal',    // 火克金
    'earth': 'water',   // 土克水
    'metal': 'wood',    // 金克木
    'water': 'fire'     // 水克火
  }

  // 生我者（印星）
  if (generates[targetElement] === dayElement) {
    return dayYinYang === targetYinYang ? '正印' : '偏印'
  }

  // 我生者（食伤）
  if (generates[dayElement] === targetElement) {
    return dayYinYang === targetYinYang ? '食神' : '伤官'
  }

  // 克我者（官杀）
  if (overcomes[targetElement] === dayElement) {
    return dayYinYang === targetYinYang ? '正官' : '七杀'
  }

  // 我克者（财星）
  if (overcomes[dayElement] === targetElement) {
    return dayYinYang === targetYinYang ? '正财' : '偏财'
  }

  throw new Error(`Unable to determine Ten God relationship for ${dayMasterStem} -> ${targetStem}`)
}

// 十神影响描述
const TEN_GOD_INFLUENCE: Record<TenGodName, { influence: string[], relationship: string }> = {
  '正印': { 
    influence: ['学习', '名誉', '贵人', '母爱', '安全感'], 
    relationship: '生我者为正印，代表学习、名誉和贵人相助' 
  },
  '偏印': { 
    influence: ['技艺', '直觉', '宗教', '非传统', '深刻'], 
    relationship: '生我者为偏印，代表特殊技艺、直觉和非传统思维' 
  },
  '正官': { 
    influence: ['事业', '地位', '纪律', '责任', '威严'], 
    relationship: '克我者为正官，代表事业、地位和自我约束' 
  },
  '七杀': { 
    influence: ['权力', '挑战', '压力', '勇气', '变革'], 
    relationship: '克我者为七杀，代表权力、挑战和面对压力的勇气' 
  },
  '正财': { 
    influence: ['财富', '务实', '稳定', '妻子', '节制'], 
    relationship: '我克者为正财，代表正当财富、务实和稳定' 
  },
  '偏财': { 
    influence: ['机会', '投机', '社交', '父亲', '慷慨'], 
    relationship: '我克者为偏财，代表意外之财、机会和社交能力' 
  },
  '食神': { 
    influence: ['表达', '享受', '创造', '子女', '乐观'], 
    relationship: '我生者为食神，代表表达能力、享受生活和创造力' 
  },
  '伤官': { 
    influence: ['叛逆', '才华', '批判', '创新', '情感'], 
    relationship: '我生者为伤官，代表才华、批判精神和叛逆性格' 
  },
  '比肩': { 
    influence: ['自信', '独立', '竞争', '朋友', '平等'], 
    relationship: '同我为比肩，代表自信、独立和同辈关系' 
  },
  '劫财': { 
    influence: ['野心', '冒险', '社交', '兄弟', '争夺'], 
    relationship: '同我为劫财，代表野心、冒险和同辈竞争' 
  },
}

// 计算日主属性
export function calculateDayMaster(chart: BaziChart): DayMaster {
  const dayStem = chart.pillars.day.stem
  
  if (!dayStem || !DAY_MASTER_KEYWORDS[dayStem]) {
    throw new Error(`Invalid day stem: ${dayStem}`)
  }

  const keywords = DAY_MASTER_KEYWORDS[dayStem]
  
  return {
    stem: dayStem,
    element: STEM_ELEMENTS[dayStem],
    yin_yang: STEM_YIN_YANG[dayStem],
    keywords: keywords.keywords,
    description: keywords.description
  }
}

// 计算十神分析
export function calculateTenGods(chart: BaziChart): TenGodsAnalysis {
  const dayStem = chart.pillars.day.stem
  
  // 计算各位置的十神关系
  const relationships: Record<string, TenGodName> = {}
  
  relationships.year_stem = getTenGod(dayStem, chart.pillars.year.stem)
  relationships.month_stem = getTenGod(dayStem, chart.pillars.month.stem)
  relationships.day_stem = getTenGod(dayStem, chart.pillars.day.stem) // 通常是比肩或劫财
  relationships.hour_stem = getTenGod(dayStem, chart.pillars.hour.stem)

  // 计算十神强度
  const godCounts: Record<TenGodName, number> = {
    '正印': 0,
    '偏印': 0,
    '正官': 0,
    '七杀': 0,
    '正财': 0,
    '偏财': 0,
    '食神': 0,
    '伤官': 0,
    '比肩': 0,
    '劫财': 0
  }
  const godElements: Record<TenGodName, WuxingElement> = {
    '正印': STEM_ELEMENTS[dayStem],
    '偏印': STEM_ELEMENTS[dayStem],
    '正官': STEM_ELEMENTS[dayStem],
    '七杀': STEM_ELEMENTS[dayStem],
    '正财': STEM_ELEMENTS[dayStem],
    '偏财': STEM_ELEMENTS[dayStem],
    '食神': STEM_ELEMENTS[dayStem],
    '伤官': STEM_ELEMENTS[dayStem],
    '比肩': STEM_ELEMENTS[dayStem],
    '劫财': STEM_ELEMENTS[dayStem]
  }
  
  // 统计天干的十神
  Object.values(relationships).forEach(god => {
    godCounts[god] = (godCounts[god] || 0) + 1
    if (!godElements[god]) {
      godElements[god] = STEM_ELEMENTS[dayStem]
    }
  })

  // 考虑地支藏干的十神（简化处理）
  Object.values(chart.pillars).forEach(pillar => {
    // 这里简化处理，实际应该根据地支藏干表
    // 暂时根据地支五行属性给一个代表性的天干
    let representativeStem = ''
    switch (pillar.branch) {
      case '子': representativeStem = '癸'; break
      case '丑': case '辰': case '未': case '戌': representativeStem = '戊'; break
      case '寅': case '卯': representativeStem = '甲'; break
      case '巳': case '午': representativeStem = '丙'; break
      case '申': case '酉': representativeStem = '庚'; break
      case '亥': representativeStem = '壬'; break
    }
    
    if (representativeStem) {
      const god = getTenGod(dayStem, representativeStem)
      godCounts[god] = (godCounts[god] || 0) + 0.5 // 地支权重减半
    }
  })

  // 计算强度得分（0-100归一化）
  const totalStrength = Object.values(godCounts).reduce((sum, count) => sum + count, 0)
  const strengths: TenGodStrength[] = []
  
  Object.entries(godCounts).forEach(([god, count]) => {
    const strength = totalStrength > 0 ? Math.round((count / totalStrength) * 100) : 0
    const influence = TEN_GOD_INFLUENCE[god as TenGodName]
    
    strengths.push({
      god: god as TenGodName,
      strength,
      element: godElements[god as TenGodName] || 'wood',
      relationship: influence.relationship,
      influence: influence.influence
    })
  })

  // 按强度排序
  strengths.sort((a, b) => b.strength - a.strength)

  // 分析主导和弱势五行
  const elementScores: Record<WuxingElement, number> = {
    wood: chart.wuxing.wood,
    fire: chart.wuxing.fire,
    earth: chart.wuxing.earth,
    metal: chart.wuxing.metal,
    water: chart.wuxing.water
  }

  const sortedElements = Object.entries(elementScores)
    .sort(([,a], [,b]) => b - a)
    .map(([element]) => element as WuxingElement)

  const dominantElements = sortedElements.slice(0, 2)
  const weakElements = sortedElements.slice(-2)

  // 计算平衡得分
  const avgScore = Object.values(elementScores).reduce((sum, score) => sum + score, 0) / 5
  const variance = Object.values(elementScores).reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / 5
  const balanceScore = Math.max(0, Math.min(100, 100 - variance * 10))

  return {
    day_master_stem: dayStem,
    relationships,
    strengths,
    dominant_elements: dominantElements,
    weak_elements: weakElements,
    balance_score: Math.round(balanceScore)
  }
}

// 计算大运
export function calculateLuckCycles(chart: BaziChart, birthYear: number): LuckCycle[] {
  const yearStemIndex = HEAVENLY_STEMS.indexOf(chart.pillars.year.stem)
  const monthBranchIndex = EARTHLY_BRANCHES.indexOf(chart.pillars.month.branch)
  
  // 性别决定起运年龄和顺逆（简化处理，实际需要根据年干阴阳和性别）
  const isMale = true // 简化处理，实际需要从profile获取
  const yearStemYinYang = STEM_YIN_YANG[chart.pillars.year.stem]
  
  // 阳年男或阴年女顺行，阴年男或阳年女逆行
  const isForward = (yearStemYinYang === 'yang' && isMale) || (yearStemYinYang === 'yin' && !isMale)
  
  // 起运年龄（简化处理，实际需要精确计算）
  const startAge = 8 // 简化处理
  
  const cycles: LuckCycle[] = []
  let currentStemIndex = yearStemIndex
  let currentBranchIndex = monthBranchIndex
  
  for (let i = 0; i < 8; i++) { // 生成8个大运（80年）
    const ageStart = startAge + (i * 10)
    const ageEnd = ageStart + 9
    const gregorianStart = birthYear + ageStart
    const gregorianEnd = birthYear + ageEnd
    
    // 顺行或逆行
    if (isForward) {
      currentStemIndex = (currentStemIndex + 1) % 10
      currentBranchIndex = (currentBranchIndex + 1) % 12
    } else {
      currentStemIndex = (currentStemIndex - 1 + 10) % 10
      currentBranchIndex = (currentBranchIndex - 1 + 12) % 12
    }
    
    const stem = HEAVENLY_STEMS[currentStemIndex]
    const branch = EARTHLY_BRANCHES[currentBranchIndex]
    const combined = stem + branch
    const element = STEM_ELEMENTS[stem]
    const tenGod = getTenGod(chart.pillars.day.stem, stem)
    
    cycles.push({
      age_start: ageStart,
      age_end: ageEnd,
      gregorian_start: gregorianStart,
      gregorian_end: gregorianEnd,
      stem,
      branch,
      combined,
      element,
      ten_god: tenGod,
      influence: `${tenGod}主导的${element}运，影响个人发展和机遇`,
      description: `${ageStart}-${ageEnd}岁（${gregorianStart}-${gregorianEnd}年）行${combined}大运，${element}旺盛，${tenGod}当令。`
    })
  }
  
  return cycles
}

// 生成性格标签
export function generatePersonalityTags(
  dayMaster: DayMaster, 
  tenGods: TenGodsAnalysis, 
  wuxing: WuxingScores
): PersonalityTag[] {
  const tags: PersonalityTag[] = []
  
  // 基于日主的标签
  dayMaster.keywords.forEach(keyword => {
    tags.push({
      tag: keyword,
      category: 'traits',
      confidence: 85,
      source: 'day_master'
    })
  })
  
  // 基于十神的标签
  tenGods.strengths.slice(0, 3).forEach(({ god, strength, influence }) => {
    influence.slice(0, 2).forEach(keyword => {
      tags.push({
        tag: keyword,
        category: strength > 30 ? 'strengths' : 'traits',
        confidence: Math.min(95, 60 + strength),
        source: 'ten_gods'
      })
    })
  })
  
  // 基于五行平衡的标签
  if (tenGods.balance_score > 70) {
    tags.push({
      tag: '五行均衡',
      category: 'strengths',
      confidence: tenGods.balance_score,
      source: 'balance'
    })
  } else if (tenGods.balance_score < 30) {
    tags.push({
      tag: '需要调候',
      category: 'weaknesses', 
      confidence: 100 - tenGods.balance_score,
      source: 'balance'
    })
  }
  
  // 基于主导五行的标签
  tenGods.dominant_elements.forEach(element => {
    const elementTags: Record<WuxingElement, string> = {
      wood: '富有生机',
      fire: '热情积极', 
      earth: '稳重踏实',
      metal: '果断坚毅',
      water: '智慧灵活'
    }
    
    tags.push({
      tag: elementTags[element],
      category: 'traits',
      confidence: 70,
      source: 'wuxing'
    })
  })
  
  return tags
}

// 主要分析函数
export function analyzeBaziInsights(chart: BaziChart, birthYear: number): BaziInsights {
  const dayMaster = calculateDayMaster(chart)
  const tenGods = calculateTenGods(chart)
  const luckCycles = calculateLuckCycles(chart, birthYear)
  const personalityTags = generatePersonalityTags(dayMaster, tenGods, chart.wuxing)
  
  // 生成分析摘要
  const keyStrengths = personalityTags
    .filter(tag => tag.category === 'strengths')
    .slice(0, 3)
    .map(tag => tag.tag)
  
  const areasForGrowth = personalityTags
    .filter(tag => tag.category === 'weaknesses') 
    .slice(0, 3)
    .map(tag => tag.tag)
  
  const analysisSummary = {
    overall_balance: tenGods.balance_score,
    dominant_elements: tenGods.dominant_elements,
    key_strengths: keyStrengths,
    areas_for_growth: areasForGrowth,
    favorable_elements: tenGods.dominant_elements.slice(0, 2),
    unfavorable_elements: tenGods.weak_elements.slice(0, 2)
  }
  
  return {
    day_master: dayMaster,
    ten_gods: tenGods,
    luck_cycles: luckCycles,
    personality_tags: personalityTags,
    analysis_summary: analysisSummary
  }
}

// 转换为数据库存储格式
export function toDBFormat(insights: BaziInsights): BaziInsightsDB {
  return {
    day_master: insights.day_master.stem,
    ten_gods: {
      relationships: insights.ten_gods.relationships,
      strengths: insights.ten_gods.strengths.map(({ god, strength, element }) => ({
        god,
        strength,
        element
      }))
    },
    luck_cycles: insights.luck_cycles.map(({
      age_start, age_end, stem, branch, ten_god
    }) => ({
      age_start,
      age_end,
      stem,
      branch,
      ten_god
    }))
  }
}