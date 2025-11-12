# 数据库迁移执行检查清单

## 📋 执行前准备

### 1. 备份数据库
```bash
# 使用 Supabase CLI 备份（如果可用）
supabase db dump > backup_$(date +%Y%m%d_%H%M%S).sql

# 或在 Supabase Dashboard 中：
# Settings → Database → Database Backups
```

### 2. 确认环境
- [ ] 确认连接到正确的 Supabase 项目
- [ ] 检查是否有生产数据（如有，请格外小心）
- [ ] 准备回滚计划

## 📝 迁移文件清单（按执行顺序）

### ✅ 基础表和配置（2024-11-04）
```
1. 20241104000001_create_tables.sql                    
   创建: profiles, charts, jobs 表
   
2. 20241104000002_enable_rls.sql                       
   启用: RLS 策略 for profiles, charts, jobs
   
3. 20241104000003_create_storage.sql                   
   创建: reports 存储桶
   
4. 20241104000004_add_jobs_metadata.sql                
   添加: jobs.metadata 列
   
5. 20241104000005_add_jobs_updated_at.sql              
   创建: update_updated_at_column() 函数
   添加: jobs.updated_at 列和触发器
```

### ✅ 功能表（2024-11-06）
```
6. 20241106000001_create_lamps_table.sql               
   创建: lamps 表
   添加: lamps updated_at 触发器
   插入: 4个初始灯笼记录
   
7. 20241106000002_create_fortunes_table.sql            
   创建: fortunes 表
   
8. 20241106000003_add_razorpay_columns.sql             
   添加: Razorpay 支付列到 lamps 表
   
9. 20241106000004_add_webhook_event_id_tracking.sql    
   添加: webhook event ID 跟踪
```

### ✅ RLS 策略（2024-11-09）
```
10. 20241109000001_enable_fortunes_rls.sql              
    启用: fortunes 表 RLS 策略
```

### ✅ 报告和订阅系统（2024-11-10）⭐ 重要
```
11. 20241110000001_extend_schema_reports_subscriptions.sql
    启用: pgvector 扩展
    创建: bazi_reports (修复 500 错误)
    创建: bazi_report_chunks (向量搜索)
    创建: qa_conversations
    创建: qa_usage_tracking
    创建: user_subscriptions
    添加: charts 表扩展字段
    添加: 所有新表的 RLS 策略和触发器
    
12. 20241110000002_add_rag_search_functions.sql         
    创建: RAG 搜索函数
```

### ✅ 验证和修复（2025-11-11）
```
13. 20251111000001_fix_jobs_updated_at_trigger.sql      
    验证: 所有触发器正确配置
    
14. 20251111000002_add_lamps_rls_policies.sql           
    添加: lamps 表 RLS 策略
```

## 🚀 执行步骤

### 方法 A: Supabase CLI（推荐）

```bash
# 1. 检查迁移状态
supabase migration list

# 2. 执行所有待处理的迁移
supabase db push

# 3. 验证迁移成功
supabase migration list
```

### 方法 B: SQL Editor（手动）

