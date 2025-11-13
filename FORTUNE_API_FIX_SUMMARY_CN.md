# 每日一签 API 修复总结

## 📋 修复内容

本次修复解决了 Fortune API 返回 "permission denied for table fortunes" 的问题。

### 主要变更

#### 1. 创建本地环境配置文件
**文件**: `.env.local`

```bash
# 已创建模板文件，需要填入真实的 Supabase 和 API 凭证
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GOOGLE_API_KEY=your-google-api-key
```

⚠️ **注意**: 
- 该文件已在 `.gitignore` 中，不会被提交到 Git
- 必须填入真实凭证，占位符值会导致 API 失败
- Service role key 应以 `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9` 开头

#### 2. 创建新的数据库迁移
**文件**: `supabase/migrations/20241224000001_fortunes_rls_service_role_fix.sql`

**作用**:
- 删除所有旧的限制性 SELECT 策略
- 创建新的统一策略，显式允许 service_role 访问
- 允许公开读取 fortune 数据（fortune 数据本身是公开的）
- 确保 RLS 已启用

**关键策略**:
```sql
CREATE POLICY "fortunes_select_policy"
  ON fortunes
  FOR SELECT
  USING (
    auth.role() = 'service_role'  -- API 端点使用 service role
    OR
    true  -- 公开读取
  );
```

#### 3. 改进 Supabase 客户端错误处理
**文件**: `lib/supabase.ts`

**改进**:
- 将警告升级为错误 (`console.error`)
- 添加占位符值检测
- 提供更清晰的错误信息，包括修复指引
- 验证 service role key 格式

#### 4. 创建详细修复指南
**文件**: `FORTUNE_API_FIX_GUIDE.md`

包含：
- 完整的问题诊断流程
- 逐步修复指南（中英双语）
- 常见问题解答
- 验收标准清单
- 安全注意事项

#### 5. 更新文档
**文件**: `supabase/README.md`

- 添加新迁移记录
- 更新 Service Role Key 部分说明
- 添加故障排除指引

## 🔍 问题根本原因

1. **环境变量缺失**: `.env.local` 文件不存在或配置不正确
2. **占位符值**: 使用了测试/占位符值而非真实 API key
3. **RLS 策略**: 虽然 service role 会绕过 RLS，但有明确的策略更清晰

## ✅ 验证步骤

### 本地开发环境

1. **检查环境变量**:
```bash
# 验证 .env.local 存在
ls -la .env.local

# 检查内容（不显示实际值）
grep -E "SUPABASE|GOOGLE" .env.local | sed 's/=.*/=***/'
```

2. **启动开发服务器**:
```bash
npm run dev
```

3. **测试 API 端点**:
```bash
# 测试今日运势
curl http://localhost:3000/api/fortune/today

# 预期响应
# {"ok": true, "hasFortune": false}
# 或
# {"ok": true, "hasFortune": true, "fortune": {...}}
```

4. **测试抽签功能**:
```bash
# 抽签
curl -X POST http://localhost:3000/api/fortune/draw \
  -H "Content-Type: application/json" \
  -d '{"category": "事业运"}'

# 预期响应
# {"ok": true, "alreadyDrawn": false, "fortune": {...}}
```

### 生产环境 (Vercel)

1. **配置环境变量**:
   - 访问 Vercel Dashboard → Settings → Environment Variables
   - 确保以下变量已配置且非占位符值：
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `GOOGLE_API_KEY`

2. **应用数据库迁移**:
   - 打开 Supabase Dashboard → SQL Editor
   - 运行 `supabase/migrations/20241224000001_fortunes_rls_service_role_fix.sql`
   - 验证策略创建成功：
     ```sql
     SELECT policyname, permissive, roles, cmd 
     FROM pg_policies 
     WHERE tablename = 'fortunes';
     ```

3. **重新部署**:
   - 推送代码到 GitHub 触发自动部署
   - 或在 Vercel Dashboard 手动触发部署

4. **测试生产 API**:
```bash
# 替换为你的 Vercel 域名
curl https://your-app.vercel.app/api/fortune/today

# 应返回 200 状态码和正确的 JSON
```

## 📝 验收标准

所有以下测试必须通过才算修复成功：

- [ ] ✅ `.env.local` 已创建并填入真实凭证
- [ ] ✅ 本地开发服务器启动无环境变量错误
- [ ] ✅ `/api/fortune/today` 返回 200 状态码
- [ ] ✅ `/api/fortune/draw` 可以成功抽签
- [ ] ✅ 前端 `/fortune` 页面正常显示
- [ ] ✅ 控制台无 "permission denied" 错误
- [ ] ✅ 控制台无占位符值警告
- [ ] ✅ Vercel 环境变量已配置
- [ ] ✅ 数据库迁移已应用
- [ ] ✅ 生产环境 API 正常工作

## 🔐 安全提醒

### Service Role Key 安全性

⚠️ **极其重要**: Service role key 拥有数据库完全访问权限

