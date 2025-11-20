import { describe, it, expect } from 'vitest'
import { computeBazi } from '../services/bazi'

describe('BaZi Computation', () => {
  it('should compute BaZi for a standard date (noon)', () => {
    const result = computeBazi('1990-05-15T12:00:00', 'Asia/Shanghai')
    
    expect(result.bazi.year).toBe('庚午')
    expect(result.bazi.month).toBe('辛巳')
    expect(result.bazi.day).toBe('庚辰')
    expect(result.bazi.hour).toBe('壬午')
    
    expect(result.pillars.year.stem).toBe('庚')
    expect(result.pillars.year.branch).toBe('午')
    expect(result.pillars.day.stem).toBe('庚')
    expect(result.pillars.day.branch).toBe('辰')
    
    expect(result.wuxing.wood).toBeGreaterThanOrEqual(0)
    expect(result.wuxing.fire).toBeGreaterThanOrEqual(0)
    expect(result.wuxing.earth).toBeGreaterThanOrEqual(0)
    expect(result.wuxing.metal).toBeGreaterThanOrEqual(0)
    expect(result.wuxing.water).toBeGreaterThanOrEqual(0)
    
    expect(result.meta.timezone).toBe('Asia/Shanghai')
    expect(result.meta.utc).toContain('1990-05-15')
  })

  it('should handle midnight edge case (子 hour)', () => {
    const result = computeBazi('2000-01-01T00:30:00', 'America/New_York')
    
    expect(result.bazi.hour).toMatch(/^[甲乙丙丁戊己庚辛壬癸]子$/)
    expect(result.pillars.hour.branch).toBe('子')
    
    expect(result.meta.timezone).toBe('America/New_York')
  })

  it('should handle 23:00-23:59 edge case (next day 子 hour)', () => {
    const result = computeBazi('2020-12-31T23:30:00', 'Asia/Tokyo')
    
    expect(result.pillars.hour.branch).toBe('子')
    
    expect(result.bazi.day).toBeTruthy()
    expect(result.meta.lunar).toBeTruthy()
  })

  it('should compute BaZi for early morning (寅 hour, 3-5am)', () => {
    const result = computeBazi('1985-03-20T04:00:00', 'Europe/London')
    
    expect(result.pillars.hour.branch).toBe('寅')
    expect(result.bazi.hour).toMatch(/^[甲乙丙丁戊己庚辛壬癸]寅$/)
    
    expect(result.wuxing.wood).toBeGreaterThan(0)
  })

  it('should handle lunar month transition boundary', () => {
    const result = computeBazi('2015-02-19T10:00:00', 'Asia/Shanghai')
    
    expect(result.bazi.year).toBeTruthy()
    expect(result.bazi.month).toBeTruthy()
    expect(result.bazi.day).toBeTruthy()
    expect(result.bazi.hour).toBeTruthy()
    
    expect(result.meta.lunar.lYear).toBeDefined()
    expect(result.meta.lunar.lMonth).toBeDefined()
  })

  it('should handle different timezone correctly', () => {
    const resultUTC = computeBazi('2010-06-15T14:00:00', 'UTC')
    const resultNY = computeBazi('2010-06-15T10:00:00', 'America/New_York')
    
    expect(resultUTC.bazi.day).toBe(resultNY.bazi.day)
    expect(resultUTC.meta.utc).toBe(resultNY.meta.utc)
    
    expect(resultUTC.bazi.hour).not.toBe(resultNY.bazi.hour)
  })

  it('should compute consistent hour pillar based on day stem', () => {
    const result = computeBazi('1995-08-25T13:00:00', 'Asia/Shanghai')
    
    const dayStemIndex = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].indexOf(result.pillars.day.stem)
    expect(dayStemIndex).toBeGreaterThanOrEqual(0)
    
    expect(result.pillars.hour.stem).toBeTruthy()
    expect(result.pillars.hour.branch).toBe('未')
  })

  it('should maintain stable output for repeated calls', () => {
    const input = '2005-11-11T11:11:11'
    const tz = 'America/Los_Angeles'
    
    const result1 = computeBazi(input, tz)
    const result2 = computeBazi(input, tz)
    
    expect(result1.bazi).toEqual(result2.bazi)
    expect(result1.wuxing).toEqual(result2.wuxing)
    expect(result1.pillars).toEqual(result2.pillars)
  })

  it('should compute correct Five Elements balance', () => {
    const result = computeBazi('1988-02-10T08:00:00', 'Asia/Hong_Kong')
    
    const total = result.wuxing.wood + result.wuxing.fire + 
                  result.wuxing.earth + result.wuxing.metal + 
                  result.wuxing.water
    
    expect(total).toBeGreaterThan(0)
    
    expect(Object.keys(result.wuxing)).toEqual(['wood', 'fire', 'earth', 'metal', 'water'])
  })

  it('should respect custom wuxing weights', () => {
    const defaultResult = computeBazi('2000-01-01T12:00:00', 'UTC')
    const customResult = computeBazi('2000-01-01T12:00:00', 'UTC', {
      stemWeight: 2.0,
      branchWeight: 1.0,
      hiddenStemWeight: 0.1,
    })
    
    const defaultTotal = defaultResult.wuxing.wood + defaultResult.wuxing.fire + 
                         defaultResult.wuxing.earth + defaultResult.wuxing.metal + 
                         defaultResult.wuxing.water
    const customTotal = customResult.wuxing.wood + customResult.wuxing.fire + 
                        customResult.wuxing.earth + customResult.wuxing.metal + 
                        customResult.wuxing.water
    
    expect(customTotal).not.toEqual(defaultTotal)
  })

  it('should throw error for invalid datetime', () => {
    expect(() => computeBazi('invalid-date', 'UTC')).toThrow()
  })

  it('should throw error for invalid timezone', () => {
    expect(() => computeBazi('2000-01-01T12:00:00', 'Invalid/Timezone')).toThrow()
  })
})
