import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculateDayMaster,
  calculateTenGods,
  calculateLuckCycles,
  generatePersonalityTags,
  analyzeBaziInsights,
  toDBFormat,
} from '../services/bazi-insights'
import { computeBazi } from '../services/bazi'

describe('BaZi Insights', () => {
  let testChart: any
  let testChart2: any
  
  beforeEach(() => {
    // 测试用例1: 1990年3月15日 上午10点 (庚午年 己卯月 甲申日 己巳时)
    testChart = computeBazi('1990-03-15T10:00:00', 'Asia/Shanghai')
    
    // 测试用例2: 1985年8月20日 下午3点 (乙丑年 甲申月 丙戌日 丙申时)  
    testChart2 = computeBazi('1985-08-20T15:00:00', 'Asia/Shanghai')
  })

  describe('calculateDayMaster', () => {
    it('should correctly calculate day master attributes for 己 earth', () => {
      const dayMaster = calculateDayMaster(testChart)
      
      expect(dayMaster.stem).toBe('己')
      expect(dayMaster.element).toBe('earth')
      expect(dayMaster.yin_yang).toBe('yin')
      expect(dayMaster.keywords).toContain('温润')
      expect(dayMaster.keywords).toContain('滋养')
      expect(dayMaster.description).toContain('田园之土')
    })

    it('should correctly calculate day master attributes for 辛 metal', () => {
      const dayMaster = calculateDayMaster(testChart2)
      
      expect(dayMaster.stem).toBe('辛')
      expect(dayMaster.element).toBe('metal')
      expect(dayMaster.yin_yang).toBe('yin')
      expect(dayMaster.keywords).toContain('精致')
      expect(dayMaster.keywords).toContain('审美')
      expect(dayMaster.description).toContain('珠宝之金')
    })

    it('should throw error for invalid day stem', () => {
      const invalidChart = {
        ...testChart,
        pillars: {
          ...testChart.pillars,
          day: { stem: 'X', branch: '子', combined: 'X子' }
        }
      }
      
      expect(() => calculateDayMaster(invalidChart)).toThrow('Invalid day stem')
    })
  })

  describe('calculateTenGods', () => {
    it('should correctly calculate ten gods relationships', () => {
      const tenGods = calculateTenGods(testChart)
      
      expect(tenGods.day_master_stem).toBe('己')
      expect(tenGods.relationships.year_stem).toBeDefined()
      expect(tenGods.relationships.month_stem).toBeDefined()
      expect(tenGods.relationships.day_stem).toBe('比肩') // 己见己为比肩
      expect(tenGods.relationships.hour_stem).toBeDefined()
    })

    it('should calculate ten gods with correct strengths', () => {
      const tenGods = calculateTenGods(testChart)
      
      expect(tenGods.strengths.length).toBeGreaterThanOrEqual(4) // 至少有4个十神（天干）
      expect(tenGods.strengths[0].strength).toBeGreaterThanOrEqual(0)
      expect(tenGods.strengths[0].strength).toBeLessThanOrEqual(100)
      expect(tenGods.strengths[0].god).toBeDefined()
      expect(tenGods.strengths[0].element).toBeDefined()
      expect(tenGods.strengths[0].influence).toBeDefined()
      expect(tenGods.strengths[0].relationship).toBeDefined()
    })

    it('should sort strengths by descending order', () => {
      const tenGods = calculateTenGods(testChart)
      
      for (let i = 0; i < tenGods.strengths.length - 1; i++) {
        expect(tenGods.strengths[i].strength).toBeGreaterThanOrEqual(tenGods.strengths[i + 1].strength)
      }
    })

    it('should identify dominant and weak elements', () => {
      const tenGods = calculateTenGods(testChart)
      
      expect(tenGods.dominant_elements).toHaveLength(2)
      expect(tenGods.weak_elements).toHaveLength(2)
      expect(tenGods.dominant_elements[0]).toBeDefined()
      expect(tenGods.weak_elements[0]).toBeDefined()
    })

    it('should calculate balance score between 0 and 100', () => {
      const tenGods = calculateTenGods(testChart)
      
      expect(tenGods.balance_score).toBeGreaterThanOrEqual(0)
      expect(tenGods.balance_score).toBeLessThanOrEqual(100)
    })
  })

  describe('calculateLuckCycles', () => {
    it('should generate correct number of luck cycles', () => {
      const cycles = calculateLuckCycles(testChart, 1990)
      
      expect(cycles).toHaveLength(8) // 8个十年大运
    })

    it('should have correct age ranges', () => {
      const cycles = calculateLuckCycles(testChart, 1990)
      
      expect(cycles[0].age_start).toBe(8) // 起运年龄8岁
      expect(cycles[0].age_end).toBe(17)
      expect(cycles[1].age_start).toBe(18)
      expect(cycles[1].age_end).toBe(27)
    })

    it('should have correct gregorian years', () => {
      const cycles = calculateLuckCycles(testChart, 1990)
      
      expect(cycles[0].gregorian_start).toBe(1998) // 1990 + 8
      expect(cycles[0].gregorian_end).toBe(2007)   // 1990 + 17
    })

    it('should have valid stem-branch combinations', () => {
      const cycles = calculateLuckCycles(testChart, 1990)
      
      cycles.forEach(cycle => {
        expect(cycle.stem).toMatch(/^[甲乙丙丁戊己庚辛壬癸]$/)
        expect(cycle.branch).match(/^[子丑寅卯辰巳午未申酉戌亥]$/)
        expect(cycle.combined).toBe(cycle.stem + cycle.branch)
        expect(cycle.element).toBeDefined()
        expect(cycle.ten_god).toBeDefined()
      })
    })

    it('should have proper influence and description', () => {
      const cycles = calculateLuckCycles(testChart, 1990)
      
      cycles.forEach(cycle => {
        expect(cycle.influence).toContain(cycle.ten_god)
        expect(cycle.influence).toContain(cycle.element)
        expect(cycle.description).toContain(cycle.age_start.toString())
        expect(cycle.description).toContain(cycle.age_end.toString())
        expect(cycle.description).toContain(cycle.gregorian_start.toString())
        expect(cycle.description).toContain(cycle.gregorian_end.toString())
      })
    })
  })

  describe('generatePersonalityTags', () => {
    it('should generate tags from day master', () => {
      const dayMaster = calculateDayMaster(testChart)
      const tenGods = calculateTenGods(testChart)
      const tags = generatePersonalityTags(dayMaster, tenGods, testChart.wuxing)
      
      expect(tags.some(tag => tag.tag === '温润')).toBe(true)
      expect(tags.some(tag => tag.source === 'day_master')).toBe(true)
    })

    it('should generate tags from ten gods', () => {
      const dayMaster = calculateDayMaster(testChart)
      const tenGods = calculateTenGods(testChart)
      const tags = generatePersonalityTags(dayMaster, tenGods, testChart.wuxing)
      
      expect(tags.some(tag => tag.source === 'ten_gods')).toBe(true)
      expect(tags.some(tag => tag.category === 'strengths')).toBe(true)
    })

    it('should generate balance-related tags', () => {
      const dayMaster = calculateDayMaster(testChart)
      const tenGods = calculateTenGods(testChart)
      
      // 修改平衡分数来测试不同情况
      const unbalancedTenGods = { ...tenGods, balance_score: 25 }
      const tags = generatePersonalityTags(dayMaster, unbalancedTenGods, testChart.wuxing)
      
      expect(tags.some(tag => tag.tag === '需要调候')).toBe(true)
      expect(tags.some(tag => tag.source === 'balance')).toBe(true)
    })

    it('should generate element-based tags', () => {
      const dayMaster = calculateDayMaster(testChart)
      const tenGods = calculateTenGods(testChart)
      const tags = generatePersonalityTags(dayMaster, tenGods, testChart.wuxing)
      
      expect(tags.some(tag => tag.source === 'wuxing')).toBe(true)
      expect(tags.some(tag => tag.category === 'traits')).toBe(true)
    })

    it('should have valid tag structure', () => {
      const dayMaster = calculateDayMaster(testChart)
      const tenGods = calculateTenGods(testChart)
      const tags = generatePersonalityTags(dayMaster, tenGods, testChart.wuxing)
      
      tags.forEach(tag => {
        expect(tag.tag).toBeDefined()
        expect(tag.category).toMatch(/^(strengths|weaknesses|traits)$/)
        expect(tag.confidence).toBeGreaterThanOrEqual(0)
        expect(tag.confidence).toBeLessThanOrEqual(100)
        expect(tag.source).toMatch(/^(day_master|ten_gods|balance|wuxing)$/)
      })
    })
  })

  describe('analyzeBaziInsights', () => {
    it('should generate complete insights analysis', () => {
      const insights = analyzeBaziInsights(testChart, 1990)
      
      expect(insights.day_master).toBeDefined()
      expect(insights.ten_gods).toBeDefined()
      expect(insights.luck_cycles).toBeDefined()
      expect(insights.personality_tags).toBeDefined()
      expect(insights.analysis_summary).toBeDefined()
    })

    it('should have correct analysis summary structure', () => {
      const insights = analyzeBaziInsights(testChart, 1990)
      
      const { analysis_summary } = insights
      expect(analysis_summary.overall_balance).toBeGreaterThanOrEqual(0)
      expect(analysis_summary.overall_balance).toBeLessThanOrEqual(100)
      expect(analysis_summary.dominant_elements).toHaveLength(2)
      expect(analysis_summary.key_strengths).toBeInstanceOf(Array)
      expect(analysis_summary.areas_for_growth).toBeInstanceOf(Array)
      expect(analysis_summary.favorable_elements).toHaveLength(2)
      expect(analysis_summary.unfavorable_elements).toHaveLength(2)
    })

    it('should produce consistent results for same input', () => {
      const insights1 = analyzeBaziInsights(testChart, 1990)
      const insights2 = analyzeBaziInsights(testChart, 1990)
      
      expect(insights1.day_master.stem).toBe(insights2.day_master.stem)
      expect(insights1.ten_gods.day_master_stem).toBe(insights2.ten_gods.day_master_stem)
      expect(insights1.luck_cycles).toHaveLength(insights2.luck_cycles.length)
    })

    it('should produce different results for different inputs', () => {
      const insights1 = analyzeBaziInsights(testChart, 1990)
      const insights2 = analyzeBaziInsights(testChart2, 1985)
      
      expect(insights1.day_master.stem).not.toBe(insights2.day_master.stem)
      expect(insights1.ten_gods.day_master_stem).not.toBe(insights2.ten_gods.day_master_stem)
    })
  })

  describe('toDBFormat', () => {
    it('should convert insights to database format', () => {
      const insights = analyzeBaziInsights(testChart, 1990)
      const dbFormat = toDBFormat(insights)
      
      expect(dbFormat.day_master).toBe(insights.day_master.stem)
      expect(dbFormat.ten_gods.relationships).toEqual(insights.ten_gods.relationships)
      expect(dbFormat.ten_gods.strengths).toHaveLength(insights.ten_gods.strengths.length)
      expect(dbFormat.luck_cycles).toHaveLength(insights.luck_cycles.length)
    })

    it('should have correct DB format structure', () => {
      const insights = analyzeBaziInsights(testChart, 1990)
      const dbFormat = toDBFormat(insights)
      
      dbFormat.ten_gods.strengths.forEach(strength => {
        expect(strength.god).toBeDefined()
        expect(strength.strength).toBeGreaterThanOrEqual(0)
        expect(strength.strength).toBeLessThanOrEqual(100)
        expect(strength.element).toBeDefined()
      })
      
      dbFormat.luck_cycles.forEach(cycle => {
        expect(cycle.age_start).toBeGreaterThanOrEqual(0)
        expect(cycle.age_end).toBeGreaterThan(cycle.age_start)
        expect(cycle.stem).toMatch(/^[甲乙丙丁戊己庚辛壬癸]$/)
        expect(cycle.branch).match(/^[子丑寅卯辰巳午未申酉戌亥]$/)
        expect(cycle.ten_god).toBeDefined()
      })
    })
  })

  describe('Integration Tests', () => {
    it('should handle real birth date correctly', () => {
      const insights = analyzeBaziInsights(testChart, 1990)
      
      // 验证日主计算
      expect(insights.day_master.stem).toBe('己')
      expect(insights.day_master.element).toBe('earth')
      
      // 验证十神计算
      expect(insights.ten_gods.relationships.day_stem).toBe('比肩')
      
      // 验证大运计算
      expect(insights.luck_cycles[0].age_start).toBe(8)
      expect(insights.luck_cycles[0].gregorian_start).toBe(1998)
      
      // 验证性格标签
      expect(insights.personality_tags.length).toBeGreaterThan(0)
      expect(insights.personality_tags.some(tag => tag.tag === '温润')).toBe(true)
    })

    it('should maintain consistency across multiple calculations', () => {
      const results = []
      
      for (let i = 0; i < 5; i++) {
        const insights = analyzeBaziInsights(testChart, 1990)
        results.push({
          day_master: insights.day_master.stem,
          first_luck_cycle: insights.luck_cycles[0].combined,
          balance_score: insights.ten_gods.balance_score
        })
      }
      
      // 所有结果应该相同
      const first = results[0]
      results.forEach(result => {
        expect(result.day_master).toBe(first.day_master)
        expect(result.first_luck_cycle).toBe(first.first_luck_cycle)
        expect(result.balance_score).toBe(first.balance_score)
      })
    })
  })
})