-- Migration: Create fortunes table for Daily Fortune feature
-- Created: 2024-11-06
-- Description: Creates fortunes table for tracking daily fortune draws and AI interpretations

-- Fortunes table
-- Stores daily fortune draws with AI analysis
CREATE TABLE fortunes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,  -- NULL for MVP (no auth), references auth.users(id) in production
  session_id TEXT NOT NULL,  -- Anonymous session token stored in HttpOnly cookie
  draw_date DATE NOT NULL,  -- Date of the fortune draw
  category TEXT NOT NULL CHECK (category IN ('事业运', '财富运', '感情运', '婚姻运', '家庭运', '健康运', '考试运', '官司诉讼', '旅行出行', '求子育儿', '置业投资', '买房置业', '风水运势', '寻物失物', '综合运途')),  -- Fortune category (15 types)
  stick_id INTEGER NOT NULL,  -- Fortune stick number (1-100)
  stick_text TEXT NOT NULL,  -- The fortune stick text
  stick_level TEXT NOT NULL CHECK (stick_level IN ('上上', '上吉', '中吉', '下吉', '凶')),  -- Fortune level
  ai_analysis TEXT NULL,  -- AI interpretation of the fortune
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_fortunes_user_id ON fortunes(user_id);
CREATE INDEX idx_fortunes_session_id ON fortunes(session_id);
CREATE INDEX idx_fortunes_draw_date ON fortunes(draw_date);
CREATE INDEX idx_fortunes_category ON fortunes(category);
CREATE UNIQUE INDEX idx_fortunes_unique_daily_user ON fortunes(user_id, draw_date) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_fortunes_unique_daily_session ON fortunes(session_id, draw_date);

-- Add comments for documentation
COMMENT ON TABLE fortunes IS 'Daily fortune draws with AI interpretations';
COMMENT ON COLUMN fortunes.user_id IS 'User ID (NULL for MVP, will reference auth.users in production)';
COMMENT ON COLUMN fortunes.session_id IS 'Anonymous session identifier stored in cookie for one draw per day restriction';
COMMENT ON COLUMN fortunes.draw_date IS 'Date when the fortune was drawn (one per day per user/session)';
COMMENT ON COLUMN fortunes.category IS 'Fortune category: 事业运(Career), 财富运(Wealth), 感情运(Love), 婚姻运(Marriage), 家庭运(Family), 健康运(Health), 考试运(Exam), 官司诉讼(Lawsuit), 旅行出行(Travel), 求子育儿(Fertility), 置业投资(Investment), 买房置业(Real Estate), 风水运势(Feng Shui), 寻物失物(Lost), 综合运途(Overall)';
COMMENT ON COLUMN fortunes.stick_id IS 'Fortune stick number (1-100), randomly selected';
COMMENT ON COLUMN fortunes.stick_text IS 'The actual fortune text from the stick';
COMMENT ON COLUMN fortunes.stick_level IS 'Fortune level: 上上(Best), 上吉(Good), 中吉(Medium), 下吉(Low), 凶(Bad)';
COMMENT ON COLUMN fortunes.ai_analysis IS 'AI-generated interpretation using Google Gemini or fallback guidance';