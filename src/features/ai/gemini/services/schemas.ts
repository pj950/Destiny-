import { z } from 'zod'

export const CHARACTER_PROFILE_PROMPT_VERSION = 'character_profile_v1'
export const YEARLY_FLOW_PROMPT_VERSION = 'yearly_flow_v1'
export const QA_PROMPT_VERSION = 'qa_answer_v1'

const TraitSchema = z.object({
  title: z.string().min(1, 'trait title is required'),
  detail: z.string().min(1, 'trait detail is required').optional(),
  upgradeHint: z.string().min(1, 'upgrade hint should guide users to unlock more insights').optional(),
  locked: z.boolean().optional(),
})

export const CharacterProfilePayloadSchema = z
  .object({
    promptVersion: z
      .string()
      .regex(/^character_profile_v\d+$/)
      .default(CHARACTER_PROFILE_PROMPT_VERSION),
    corePersona: z.object({
      archetype: z.string().min(1, 'corePersona.archetype is required'),
      description: z.string().min(1, 'corePersona.description is required'),
      elementFocus: z.string().min(1, 'corePersona.elementFocus is required'),
    }),
    superPower: z.object({
      title: z.string().min(1, 'superPower.title is required'),
      activation: z.string().min(1, 'superPower.activation is required'),
    }),
    mastersInsight: z.string().min(1, 'mastersInsight is required'),
    opportunityPreview: z.string().min(1, 'opportunityPreview is required'),
    upgradeTeaser: z.string().min(1, 'upgradeTeaser is required'),
    topTraits: z.array(TraitSchema).length(3, 'topTraits must contain exactly three items'),
  })
  .superRefine((value, ctx) => {
    const lastTrait = value.topTraits[2]
    if (!lastTrait) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['topTraits'],
        message: 'topTraits must contain at least three items',
      })
      return
    }

    if (!lastTrait.locked) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['topTraits', 2, 'locked'],
        message: 'The third trait must include { "locked": true } to encourage upgrade messaging.',
      })
    }

    if (!lastTrait.upgradeHint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['topTraits', 2, 'upgradeHint'],
        message: 'Provide an upgradeHint for the locked third trait to guide users toward premium content.',
      })
    }
  })

const EnergyIndexNodeSchema = z.object({
  month: z.string().min(1, 'energyIndex.month is required'),
  score: z
    .number({ invalid_type_error: 'energyIndex.score must be a number' })
    .min(0)
    .max(100),
  narrative: z.string().min(1, 'energyIndex.narrative is required'),
})

const FocusQuadrantSchema = z.object({
  theme: z.string().min(1, 'keyDomains.theme is required'),
  opportunity: z.string().min(1, 'keyDomains.opportunity is required'),
  precaution: z.string().min(1, 'keyDomains.precaution is required'),
  ritual: z.string().min(1, 'keyDomains.ritual is required'),
})

const MonthlyTimelineNodeSchema = z.object({
  month: z.string().min(1, 'monthlyTimeline.month is required'),
  headline: z.string().min(1, 'monthlyTimeline.headline is required'),
  action: z.string().min(1, 'monthlyTimeline.action is required'),
  warning: z.string().optional(),
})

const DecisionTreeNodeSchema = z.object({
  id: z.string().min(1, 'decisionTree.id is required'),
  scenario: z.string().min(1, 'decisionTree.scenario is required'),
  choice: z.string().min(1, 'decisionTree.choice is required'),
  outcome: z.string().min(1, 'decisionTree.outcome is required'),
})

const ScorecardSchema = z.object({
  overall: z.number().min(0).max(100),
  career: z.number().min(0).max(100),
  wealth: z.number().min(0).max(100),
  relationship: z.number().min(0).max(100),
  health: z.number().min(0).max(100),
  mindset: z.number().min(0).max(100),
})

export const YearlyFlowPayloadSchema = z.object({
  promptVersion: z
    .string()
    .regex(/^yearly_flow_v\d+$/)
    .default(YEARLY_FLOW_PROMPT_VERSION),
  targetYear: z
    .number({ invalid_type_error: 'targetYear must be a number' })
    .int('targetYear must be an integer'),
  natalAnalysis: z.string().min(1, 'natalAnalysis is required'),
  decadeLuckAnalysis: z.string().min(1, 'decadeLuckAnalysis is required'),
  annualFlowAnalysis: z.string().min(1, 'annualFlowAnalysis is required'),
  energyIndex: z.array(EnergyIndexNodeSchema).min(4, 'Provide at least four energy index nodes'),
  keyDomains: z.object({
    career: FocusQuadrantSchema,
    wealth: FocusQuadrantSchema,
    relationship: FocusQuadrantSchema,
    health: FocusQuadrantSchema,
  }),
  monthlyTimeline: z
    .array(MonthlyTimelineNodeSchema)
    .min(6, 'Provide a monthly timeline with at least six key points'),
  doList: z.array(z.string().min(1)).min(3, 'Provide at least three Do items'),
  dontList: z.array(z.string().min(1)).min(3, 'Provide at least three Don\'t items'),
  decisionTree: z.array(DecisionTreeNodeSchema).min(3, 'Provide at least three decision nodes'),
  scorecard: ScorecardSchema,
})

export const QaAnswerPayloadSchema = z.object({
  promptVersion: z
    .string()
    .regex(/^qa_answer_v\d+$/)
    .default(QA_PROMPT_VERSION),
  answer: z.string().min(1, 'answer is required'),
  citations: z
    .array(z.union([z.number(), z.string()]))
    .min(1, 'Provide at least one citation id'),
  followUps: z.array(z.string().min(1)).max(3, 'Provide up to three follow-up suggestions'),
})

export type CharacterProfilePayload = z.infer<typeof CharacterProfilePayloadSchema>
export type YearlyFlowPayload = z.infer<typeof YearlyFlowPayloadSchema>
export type QaAnswerPayload = z.infer<typeof QaAnswerPayloadSchema>
