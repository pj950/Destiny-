/**
 * BaZi Insights Types
 * 
 * Type definitions for BaZi analysis including Day Master, Ten Gods, and Luck Cycles
 */

export type WuxingElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water'

export type YinYang = 'yin' | 'yang'

export type TenGodName = 
  | '正印' | '偏印'   //印星
  | '正官' | '七杀'   //官杀星  
  | '正财' | '偏财'   //财星
  | '伤官' | '食神'   //食伤星
  | '比肩' | '劫财'   //比劫星

export interface DayMaster {
  stem: string          // 天干字符 (甲, 乙, 丙, ...)
  element: WuxingElement // 五行属性
  yin_yang: YinYang     // 阴阳属性
  keywords: string[]     // 人格关键词
  description: string    // 简短描述
}

export interface TenGodStrength {
  god: TenGodName       // 十神名称
  strength: number      // 0-100 归一化强度
  element: WuxingElement // 对应五行
  relationship: string  // 与日主的关系描述
  influence: string[]   // 影响方面
}

export interface TenGodsAnalysis {
  day_master_stem: string
  relationships: Record<string, TenGodName>  // 按位置映射: year_stem, month_stem, etc.
  strengths: TenGodStrength[]               // 所有十神的强度分析
  dominant_elements: WuxingElement[]        // 主导五行
  weak_elements: WuxingElement[]           // 弱势五行
  balance_score: number                    // 0-100 平衡得分
}

export interface LuckCycle {
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

export interface PersonalityTag {
  tag: string             // 性格标签
  category: string        // 分类: strengths, weaknesses, traits
  confidence: number       // 0-100 置信度
  source: string          // 来源: wuxing, ten_gods, balance
}

export interface BaziInsights {
  day_master: DayMaster
  ten_gods: TenGodsAnalysis
  luck_cycles: LuckCycle[]
  personality_tags: PersonalityTag[]
  analysis_summary: {
    overall_balance: number
    dominant_elements: WuxingElement[]
    key_strengths: string[]
    areas_for_growth: string[]
    favorable_elements: WuxingElement[]
    unfavorable_elements: WuxingElement[]
  }
}

// 用于数据库存储的简化类型
export interface BaziInsightsDB {
  day_master: string
  ten_gods: {
    relationships: Record<string, TenGodName>
    strengths: Array<{
      god: TenGodName
      strength: number
      element: WuxingElement
    }>
  }
  luck_cycles: Array<{
    age_start: number
    age_end: number
    stem: string
    branch: string
    ten_god: TenGodName
  }>
}