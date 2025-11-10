import type { BaziChart } from '../bazi'
import type { BaziInsights, PersonalityTag } from '../../types/bazi-insights'
import type { ChunkMetadata, ConversationMessage } from '../../types/database'
import {
  CHARACTER_PROFILE_PROMPT_VERSION,
  QA_PROMPT_VERSION,
  YEARLY_FLOW_PROMPT_VERSION,
} from './schemas'

export interface QaContextChunk {
  id: number
  content: string
  metadata?: ChunkMetadata | null
  similarity?: number
}

export interface QaConversationSnapshot {
  messages: ConversationMessage[]
}

const formatTags = (tags: PersonalityTag[]): string => {
  if (!tags.length) return '暂无标签'
  return tags
    .slice(0, 6)
    .map(
      tag =>
        `${tag.tag}（${tag.category}｜置信度${Math.round(tag.confidence)}｜来源：${tag.source}）`
    )
    .join('\n  - ')
}

const formatTenGodStrength = (insights: BaziInsights): string =>
  insights.ten_gods.strengths
    .slice(0, 5)
    .map(
      strength =>
        `${strength.god}(${strength.element})→${Math.round(strength.strength)}分：${strength.relationship}`
    )
    .join('\n  - ')

const formatLuckCycle = (insights: BaziInsights, targetYear?: number): string => {
  if (!insights.luck_cycles.length) return '暂无大运资料'

  const lines: string[] = []
  for (const cycle of insights.luck_cycles.slice(0, 6)) {
    const active =
      typeof targetYear === 'number' &&
      targetYear >= cycle.gregorian_start &&
      targetYear <= cycle.gregorian_end
    lines.push(
      `${active ? '★当前' : '·'} ${cycle.gregorian_start}-${cycle.gregorian_end}（${cycle.age_start}-${cycle.age_end}岁） ${cycle.combined}｜${cycle.element}｜${cycle.ten_god}：${cycle.description}`
    )
  }
  return lines.join('\n')
}

const formatWuxing = (chart: BaziChart): string => {
  const entries = Object.entries(chart.wuxing)
  if (!entries.length) return '木0 火0 土0 金0 水0'
  return entries
    .map(([key, value]) => `${key}:${Number(value).toFixed(1)}`)
    .join(' ')
}

const buildJsonInstruction = (
  schemaName: string,
  fields: string[],
  options?: { textRangeHint?: string }
): string => {
  const textRangeHint = options?.textRangeHint ?? '150-220 字'
  return `输出规则：\n- 仅输出 Markdown 代码块包裹的 JSON（使用\`\`\`json，勿添加额外文字）。\n- JSON 必须符合 ${schemaName} 定义，字段如下：\n  - ${fields.join('\n  - ')}\n- 所有文本字段使用自然、具有温度的中文，保持 ${textRangeHint} 的篇幅（若上文有更具体的长度说明，以具体说明为准）。\n- promptVersion 字段固定为当前版本号，且需与文档一致。`
}

export const buildCharacterProfilePrompt = (insights: BaziInsights): string => {
  const dayMaster = insights.day_master
  const keywords = dayMaster.keywords.join('、') || '暂无'
  const strengths = insights.analysis_summary.key_strengths.join('、') || '暂无'
  const growth = insights.analysis_summary.areas_for_growth.join('、') || '暂无'
  const dominantElements = insights.analysis_summary.dominant_elements.join('、') || '暂无'

  const instructions = buildJsonInstruction(
    'CharacterProfilePayload',
    [
      `promptVersion: 固定为 ${CHARACTER_PROFILE_PROMPT_VERSION}`,
      'corePersona: { archetype, description, elementFocus }，描述需引用具体干支或五行',
      'superPower: { title, activation } —— 指出如何唤醒与何时使用',
      'mastersInsight: 结合十神平衡给予一句大师开示（60-80字）',
      'opportunityPreview: 聚焦未来 3-6 个月的重要契机',
      "upgradeTeaser: 引导用户升级，语句需含'解锁完整命盘'等暗示",
      'topTraits: 长度为 3，前两项提供 trait + 行动建议，第三项必须包含 { locked: true, upgradeHint } 并保持描述留白',
    ],
    { textRangeHint: '260-320 字' }
  )

  return `你是一位东方命盘品牌的首席 AI 星命导师，需要根据下列结构化命盘洞察编写【角色画像】提示词。\n\n### 命盘概要\n- 日主：${dayMaster.stem}（${dayMaster.element}，${dayMaster.yin_yang === 'yang' ? '阳' : '阴'}）——${dayMaster.description}\n- 核心关键词：${keywords}\n- 十神平衡度：${insights.ten_gods.balance_score} 分，强势五行：${dominantElements}\n- 关键优势：${strengths}\n- 成长课题：${growth}\n- 个性标签：\n  - ${formatTags(insights.personality_tags)}\n- 十神力量：\n  - ${formatTenGodStrength(insights)}\n\n### 写作语气\n- 亲切、富有仪式感，字里行间体现东方智慧。\n- 引用具体的干支、十神或五行时，需指明来源（如：\"根据月柱丙寅…\"）。\n- 正文总字数控制在 260-320 个汉字。\n\n${instructions}\n- topTraits[2] 必须透过 upgradeHint 暗示升级权益，不直接泄露完整内容。\n- 如资料不足，可在对应字段写 \"待解锁\"，但仍需提供 upgradeTeaser。\n\n最终只输出满足 CharacterProfilePayload 的 JSON 结果。`
}