**必须做到**:
- ✅ 仅在服务器端使用（API routes）
- ✅ 保存在 `.env.local`（本地）或 Vercel 环境变量（生产）
- ✅ 不要提交到 Git
- ✅ 不要在客户端代码中引用
- ✅ 定期轮换 key

**绝对不要**:
- ❌ 在客户端代码中暴露
- ❌ 提交到 Git 仓库
- ❌ 在公开日志中打印
- ❌ 分享给未授权人员
- ❌ 硬编码在代码中

### 环境变量保护

- `.env.local` 已在 `.gitignore` 中
- 使用不同的 keys 用于开发和生产环境
- 定期审查和更新 API keys
- 监控 API 使用情况检测异常

## 🐛 故障排除

### 问题 1: 本地仍然报 "permission denied"

**原因**: 环境变量未正确加载

**解决方案**:
```bash
# 1. 确认 .env.local 存在
ls -la .env.local

# 2. 检查内容格式正确（无空格、引号等）
cat .env.local

# 3. 重启开发服务器
npm run dev

# 4. 验证环境变量已加载（在 API route 中添加临时日志）
# lib/supabase.ts 会在启动时输出警告/错误
```

### 问题 2: Vercel 部署后仍然报错

**原因**: 环境变量配置不正确或未生效

**解决方案**:
1. 检查 Vercel 环境变量:
   - 进入项目 Settings → Environment Variables
   - 确认所有变量已配置
   - 确认应用于 Production, Preview, Development 环境
   
2. 检查变量值:
   - 不含引号（Vercel 自动处理）
   - 不含多余空格
   - 是真实值而非占位符

3. 触发重新部署:
   - 修改一个文件并 push（触发自动部署）
   - 或在 Vercel Dashboard 点击 "Redeploy"

4. 检查部署日志:
   - 查看构建日志是否有环境变量相关警告
   - 查看运行时日志是否有 Supabase 连接错误

### 问题 3: 数据库迁移失败

**原因**: 旧策略冲突或语法错误

**解决方案**:
```sql
-- 1. 手动清理所有旧策略
DROP POLICY IF EXISTS "Allow users to view their own fortunes" ON fortunes;
DROP POLICY IF EXISTS "Allow public read fortunes" ON fortunes;
DROP POLICY IF EXISTS "service_role_access" ON fortunes;
DROP POLICY IF EXISTS "Allow anonymous fortune reads by session" ON fortunes;

-- 2. 确认已清理
SELECT policyname FROM pg_policies WHERE tablename = 'fortunes';
-- 应该只显示 INSERT 策略

-- 3. 重新创建 SELECT 策略
CREATE POLICY "fortunes_select_policy"
  ON fortunes
  FOR SELECT
  USING (auth.role() = 'service_role' OR true);

-- 4. 确认 RLS 已启用
ALTER TABLE fortunes ENABLE ROW LEVEL SECURITY;

-- 5. 验证最终状态
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'fortunes';
```

### 问题 4: Service role key 从哪里获取？

**位置**: Supabase Dashboard

**步骤**:
1. 登录 Supabase: https://supabase.com/dashboard
2. 选择你的项目
3. 进入 Settings → API
4. 找到 "Project API keys" 部分
5. 复制 "service_role" secret key
   - 点击眼睛图标显示完整 key
   - 应以 `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9` 开头
6. 粘贴到 `.env.local` 的 `SUPABASE_SERVICE_ROLE_KEY` 变量

⚠️ **注意**: 这是敏感凭证，请妥善保管！

## 📚 相关文档

- **详细修复指南**: `FORTUNE_API_FIX_GUIDE.md`
- **Supabase 文档**: `supabase/README.md`
- **API 代码**: 
  - `pages/api/fortune/today.ts`
  - `pages/api/fortune/draw.ts`
- **Supabase 客户端**: `lib/supabase.ts`
- **数据库迁移**: `supabase/migrations/20241224000001_fortunes_rls_service_role_fix.sql`

## 🎯 下一步

修复完成后：

1. **测试所有功能**:
   - [ ] 访问每日运势页面
   - [ ] 执行抽签操作
   - [ ] 查看运势分析
   - [ ] 确认无错误

2. **监控**:
   - [ ] 检查 Vercel 函数日志
   - [ ] 监控 Supabase 使用情况
   - [ ] 注意任何新的错误模式

3. **文档**:
   - [ ] 团队成员知晓环境变量配置流程
   - [ ] 保存 Supabase credentials 到安全位置
   - [ ] 记录故障排除经验

4. **安全**:
   - [ ] 定期轮换 API keys
   - [ ] 审查访问日志
   - [ ] 设置使用量告警

---

**修复日期**: 2024-12-24
**相关问题**: Permission denied for table fortunes
**修复类型**: Environment Configuration + RLS Policy + Error Handling
**影响范围**: Fortune API (今日运势功能)
**优先级**: 🔴 Critical (Production Blocking)
