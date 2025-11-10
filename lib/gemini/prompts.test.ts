import { describe, expect, it } from 'vitest'

import type { BaziChart } from '../bazi'
import type { BaziInsights } from '../../types/bazi-insights'
import type { ConversationMessage } from '../../types/database'
import {
  buildCharacterProfilePrompt,
  buildQaPrompt,
  buildYearlyFlowPrompt,
  type QaContextChunk,
  type QaConversationSnapshot,
} from './prompts'
import {
  CHARACTER_PROFILE_PROMPT_VERSION,
  QA_PROMPT_VERSION,
  YEARLY_FLOW_PROMPT_VERSION,
  CharacterProfilePayloadSchema,
  QaAnswerPayloadSchema,
} from './schemas'
import { parseGeminiJsonResponse } from './parser'

const baseInsights: BaziInsights = {
  day_master: {
    stem: '丙',
    element: 'fire',
    yin_yang: 'yang',
    keywords: ['盛放', '领导', '光明'],
    description: '烈日之光，重视表达与舞台。',
  },
  ten_gods: {
    day_master_stem: '丙',
    relationships: {
      year_stem: '偏印',
      month_stem: '正官',
      day_stem: '比肩',
      hour_stem: '伤官',
    },
    strengths: [
      {
        god: '正官',
        strength: 78,
        element: 'metal',
        relationship: '强调秩序与责任',
        influence: ['事业规制', '公众形象'],
      },
      {
        god: '偏财',
        strength: 72,
        element: 'water',
        relationship: '激活资源调动',
        influence: ['财富', '合作'],
      },
      {
        god: '伤官',
        strength: 68,
        element: 'wood',
        relationship: '激发创造表达',
        influence: ['表达', '创新'],
      },
    ],
    dominant_elements: ['fire', 'earth'],
    weak_elements: ['water'],
    balance_score: 64,
  },
  luck_cycles: [
    {
      age_start: 26,
      age_end: 35,
      gregorian_start: 2022,
      gregorian_end: 2031,
      stem: '辛',
      branch: '卯',
      combined: '辛卯',
      element: 'metal',
      ten_god: '正官',
      influence: '聚焦职业秩序',
      description: '重视责任与名望的十年阶段。',
    },
    {
      age_start: 36,
      age_end: 45,
      gregorian_start: 2032,
      gregorian_end: 2041,
      stem: '庚',
      branch: '寅',
      combined: '庚寅',
      element: 'metal',
      ten_god: '七杀',
      influence: '挑战与突破并存',
      description: '考验领导魄力与应变能力。',
    },
  ],
  personality_tags: [
    { tag: '舞台掌舵者', category: 'strengths', confidence: 88, source: 'ten_gods' },
    { tag: '火元素驱动', category: 'traits', confidence: 82, source: 'wuxing' },
    { tag: '需要结构', category: 'areas_for_growth', confidence: 74, source: 'ten_gods' },
  ],
  analysis_summary: {
    overall_balance: 62,
    dominant_elements: ['fire', 'earth'],
    key_strengths: ['领导魅力', '号召力'],
    areas_for_growth: ['节奏管理', '情绪平衡'],
    favorable_elements: ['wood', 'fire'],
    unfavorable_elements: ['water'],
  },
}

const mockChart: BaziChart = {
  bazi: {
    year: '辛丑',
    month: '庚寅',
    day: '丙午',
    hour: '甲子',
  },
  pillars: {
    year: { stem: '辛', branch: '丑', combined: '辛丑' },
    month: { stem: '庚', branch: '寅', combined: '庚寅' },
    day: { stem: '丙', branch: '午', combined: '丙午' },
    hour: { stem: '甲', branch: '子', combined: '甲子' },
  },
  wuxing: { wood: 3.2, fire: 4.1, earth: 3.5, metal: 2.4, water: 1.3 },
  meta: {
    lunar: { gzYear: '辛丑', gzMonth: '庚寅', gzDay: '丙午', gzHour: '甲子' },
    utc: '1996-07-15T04:00:00.000Z',
    timezone: 'Asia/Shanghai',
  },
}

const sampleChunks: QaContextChunk[] = [
  {
    id: 12,
    content: '2025 年整体需要以稳为主，宜在四月完成关键决策。',
    metadata: { section: '年度总结', subsection: '整体节奏' },
    similarity: 0.8123,
  },
  {
    id: 18,
    content: '职场贵人多出现在七月，留意金属性行业的合作邀约。',
    metadata: { section: '事业', subsection: '贵人运' },
    similarity: 0.7345,
  },
]

