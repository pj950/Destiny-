# 每日一签功能快速设置指南

## 🚀 5分钟快速设置

### 步骤 1: 获取 Supabase 凭据
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 创建新项目或选择现有项目
3. 在 Settings > API 中获取:
   - Project URL
   - anon public key
   - service_role key

### 步骤 2: 获取 Google AI API 密钥
1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建新的 API 密钥
3. 复制密钥

### 步骤 3: 配置环境变量
创建 `.env.local` 文件:

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google AI 配置
GOOGLE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL_SUMMARY=gemini-2.5-pro
GEMINI_MODEL_REPORT=gemini-2.5-pro

# 站点配置
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 步骤 4: 设置数据库
在 Supabase SQL 编辑器中运行:

```sql
-- 创建 fortunes 表 (如果不存在)
CREATE TABLE IF NOT EXISTS fortunes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  session_id TEXT NOT NULL,
  draw_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('事业运', '财富运', '感情运', '婚姻运', '家庭运', '健康运', '考试运', '官司诉讼', '旅行出行', '求子育儿', '置业投资', '买房置业', '风水运势', '寻物失物', '综合运途')),
  stick_id INTEGER NOT NULL,
  stick_text TEXT NOT NULL,
  stick_level TEXT NOT NULL CHECK (stick_level IN ('上上', '上吉', '中吉', '下吉', '凶')),
  ai_analysis TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE fortunes ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "Allow anonymous fortune inserts" ON fortunes
  FOR INSERT WITH CHECK (user_id IS NULL AND session_id IS NOT NULL);

CREATE POLICY "Allow anonymous fortune reads by session" ON fortunes
  FOR SELECT USING (user_id IS NULL AND session_id IS NOT NULL);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_fortunes_session_id ON fortunes(session_id);
CREATE INDEX IF NOT EXISTS idx_fortunes_draw_date ON fortunes(draw_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fortunes_unique_daily_session ON fortunes(session_id, draw_date);
```

### 步骤 5: 重启开发服务器
```bash
# 停止当前服务器
pkill -f "next dev"

# 重新启动
npm run dev
```

### 步骤 6: 测试功能
1. 访问 `http://localhost:3000/fortune`
2. 选择一个签文类别
3. 点击"开启摇签"
4. 等待结果并查看AI解读

## 🧪 快速测试命令

```bash
# 测试 API 端点
curl -X POST http://localhost:3000/api/fortune/draw \
  -H "Content-Type: application/json" \
  -d '{"category": "事业运"}'
```

## 🔧 故障排除

### 常见错误及解决方案

#### 1. "Database configuration error"
**原因**: Supabase 环境变量未设置
**解决**: 检查 `.env.local` 中的 Supabase URL 和密钥

#### 2. "Database connection error"
**原因**: Supabase URL 或密钥不正确
**解决**: 验证 Supabase 项目设置中的凭据

#### 3. "AI解签功能暂未配置"
**原因**: Google API 密钥未设置
**解决**: 检查 `GOOGLE_API_KEY` 环境变量

#### 4. "Database permission error"
**原因**: RLS 策略未正确设置
**解决**: 运行步骤 4 中的 SQL 语句

### 验证清单

- [ ] Supabase 项目已创建
- [ ] 环境变量已配置
- [ ] 数据库表已创建
- [ ] RLS 策略已设置
- [ ] Google AI API 密钥已获取
- [ ] 开发服务器已重启
- [ ] API 测试通过
- [ ] 前端功能正常

## 📞 获取帮助

如果遇到问题，请提供:
1. 错误信息截图
2. `.env.local` 文件内容 (隐藏敏感信息)
3. Supabase 项目设置截图
4. 完整的错误日志

---

**设置完成时间**: 约 5-10 分钟  
**难度**: 初级  
**支持**: AI Assistant 24/7