export const buildYearlyFlowPrompt = (
  chart: BaziChart,
  insights: BaziInsights,
  targetYear: number
): string => {
  const pillars = chart.pillars
  const activeLuckSummary = formatLuckCycle(insights, targetYear)
  const wuxingSummary = formatWuxing(chart)

  const instructions = buildJsonInstruction(
    'YearlyFlowPayload',
    [
      `promptVersion: 固定为 ${YEARLY_FLOW_PROMPT_VERSION}`,
      'targetYear: 目标年份整数',
      'natalAnalysis: 原局结构解析（120-160字，引用干支+五行）',
      'decadeLuckAnalysis: 所处大运与交替提示（120-160字）',
      'annualFlowAnalysis: 流年结构与核心命题（150-200字）',
      'energyIndex: 12 个节点，按月份顺序，字段 { month, score, narrative }，score 0-100',
      'keyDomains: { career, wealth, relationship, health }，每项含 theme/opportunity/precaution/ritual',
      'monthlyTimeline: 至少 6 条 { month, headline, action, warning }，聚焦关键月份',
      "doList: 3-5 条，使用动词开头，强调可执行 ritual\n  - dontList: 3-5 条，提醒需避免的行为",
      'decisionTree: 至少 3 个节点 { id, scenario, choice, outcome }，id 使用 "node-1" 形式',
      'scorecard: { overall, career, wealth, relationship, health, mindset } 0-100，整数',
    ],
    { textRangeHint: '依照上方字段说明控制字数' }
  )

  return `你是东方命盘 AI 年运规划师，需要为 ${targetYear} 年生成一份含结构化 JSON 的流年导航提示。\n\n### 原始命局数据\n- 四柱：年柱 ${pillars.year.combined}｜月柱 ${pillars.month.combined}｜日柱 ${pillars.day.combined}｜时柱 ${pillars.hour.combined}\n- 日主：${insights.day_master.stem}（${insights.day_master.element}，${insights.day_master.yin_yang === 'yang' ? '阳' : '阴'}）\n- 五行力度：${wuxingSummary}\n- 大运节奏：\n${activeLuckSummary}\n- 当前十神焦点：\n  - ${formatTenGodStrength(insights)}\n\n### 编写规范\n- 明确引用命盘来源，例如 \"依据 ${pillars.month.combined} 月柱…\"。\n- 对每个 keyDomains 小节给出 80-120 字的聚焦建议，强调行动与仪式感。\n- energyIndex 覆盖 12 个月，按时间顺序排列，narrative 控制在 20-40 字。\n- decisionTree 节点需以 id: \"node-1\" 形式编号，并指出依据的五行/十神逻辑。\n- 如信息不足，需在 narrative 中说明并提示用户解锁更多数据。\n\n${instructions}\n- promptVersion 设为 ${YEARLY_FLOW_PROMPT_VERSION}。\n\n最终仅输出满足 YearlyFlowPayload 的 JSON。`
}

const formatConversationHistory = (conversation?: QaConversationSnapshot | null): string => {
  const messages = conversation?.messages ?? []
  if (!messages.length) return '无既往对话，可直接回答当前问题。'

  const recent = messages.slice(-6)
  return recent
    .map((message, index) => {
      const role = message.role === 'assistant' ? 'AI' : '用户'
      const prefix = `${index + 1}. ${role}`
      const condensed = message.content.replace(/\s+/g, ' ').trim()
      return `${prefix}: ${condensed}`
    })
    .join('\n')
}

const formatContextChunks = (chunks: QaContextChunk[]): string => {
  if (!chunks.length) return '未检索到相关内容，请在回答中说明信息不足。'

  return chunks
    .map(chunk => {
      const tags = [chunk.metadata?.section, chunk.metadata?.subsection]
        .filter(Boolean)
        .join(' / ')
      const similarity =
        typeof chunk.similarity === 'number' ? `（相似度 ${chunk.similarity.toFixed(3)}）` : ''
      return `#${chunk.id}${similarity}${tags ? ` ｜${tags}` : ''}\n${chunk.content.trim()}`
    })
    .join('\n\n')
}

export const buildQaPrompt = (
  contextChunks: QaContextChunk[],
  conversation: QaConversationSnapshot | null,
  question: string
): string => {
  const instructions = buildJsonInstruction(
    'QaAnswerPayload',
    [
      `promptVersion: 固定为 ${QA_PROMPT_VERSION}`,
      'answer: 160-220 字中文，先给总体判断，再列举关键依据，每条依据后以 [#chunkId] 引用',
      'citations: 至少 1 个 chunk id，按引用先后排序，不重复',
      'followUps: 给出 2-3 条，引导用户继续提问或升级解锁更多内容',
    ],
    { textRangeHint: '160-220 字' }
  )

  return `你是东方命盘智能问答助手，请根据提供的上下文回答用户问题并生成结构化 JSON。\n\n### 上下文片段\n${formatContextChunks(contextChunks)}\n\n### 对话历史\n${formatConversationHistory(conversation)}\n\n### 当前问题\n${question}\n\n### 回答原则\n- 只依赖上下文内容，不可虚构，无法回答时需说明并建议用户上传更多资料。\n- 回答以条理清晰的段落呈现，引用内容时使用 [#chunkId] 标注。\n- 若上下文存在多种观点，需总结差异后给出谨慎建议。\n- 语气保持专业、温暖，并提醒用户遵循现实行动。\n\n${instructions}\n- promptVersion 设为 ${QA_PROMPT_VERSION}。\n- 若无上下文可引用，citations 可返回空数组，但 answer 中需解释原因。\n\n最终仅输出符合 QaAnswerPayload 的 JSON。`
}
