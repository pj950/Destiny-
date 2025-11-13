-- Migration: Update lamps table to match lamp configurations
-- Created: 2024-12-19
-- Description: Update lamps table with all lamp keys from lamp configurations to fix API 500 errors

-- Clear existing lamp data to avoid conflicts
DELETE FROM lamps;

-- Insert lamp records for all expected lamps based on actual Chinese image files in public/images/
INSERT INTO lamps (lamp_key, status) VALUES 
  ('平安灯', 'unlit'),
  ('健康灯', 'unlit'),
  ('财运灯', 'unlit'),
  ('招财灯', 'unlit'),
  ('暴富灯', 'unlit'),
  ('回财灯', 'unlit'),
  ('偏财灯', 'unlit'),
  ('姻缘灯', 'unlit'),
  ('正缘桃花灯', 'unlit'),
  ('斩烂桃花灯', 'unlit'),
  ('文昌灯', 'unlit'),
  ('智慧灯', 'unlit'),
  ('求子灯', 'unlit'),
  ('安产灯', 'unlit'),
  ('添寿灯', 'unlit'),
  ('好运灯', 'unlit'),
  ('消灾灯', 'unlit'),
  ('除秽灯', 'unlit'),
  ('防小人灯', 'unlit'),
  ('贵人灯', 'unlit'),
  ('本命灯', 'unlit'),
  ('太岁灯', 'unlit'),
  ('三宝灯', 'unlit'),
  ('五福灯', 'unlit'),
  ('七星灯', 'unlit'),
  ('九子离火灯', 'unlit'),
  ('传愿灯', 'unlit'),
  ('追忆灯', 'unlit'),
  ('忏悔灯', 'unlit'),
  ('顺风顺水灯', 'unlit'),
  ('爱宠无忧灯', 'unlit'),
  ('发横财灯', 'unlit'),
  ('四季平安灯', 'unlit'),
  ('事业灯', 'unlit')
ON CONFLICT (lamp_key) DO NOTHING;

-- Add a comment to document the update
COMMENT ON TABLE lamps IS 'Prayer lamps tracking lit/unlit state and payment information. Updated to match Chinese lamp name configurations.';