1. 打开 [Supabase Dashboard](https://app.supabase.com)
2. 选择项目 → SQL Editor
3. 按顺序执行每个迁移文件：

```sql
-- 对每个迁移文件：
-- 1. 复制文件内容
-- 2. 粘贴到 SQL Editor
-- 3. 点击 Run
-- 4. 验证无错误
-- 5. 继续下一个
```

## ✅ 执行后验证

### 1. 验证所有表已创建

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**预期结果**：应包含以下 10 个表
- ✅ bazi_report_chunks
- ✅ bazi_reports ⭐
- ✅ charts
- ✅ fortunes
- ✅ jobs
- ✅ lamps
- ✅ profiles
- ✅ qa_conversations
- ✅ qa_usage_tracking
- ✅ user_subscriptions

### 2. 验证关键表结构

```sql
-- 验证 bazi_reports 表（最重要）
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'bazi_reports' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

**预期列**：
- id (uuid, NOT NULL)
- chart_id (uuid, NOT NULL)
- user_id (uuid, nullable)
- report_type (text, NOT NULL)
- title (text, NOT NULL)
- summary (jsonb, nullable)
- structured (jsonb, nullable)
- body (text, nullable)
- model (text, nullable)
- prompt_version (text, nullable)
- tokens (integer, nullable)
- status (text, NOT NULL)
- created_at (timestamptz)
- updated_at (timestamptz)
- completed_at (timestamptz, nullable)

### 3. 验证 RLS 已启用

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;
```

**预期**：所有表的 `rowsecurity` 应为 `true`

### 4. 验证触发器函数

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_updated_at_column';
```

**预期**：返回 1 行，类型为 FUNCTION

### 5. 验证所有触发器

```sql
SELECT 
  trigger_name, 
  event_object_table as table_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'update_%_updated_at'
ORDER BY event_object_table;
```

**预期触发器**：
- update_bazi_reports_updated_at (bazi_reports)
- update_jobs_updated_at (jobs)
- update_lamps_updated_at (lamps)
- update_qa_conversations_updated_at (qa_conversations)
- update_qa_usage_tracking_updated_at (qa_usage_tracking)
- update_user_subscriptions_updated_at (user_subscriptions)

### 6. 验证 pgvector 扩展

```sql
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'vector';
```

**预期**：返回 1 行，显示 vector 扩展已安装

### 7. 验证 RAG 搜索函数

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'search_%'
ORDER BY routine_name;
```

**预期函数**：
- search_chunks
- search_chunks_across_reports
- search_chunks_by_section
- get_report_chunk_stats (可能)

### 8. 验证 RLS 策略

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**预期**：应有多个策略覆盖所有表

## 🧪 功能测试

### 测试 1: 创建测试档案

```sql
INSERT INTO profiles (name, birth_local, birth_timezone, gender)
VALUES ('测试用户', '1990-01-01T12:00:00', 'Asia/Shanghai', 'male')
RETURNING *;
```

### 测试 2: 创建测试图表

```sql
-- 使用上一步返回的 profile_id
INSERT INTO charts (profile_id, chart_json, wuxing_scores)
VALUES (
  '<profile_id>',
  '{"pillars": []}'::jsonb,
  '{"wood": 20, "fire": 20, "earth": 20, "metal": 20, "water": 20}'::jsonb
)
RETURNING *;
```

### 测试 3: 创建测试报告

```sql
-- 使用上一步返回的 chart_id
INSERT INTO bazi_reports (
  chart_id, 
  report_type, 
  title, 
  status
)
VALUES (
  '<chart_id>',
  'character_profile',
  '测试报告',
  'completed'
)
RETURNING *;
```

### 测试 4: 清理测试数据

```sql
-- 删除测试数据（级联删除会清理相关记录）
DELETE FROM profiles WHERE name = '测试用户';
```

## 📊 监控和日志

### 检查错误日志

在 Supabase Dashboard:
1. 进入 Database → Logs
2. 查看最近的错误和警告
3. 确认无迁移相关错误

### 检查表大小

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🔧 常见问题排查

### 问题 1: "function already exists"
```sql
-- 解决方案：所有函数现在使用 CREATE OR REPLACE
-- 如果仍有问题，手动删除并重新运行迁移
DROP FUNCTION IF EXISTS update_updated_at_column();
```

### 问题 2: "trigger already exists"
```sql
-- 解决方案：手动删除触发器
DROP TRIGGER IF EXISTS update_<table>_updated_at ON <table>;
```

### 问题 3: "table does not exist"
```sql
-- 检查迁移是否按顺序执行
SELECT * FROM _prisma_migrations ORDER BY started_at;
-- 或 Supabase 的迁移跟踪表
```

### 问题 4: API 仍返回 500 错误

1. 验证 bazi_reports 表存在：
```sql
SELECT * FROM pg_tables WHERE tablename = 'bazi_reports';
```

2. 检查表权限：
```sql
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name='bazi_reports';
```

3. 验证 RLS 策略：
```sql
SELECT * FROM pg_policies WHERE tablename = 'bazi_reports';
```

## ✅ 完成检查清单

执行完所有迁移后，确认以下项目：

- [ ] 所有 14 个迁移文件已成功执行
- [ ] 10 个必需表已创建
- [ ] RLS 已在所有表上启用
- [ ] pgvector 扩展已安装
- [ ] 6 个 updated_at 触发器已创建
- [ ] RAG 搜索函数已创建
- [ ] 功能测试通过
- [ ] API 端点正常工作（无 500 错误）
- [ ] 无数据库错误日志

## 🎉 成功标志

当以上所有检查项都通过时：
- ✅ `/api/reports` 返回 200
- ✅ `/api/charts/compute` 返回 200（不再 500）
- ✅ `/api/subscriptions/plans` 返回计划列表
- ✅ 数据库中有完整的表结构
- ✅ 向量搜索功能可用

## 📚 相关文档

- [MIGRATION_FIX_REPORT.md](./MIGRATION_FIX_REPORT.md) - 详细修复说明
- [SUBSCRIPTION_IMPLEMENTATION_SUMMARY.md](./SUBSCRIPTION_IMPLEMENTATION_SUMMARY.md) - 订阅系统实现
- [IMPLEMENTATION_SUMMARY_RAG.md](./IMPLEMENTATION_SUMMARY_RAG.md) - RAG 系统实现

## 🆘 需要帮助？

如果遇到问题：
1. 检查 Supabase Dashboard 的日志
2. 参考 MIGRATION_FIX_REPORT.md 中的常见问题
3. 确认环境变量配置正确
4. 验证 service role key 有正确权限

---

**最后更新**: 2025-11-11  
**状态**: ✅ 所有迁移文件已修复并可执行
