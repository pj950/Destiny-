/**
 * Database Types for Eastern Destiny
 * 
 * TypeScript types matching the Supabase database schema
 * Generated from: supabase/migrations/20241110000001_extend_schema_reports_subscriptions.sql
 */

// ============================================================================
// Base Types
// ============================================================================

export type UUID = string
export type Timestamp = string

// ============================================================================
// Subscription Tiers
// ============================================================================

export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'vip'

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired'

// ============================================================================
// Report Types
// ============================================================================

export type ReportType = 'character_profile' | 'yearly_flow'

export type ReportStatus = 'pending' | 'processing' | 'completed' | 'failed'

// ============================================================================
// Extended Charts Table
// ============================================================================

export interface Chart {
  id: UUID
  profile_id: UUID
  chart_json: Record<string, any>
  wuxing_scores: Record<string, number>
  ai_summary: string | null
  // New fields from migration
  day_master: string | null
  ten_gods: TenGodsRelationships | null
  luck_cycles: LuckCycle[] | null
  created_at: Timestamp
}

export interface TenGodsRelationships {
  year_stem?: string
  year_branch?: string
  month_stem?: string
  month_branch?: string
  day_stem?: string
  day_branch?: string
  hour_stem?: string
  hour_branch?: string
}

export interface LuckCycle {
  age_start: number
  age_end: number
  stem: string
  branch: string
  ten_god?: string
}

// ============================================================================
// BaZi Reports Table
// ============================================================================

export interface BaziReport {
  id: UUID
  chart_id: UUID
  user_id: UUID | null
  report_type: ReportType
  title: string
  summary: ReportSummary | null
  structured: ReportStructured | null
  body: string | null
  model: string | null
  prompt_version: string | null
  tokens: number | null
  status: ReportStatus
  created_at: Timestamp
  updated_at: Timestamp
  completed_at: Timestamp | null
}

export interface ReportSummary {
  key_insights?: string[]
  strengths?: string[]
  areas_for_growth?: string[]
  lucky_elements?: string[]
  unlucky_elements?: string[]
  [key: string]: any
}

export interface ReportStructured {
  sections?: ReportSection[]
  [key: string]: any
}

export interface ReportSection {
  title: string
  content: string
  subsections?: ReportSection[]
  keywords?: string[]
  [key: string]: any
}

// ============================================================================
// BaZi Report Chunks Table
// ============================================================================

export interface BaziReportChunk {
  id: number
  report_id: UUID
  chunk_index: number
  content: string
  embedding: number[] | null  // 768-dimensional vector
  metadata: ChunkMetadata | null
  created_at: Timestamp
}

export interface ChunkMetadata {
  section?: string
  subsection?: string
  keywords?: string[]
  importance?: number
  page?: number
  [key: string]: any
}

// ============================================================================
// Q&A Conversations Table
// ============================================================================

export interface QAConversation {
  id: UUID
  report_id: UUID
  user_id: UUID | null
  subscription_tier: SubscriptionTier
  messages: ConversationMessage[]
  last_message_at: Timestamp
  retention_until: Timestamp | null
  metadata: ConversationMetadata | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Timestamp
  sources?: MessageSource[]
  [key: string]: any
}

export interface MessageSource {
  chunk_id: number
  similarity: number
  [key: string]: any
}

export interface ConversationMetadata {
  total_questions?: number
  average_response_time_ms?: number
  satisfaction_rating?: number
  topics?: string[]
  [key: string]: any
}

// ============================================================================
// Q&A Usage Tracking Table
// ============================================================================

export interface QAUsageTracking {
  id: number
  user_id: UUID
  report_id: UUID
  plan_tier: SubscriptionTier
  period_start: Timestamp
  period_end: Timestamp
  questions_used: number
  extra_questions: number
  last_reset_at: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
}

// ============================================================================
// User Subscriptions Table
// ============================================================================

export interface UserSubscription {
  id: UUID
  user_id: UUID
  tier: SubscriptionTier
  status: SubscriptionStatus
  current_period_start: Timestamp
  current_period_end: Timestamp
  auto_renew: boolean
  external_subscription_id: string | null
  payment_method: string | null
  cancel_at: Timestamp | null
  canceled_at: Timestamp | null
  metadata: SubscriptionMetadata | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface SubscriptionMetadata {
  features?: {
    ai_reports?: boolean
    qa_unlimited?: boolean
    priority_support?: boolean
    [key: string]: any
  }
  limits?: {
    reports_per_month?: number
    questions_per_report?: number
    [key: string]: any
  }
  discount?: {
    code?: string
    percent?: number
    valid_until?: Timestamp
    [key: string]: any
  }
  [key: string]: any
}

// ============================================================================
// Utility Types
// ============================================================================

export type VectorSearchResult<T = BaziReportChunk> = T & {
  similarity: number
}

export interface PaginatedResult<T> {
  data: T[]
  count: number
  page: number
  page_size: number
  total_pages: number
}

// ============================================================================
// Database Insert Types (without auto-generated fields)
// ============================================================================

export type BaziReportInsert = Omit<BaziReport, 'id' | 'created_at' | 'updated_at' | 'completed_at'> & {
  id?: UUID
  created_at?: Timestamp
  updated_at?: Timestamp
  completed_at?: Timestamp
}

export type BaziReportChunkInsert = Omit<BaziReportChunk, 'id' | 'created_at'> & {
  id?: number
  created_at?: Timestamp
}

export type QAConversationInsert = Omit<QAConversation, 'id' | 'created_at' | 'updated_at'> & {
  id?: UUID
  created_at?: Timestamp
  updated_at?: Timestamp
}

export type QAUsageTrackingInsert = Omit<QAUsageTracking, 'id' | 'created_at' | 'updated_at'> & {
  id?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export type UserSubscriptionInsert = Omit<UserSubscription, 'id' | 'created_at' | 'updated_at'> & {
  id?: UUID
  created_at?: Timestamp
  updated_at?: Timestamp
}

// ============================================================================
// Database Update Types (all fields optional except those needed for update)
// ============================================================================

export type BaziReportUpdate = Partial<Omit<BaziReport, 'id' | 'chart_id' | 'created_at'>>

export type BaziReportChunkUpdate = Partial<Omit<BaziReportChunk, 'id' | 'report_id' | 'created_at'>>

export type QAConversationUpdate = Partial<Omit<QAConversation, 'id' | 'report_id' | 'created_at'>>

export type QAUsageTrackingUpdate = Partial<Omit<QAUsageTracking, 'id' | 'user_id' | 'report_id' | 'created_at'>>

export type UserSubscriptionUpdate = Partial<Omit<UserSubscription, 'id' | 'user_id' | 'created_at'>>
