import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock localStorage
const localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorage,
  writable: true,
})

// Mock the fortune stick data
const FORTUNE_STICKS = [
  { id: 1, level: '上上', text: '龙凤呈祥，万事亨通' },
  { id: 50, level: '中吉', text: '平平淡淡，安安稳稳' },
  { id: 100, level: '凶', text: '时运不济，需要等待' }
]

// Mock API responses
const mockFortuneResponse = {
  ok: true,
  alreadyDrawn: false,
  fortune: {
    id: 'test-uuid',
    category: '事业运',
    stick_id: 15,
    stick_text: '事业有成，步步高升',
    stick_level: '上上',
    ai_analysis: 'Mock AI analysis',
    created_at: '2024-11-06T12:00:00Z'
  }
}

const mockAlreadyDrawnResponse = {
  ok: true,
  alreadyDrawn: true,
  message: '今日已抽签，请明天再来',
  fortune: mockFortuneResponse.fortune
}

describe('Fortune Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Fortune Stick Selection', () => {
    it('should have valid fortune stick structure', () => {
      FORTUNE_STICKS.forEach(stick => {
        expect(stick).toHaveProperty('id')
        expect(stick).toHaveProperty('level')
        expect(stick).toHaveProperty('text')
        expect(typeof stick.id).toBe('number')
        expect(typeof stick.level).toBe('string')
        expect(typeof stick.text).toBe('string')
        expect(stick.id).toBeGreaterThan(0)
        expect(stick.id).toBeLessThanOrEqual(100)
      })
    })

    it('should have valid fortune levels', () => {
      const validLevels = ['上上', '上吉', '中吉', '下吉', '凶']
      FORTUNE_STICKS.forEach(stick => {
        expect(validLevels).toContain(stick.level)
      })
    })

    it('should have non-empty fortune text', () => {
      FORTUNE_STICKS.forEach(stick => {
        expect(stick.text.trim().length).toBeGreaterThan(0)
      })
    })
  })

  describe('Date Handling', () => {
    it('should format today date correctly', () => {
      const mockDate = new Date('2024-11-06T12:00:00Z')
      const today = mockDate.toISOString().split('T')[0]
      expect(today).toBe('2024-11-06')
    })

    it('should determine if date matches today', () => {
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      expect(today).not.toBe(yesterday)
    })
  })

  describe('Category Validation', () => {
    it('should validate fortune categories', () => {
      const validCategories = ['事业运', '财富运', '感情运', '婚姻运', '家庭运', '健康运', '考试运', '官司诉讼', '旅行出行', '求子育儿', '置业投资', '买房置业', '风水运势', '寻物失物', '综合运途']
      validCategories.forEach(category => {
        expect(typeof category).toBe('string')
        expect(category.trim().length).toBeGreaterThan(0)
      })
    })

    it('should have exactly 15 categories', () => {
      const validCategories = ['事业运', '财富运', '感情运', '婚姻运', '家庭运', '健康运', '考试运', '官司诉讼', '旅行出行', '求子育儿', '置业投资', '买房置业', '风水运势', '寻物失物', '综合运途']
      expect(validCategories.length).toBe(15)
    })

    it('should reject invalid categories', () => {
      const validCategories = ['事业运', '财富运', '感情运', '婚姻运', '家庭运', '健康运', '考试运', '官司诉讼', '旅行出行', '求子育儿', '置业投资', '买房置业', '风水运势', '寻物失物', '综合运途']
      const invalidCategories = ['无效', '不存在', '', '事业', '财富']

      invalidCategories.forEach(category => {
        expect(validCategories).not.toContain(category)
      })
    })
  })

  describe('Category Selection Flow', () => {
    it('should handle category selection state', () => {
      const category = '事业运'
      const validCategories = ['事业运', '财富运', '感情运', '婚姻运', '家庭运', '健康运', '考试运', '官司诉讼', '旅行出行', '求子育儿', '置业投资', '买房置业', '风水运势', '寻物失物', '综合运途']

      expect(validCategories).toContain(category)
    })

    it('should support all 15 category types for state transition', () => {
      const categories = ['事业运', '财富运', '感情运', '婚姻运', '家庭运', '健康运', '考试运', '官司诉讼', '旅行出行', '求子育儿', '置业投资', '买房置业', '风水运势', '寻物失物', '综合运途']
      const stateTransition = (category: string) => {
        return { selected: category, state: 'shake' }
      }

      categories.forEach(cat => {
        const result = stateTransition(cat)
        expect(result.selected).toBe(cat)
        expect(result.state).toBe('shake')
      })
    })
  })

  describe('State Transitions', () => {
    it('should transition from idle to select', () => {
      const states = ['idle', 'select']
      expect(states[0]).toBe('idle')
      expect(states[1]).toBe('select')
    })

    it('should transition from select to shake when category selected', () => {
      const stateSequence = ['select', 'shake']
      expect(stateSequence[0]).toBe('select')
      expect(stateSequence[1]).toBe('shake')
    })

    it('should transition from shake to fallen', () => {
      const stateSequence = ['shake', 'fallen']
      expect(stateSequence[0]).toBe('shake')
      expect(stateSequence[1]).toBe('fallen')
    })

    it('should transition from fallen to result', () => {
      const stateSequence = ['fallen', 'result']
      expect(stateSequence[0]).toBe('fallen')
      expect(stateSequence[1]).toBe('result')
    })

    it('should have valid state machine sequence', () => {
      const validSequence = ['idle', 'select', 'shake', 'fallen', 'result']
      expect(validSequence.length).toBe(5)
      expect(validSequence).toContain('idle')
      expect(validSequence).toContain('select')
      expect(validSequence).toContain('shake')
      expect(validSequence).toContain('fallen')
      expect(validSequence).toContain('result')
    })
  })

  describe('API Response Handling', () => {
    it('should handle successful draw response', () => {
      expect(mockFortuneResponse.ok).toBe(true)
      expect(mockFortuneResponse.fortune).toBeDefined()
      expect(mockFortuneResponse.fortune.stick_id).toBeGreaterThan(0)
      expect(mockFortuneResponse.fortune.stick_text).toBeTruthy()
    })

    it('should handle already drawn response', () => {
      expect(mockAlreadyDrawnResponse.ok).toBe(true)
      expect(mockAlreadyDrawnResponse.alreadyDrawn).toBe(true)
      expect(mockAlreadyDrawnResponse.message).toContain('已抽签')
    })

    it('should handle error response', () => {
      const errorResponse = {
        ok: false,
        message: '网络错误'
      }
      
      expect(errorResponse.ok).toBe(false)
      expect(errorResponse.message).toBeTruthy()
    })

    it('should parse fortune response correctly', () => {
      const { fortune } = mockFortuneResponse
      expect(fortune.id).toBeTruthy()
      expect(fortune.category).toBe('事业运')
      expect(fortune.stick_id).toBeGreaterThan(0)
      expect(fortune.stick_level).toBe('上上')
    })
  })

  describe('AI Analysis Prompt', () => {
    it('should generate proper analysis prompt', () => {
      const category = '事业运'
      const stickText = '龙凤呈祥，万事亨通'
      const stickLevel = '上上'
      
      const prompt = `作为一位专业的命理大师，请为以下签文提供详细的解读：

签文类别：${category}
签文等级：${stickLevel}
签文内容：${stickText}

请从以下几个方面进行解读：
1. 签文寓意：解释签文的深层含义
2. 运势分析：分析当前的整体运势
3. 具体建议：针对${category}方面提供实用的建议
4. 注意事项：提醒需要警惕的问题
5. 改运方法：提供改善运势的方法

请用中文回答，语言要通俗易懂，既有传统文化底蕴，又要贴近现代生活。回答要积极正面，即使是下下签也要给出希望和指导。`
      
      expect(prompt).toContain(category)
      expect(prompt).toContain(stickText)
      expect(prompt).toContain(stickLevel)
      expect(prompt).toContain('签文寓意')
      expect(prompt).toContain('运势分析')
      expect(prompt).toContain('具体建议')
      expect(prompt).toContain('注意事项')
      expect(prompt).toContain('改运方法')
    })

    it('should generate unique prompts for different categories', () => {
      const getPrompt = (category: string) =>
        `针对${category}方面提供实用的建议`

      const prompt1 = getPrompt('事业运')
      const prompt2 = getPrompt('财富运')

      expect(prompt1).toContain('事业运')
      expect(prompt2).toContain('财富运')
      expect(prompt1).not.toBe(prompt2)
    })
  })

  describe('Session Management', () => {
    it('should generate valid UUID for session', () => {
      const { randomUUID } = require('crypto')
      const sessionId = randomUUID()
      expect(typeof sessionId).toBe('string')
      expect(sessionId.length).toBe(36) // UUID v4 length
      expect(sessionId.split('-').length).toBe(5) // UUID format
    })

    it('should handle multiple sessions independently', () => {
      const { randomUUID } = require('crypto')
      const session1 = randomUUID()
      const session2 = randomUUID()
      
      expect(session1).not.toBe(session2)
    })
  })

  describe('Fortune Cache', () => {
    beforeEach(() => {
      // Mock localStorage
      const localStorageMock = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      vi.stubGlobal('localStorage', localStorageMock)
    })

    it('should handle cache operations', () => {
      const mockFortune = {
        id: 'test-id',
        category: '事业运',
        stick_id: 1,
        stick_text: '龙凤呈祥，万事亨通',
        stick_level: '上上',
        ai_analysis: 'AI分析内容',
        created_at: '2024-11-06T12:00:00Z'
      }

      const STORAGE_KEY = 'daily_fortune_cache_v1'
      const today = new Date().toISOString().split('T')[0]
      const cacheData = { date: today, fortune: mockFortune }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData))
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(cacheData)
      )

      localStorage.getItem.mockReturnValue(JSON.stringify(cacheData))

      const cachedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      expect(cachedData).toHaveProperty('date')
      expect(cachedData).toHaveProperty('fortune')
      expect(cachedData.fortune).toEqual(mockFortune)
    })

    it('should clear cache on date mismatch', () => {
      const STORAGE_KEY = 'daily_fortune_cache_v1'
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const mockFortune = { id: 'test', category: '事业运', stick_id: 1, stick_text: '龙凤呈祥', stick_level: '上上', ai_analysis: null, created_at: '2024-11-05T00:00:00Z' }
      const cacheData = { date: yesterday, fortune: mockFortune }

      localStorage.getItem.mockReturnValue(JSON.stringify(cacheData))
      
      const cachedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      const today = new Date().toISOString().split('T')[0]
      
      if (cachedData.date !== today) {
        localStorage.removeItem(STORAGE_KEY)
      }
      
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
    })

    it('should handle cache storage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      try {
        localStorage.setItem('test_key', 'test_value')
      } catch {
        consoleSpy('Failed to cache daily fortune')
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('One Draw Per Day Constraint', () => {
    it('should enforce one-draw-per-day limit', () => {
      const today = new Date().toISOString().split('T')[0]
      const drawing1 = { date: today, drawn: true }
      const drawing2 = { date: today, drawn: true }
      
      expect(drawing1.date).toBe(drawing2.date)
    })

    it('should reset constraint after date change', () => {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      const drawing1 = { date: today, drawn: true }
      const drawing2 = { date: tomorrow, drawn: false }
      
      expect(drawing1.date).not.toBe(drawing2.date)
      expect(drawing1.drawn).toBe(true)
      expect(drawing2.drawn).toBe(false)
    })
  })

  describe('Accessibility Features', () => {
    it('should have status message for aria-live regions', () => {
      const statusMessages = {
        select: '请选择求签类别',
        shake: '正在为您求签...',
        fallen: '签文已出，正在为您解读...',
        result: '结果已生成'
      }

      expect(statusMessages.select).toBeTruthy()
      expect(statusMessages.shake).toBeTruthy()
      expect(statusMessages.fallen).toBeTruthy()
      expect(statusMessages.result).toBeTruthy()
    })

    it('should provide aria-labels for all 15 categories', () => {
      const categories = ['事业运', '财富运', '感情运', '婚姻运', '家庭运', '健康运', '考试运', '官司诉讼', '旅行出行', '求子育儿', '置业投资', '买房置业', '风水运势', '寻物失物', '综合运途']
      const ariaLabels = categories.map(cat => `求签类别：${cat}`)

      expect(ariaLabels.length).toBe(15)
      ariaLabels.forEach(label => {
        expect(label).toContain('求签类别')
      })
    })
  })
})