const sampleConversation: QaConversationSnapshot = {
  messages: [
    { role: 'user', content: '去年整体感觉压力很大。', timestamp: '2024-01-01T11:00:00Z' },
    { role: 'assistant', content: '上一轮大运提醒你练习节奏管理。', timestamp: '2024-01-01T11:01:00Z' },
    { role: 'user', content: '那今年桃花如何？', timestamp: '2024-01-01T11:02:00Z' },
  ] as ConversationMessage[],
}

describe('Gemini prompt builders', () => {
  it('buildCharacterProfilePrompt embeds insight data and schema hints', () => {
    const prompt = buildCharacterProfilePrompt(baseInsights)

    expect(prompt).toContain('CharacterProfilePayload')
    expect(prompt).toContain(CHARACTER_PROFILE_PROMPT_VERSION)
    expect(prompt).toContain(baseInsights.day_master.description)
    expect(prompt).toContain('topTraits: 长度为 3')
    expect(prompt).toContain('upgradeHint')
    expect(prompt).toMatch(/十神力量/)
  })

  it('buildYearlyFlowPrompt references chart pillars and instructions', () => {
    const prompt = buildYearlyFlowPrompt(mockChart, baseInsights, 2025)

    expect(prompt).toContain('YearlyFlowPayload')
    expect(prompt).toContain(YEARLY_FLOW_PROMPT_VERSION)
    expect(prompt).toContain('庚寅')
    expect(prompt).toContain('energyIndex')
    expect(prompt).toContain('decisionTree')
    expect(prompt).toContain('node-1')
  })

  it('buildQaPrompt includes context, conversation history, and schema guidance', () => {
    const question = '今年哪个月份推进合作最佳？'
    const prompt = buildQaPrompt(sampleChunks, sampleConversation, question)

    expect(prompt).toContain('QaAnswerPayload')
    expect(prompt).toContain(QA_PROMPT_VERSION)
    expect(prompt).toContain('#12')
    expect(prompt).toContain(question)
    expect(prompt).toContain('citations: 至少 1 个 chunk id')
    expect(prompt).toContain('followUps')
  })
})

describe('parseGeminiJsonResponse', () => {
  it('parses markdown-wrapped JSON and validates against schema', () => {
    const response = `好的，以下是画像：


ggg

dange

```json
{
  "promptVersion": "${CHARACTER_PROFILE_PROMPT_VERSION}",
  "corePersona": {
    "archetype": "烈日掌舵者",
    "description": "以丙火为核心的领导者，擅长凝聚人心并以光芒感染团队。",
    "elementFocus": "火土互生"
  },
  "superPower": {
    "title": "光耀号召力",
    "activation": "在关键节点主动站上舞台，通过讲故事唤醒团队热情。"
  },
  "mastersInsight": "依据月柱庚寅的正官力量，本年宜将秩序与热情调和，行动前先定规则。",
  "opportunityPreview": "春分前后贵人邀约渐增，利用火木旺气布局合作与曝光。",
  "upgradeTeaser": "想看完整十神布局与专属行动，请解锁完整命盘指南。",
  "topTraits": [
    {
      "title": "舞台领导力",
      "detail": "借助丙火日主的热情在公众场域发光，激励团队。"
    },
    {
      "title": "资源调度力",
      "detail": "偏财力量帮助你串联异业伙伴，拓展渠道。"
    },
    {
      "title": "潜藏的秘钥",
      "locked": true,
      "upgradeHint": "升级后解锁你的第三个核心特质与专属修炼法。"
    }
  ]
}
```
`

    const payload = parseGeminiJsonResponse(response, CharacterProfilePayloadSchema)

    expect(payload.promptVersion).toBe(CHARACTER_PROFILE_PROMPT_VERSION)
    expect(payload.topTraits).toHaveLength(3)
    expect(payload.topTraits[2].locked).toBe(true)
  })

  it('throws a readable error when validation fails', () => {
    const invalidResponse = '```json\n{"promptVersion":"wrong","answer":42}\n```'

    expect(() => parseGeminiJsonResponse(invalidResponse, QaAnswerPayloadSchema)).toThrow(
      /failed schema validation/i
    )
  })
})
