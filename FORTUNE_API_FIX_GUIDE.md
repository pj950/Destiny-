# 每日一签 API 修复指南
# Fortune API Fix Guide

## 问题描述 | Problem Description

API 返回错误：`permission denied for table fortunes`

即使在 Vercel 配置了 `SUPABASE_SERVICE_ROLE_KEY`，仍然出现权限错误。

## 根本原因 | Root Cause

1. **本地开发环境**: 缺少 `.env.local` 文件，导致环境变量未加载
2. **生产环境 (Vercel)**: 可能的原因：
   - `SUPABASE_SERVICE_ROLE_KEY` 未配置或配置错误
   - RLS 策略过于严格，阻止了 service_role 访问
   - 使用了占位符值而非真实的 service role key

## 修复方案 | Solution

### 1️⃣ 配置本地环境变量 | Configure Local Environment

已创建 `.env.local` 文件，请填入真实的配置：

```bash
# 从 Supabase 控制台获取: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 从 Google AI Studio 获取: https://makersuite.google.com/app/apikey
GOOGLE_API_KEY=AIzaSy...
```

**⚠️ 重要**: 
- `SUPABASE_SERVICE_ROLE_KEY` 必须是真实的 service role key，以 `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9` 开头
- 不能使用占位符值如 `your-`, `test-`, `placeholder` 等
- `.env.local` 已在 `.gitignore` 中，不会被提交到 Git

### 2️⃣ 应用数据库迁移 | Apply Database Migration

新建了迁移文件: `supabase/migrations/20241224000001_fortunes_rls_service_role_fix.sql`

**手动应用步骤**:

1. 打开 Supabase Dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT/editor
2. 点击左侧 "SQL Editor"
3. 复制迁移文件内容并粘贴
4. 点击 "RUN" 执行迁移

**或使用 Supabase CLI**:

```bash
# 如果已安装 Supabase CLI
supabase db push
```

### 3️⃣ 配置 Vercel 环境变量 | Configure Vercel Environment

在 Vercel Dashboard 中配置以下环境变量:

1. 访问: https://vercel.com/your-team/your-project/settings/environment-variables

2. 添加/更新以下变量:

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Production, Preview, Development |
| `GOOGLE_API_KEY` | `AIzaSy...` | Production, Preview, Development |

3. 保存后触发重新部署

### 4️⃣ 验证修复 | Verify Fix

**本地测试**:

```bash
# 启动开发服务器
npm run dev

# 在浏览器中访问
http://localhost:3000/fortune

# 或直接测试 API
curl http://localhost:3000/api/fortune/today
```

**生产环境测试**:

```bash
# 测试 API 端点
curl https://your-app.vercel.app/api/fortune/today

# 预期响应
{
  "ok": true,
  "hasFortune": false  # 或 true with fortune data
}
```

## 技术细节 | Technical Details

### API 代码结构

```typescript
// pages/api/fortune/today.ts
import { supabaseService } from '../../../lib/supabase'

export default async function handler(req, res) {
  // ✅ 使用 supabaseService (service role client)
  const { data, error } = await supabaseService
    .from('fortunes')
    .select('*')
    .eq('draw_date', today)
    .eq('session_id', sessionId)
    .maybeSingle()
  
  // ...
}
```

### Supabase 客户端配置

```typescript
// lib/supabase.ts
export const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ← 必须是 service role key
)
```

### RLS 策略

```sql
-- 新的 RLS 策略允许 service_role 和公开读取
CREATE POLICY "fortunes_select_policy"
  ON fortunes
  FOR SELECT
  USING (
    auth.role() = 'service_role'  -- API 端点
    OR
    true  -- 公开读取（fortune 数据是公开的）
  );
```

## 检查清单 | Checklist

完成以下所有步骤以确保修复成功:

- [ ] ✅ 创建 `.env.local` 文件并填入真实配置
- [ ] ✅ 验证 `SUPABASE_SERVICE_ROLE_KEY` 不是占位符
- [ ] ✅ 应用数据库迁移到 Supabase
- [ ] ✅ 在 Vercel 配置所有环境变量
- [ ] ✅ 触发 Vercel 重新部署
- [ ] ✅ 测试本地 API 端点
- [ ] ✅ 测试生产环境 API 端点
- [ ] ✅ 清除浏览器缓存并测试前端

## 验收标准 | Acceptance Criteria

所有以下测试必须通过:

✅ `/api/fortune/today` 返回 200 状态码
✅ 返回 JSON: `{"ok": true, "hasFortune": boolean, ...}`
✅ 前端 `/fortune` 页面正常显示
✅ 可以成功抽签 (POST `/api/fortune/draw`)
✅ 控制台无 "permission denied" 错误
✅ 控制台无环境变量缺失警告

## 常见问题 | Common Issues

### Q1: 本地开发仍然报错 "permission denied"

**A**: 检查 `.env.local` 文件:
```bash
# 显示当前环境变量（不显示实际值）
node -e "console.log({
  hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
})"
```

### Q2: Vercel 部署后仍然报错

**A**: 
1. 确认环境变量已配置并应用于所有环境
2. 检查 Vercel 部署日志是否有环境变量相关警告
3. 触发完整重新部署（不是简单的 redeploy）

### Q3: 数据库迁移失败

**A**:
```sql
-- 手动清理旧策略
DROP POLICY IF EXISTS "Allow users to view their own fortunes" ON fortunes;
DROP POLICY IF EXISTS "Allow public read fortunes" ON fortunes;

-- 重新创建策略
CREATE POLICY "fortunes_select_policy"
  ON fortunes FOR SELECT
  USING (auth.role() = 'service_role' OR true);
```

### Q4: Service role key 从哪里获取？

**A**: 
1. 访问 Supabase Dashboard
2. 选择你的项目
3. 进入 Settings → API
4. 找到 "Project API keys" 部分
5. 复制 "service_role" secret key（点击眼睛图标显示）
6. ⚠️ 这个 key 非常敏感，只在服务器端使用，不要暴露在客户端

## 相关文件 | Related Files

- **API 端点**: 
  - `pages/api/fortune/today.ts` - 获取今日运势
  - `pages/api/fortune/draw.ts` - 抽签接口
  
- **Supabase 配置**: 
  - `lib/supabase.ts` - Supabase 客户端初始化
  
- **数据库迁移**: 
  - `supabase/migrations/20241224000001_fortunes_rls_service_role_fix.sql`
  
- **环境变量**: 
  - `.env.local` (本地，需手动创建)
  - `.env.example` (模板)
  - Vercel Dashboard (生产环境)

## 安全注意事项 | Security Notes

1. **Service Role Key**: 
   - ⚠️ 仅在服务器端使用（API routes）
   - ⚠️ 永远不要暴露在客户端代码中
   - ⚠️ 不要提交到 Git 仓库
   
2. **RLS Bypass**: 
   - Service role 会绕过所有 RLS 策略
   - API 层必须实现额外的访问控制
   - Fortune API 使用 `session_id` 过滤确保隐私

3. **环境变量**: 
   - `.env.local` 已在 `.gitignore` 中
   - 定期轮换 API keys
   - 使用不同的 keys 用于开发和生产环境

## 需要帮助？ | Need Help?

如果问题仍然存在，请提供以下信息:

1. 错误消息的完整堆栈跟踪
2. 控制台日志输出
3. 环境（本地开发 / Vercel 生产）
4. 已完成的检查清单项目
5. Supabase Dashboard 中的 RLS 策略截图

---

**最后更新**: 2024-12-24
**相关问题**: Permission denied for table fortunes
**修复类型**: Environment Configuration + RLS Policy Update
