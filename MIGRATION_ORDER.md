# 迁移文件执行顺序快速参考

## 📋 完整迁移清单（14 个文件）

```
执行顺序 | 文件名                                              | 状态 | 关键内容
--------|---------------------------------------------------|------|------------------
1       | 20241104000001_create_tables.sql                   | ✅   | profiles, charts, jobs
2       | 20241104000002_enable_rls.sql                      | ✅   | RLS 基础策略
3       | 20241104000003_create_storage.sql                  | ✅   | reports 存储桶
4       | 20241104000004_add_jobs_metadata.sql               | ✅   | jobs.metadata
5       | 20241104000005_add_jobs_updated_at.sql             | ✅   | 触发器函数 + jobs 触发器
6       | 20241106000001_create_lamps_table.sql              | ✅   | lamps 表 + 触发器
7       | 20241106000002_create_fortunes_table.sql           | ✅   | fortunes 表
8       | 20241106000003_add_razorpay_columns.sql            | ✅   | Razorpay 支付列
9       | 20241106000004_add_webhook_event_id_tracking.sql   | ✅   | webhook 跟踪
10      | 20241109000001_enable_fortunes_rls.sql             | ✅   | fortunes RLS
11      | 20241110000001_extend_schema_reports_subscriptions.sql | ✅ | 报告系统 ⭐
12      | 20241110000002_add_rag_search_functions.sql        | ✅   | RAG 搜索
13      | 20251111000001_fix_jobs_updated_at_trigger.sql     | ✅   | 触发器验证
14      | 20251111000002_add_lamps_rls_policies.sql          | ✅   | lamps RLS
```

## ⭐ 关键迁移说明

### 迁移 #5: 20241104000005 (触发器函数基础)
- **创建**: `update_updated_at_column()` 函数
- **依赖**: 无
- **被依赖**: 所有后续使用触发器的迁移
- **重要性**: 🔴 必须最先执行

### 迁移 #11: 20241110000001 (报告系统核心)
- **创建**: bazi_reports, bazi_report_chunks, qa_conversations, qa_usage_tracking, user_subscriptions
- **依赖**: pgvector 扩展, update_updated_at_column() 函数
- **被依赖**: RAG 搜索功能, 订阅系统
- **重要性**: 🔴 修复 500 错误的关键

### 迁移 #13: 20251111000001 (验证迁移)
- **作用**: 验证所有触发器正确配置
- **依赖**: 所有前序迁移
- **被依赖**: 无
- **重要性**: 🟡 验证用途，确保幂等性

## 🔗 依赖关系图

```
20241104000005 (触发器函数)
    ├─→ 20241106000001 (lamps 触发器)
    ├─→ 20241110000001 (报告系统触发器)
    └─→ 20251111000001 (触发器验证)

20241104000001 (基础表)
    ├─→ 20241104000002 (RLS)
    ├─→ 20241104000004 (jobs.metadata)
    └─→ 20241104000005 (jobs.updated_at)

20241110000001 (报告系统)
    └─→ 20241110000002 (RAG 搜索)
```

## 🚫 常见错误场景

### ❌ 错误场景 1: 跳过迁移 #5
```
执行 20241106000001 时出错:
ERROR: function update_updated_at_column() does not exist
```
**解决**: 必须先执行 20241104000005

### ❌ 错误场景 2: 跳过迁移 #11
```
API 返回:
Error: relation "bazi_reports" does not exist
```
**解决**: 必须执行 20241110000001

### ❌ 错误场景 3: 多次执行旧版迁移
```
执行时出错:
ERROR: function "update_updated_at_column" already exists
```
**解决**: 新版迁移已修复为幂等，可安全重复执行

## ✅ 快速验证命令

```sql
-- 1. 检查函数
SELECT count(*) FROM information_schema.routines 
WHERE routine_name = 'update_updated_at_column';
-- 预期: 1

-- 2. 检查表
SELECT count(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('bazi_reports', 'user_subscriptions', 'qa_usage_tracking');
-- 预期: 3

-- 3. 检查触发器
SELECT count(*) FROM information_schema.triggers 
WHERE trigger_name LIKE 'update_%_updated_at';
-- 预期: 6

-- 4. 检查扩展
SELECT count(*) FROM pg_extension WHERE extname = 'vector';
-- 预期: 1
```

## 📝 执行日志模板

复制下面的清单，执行时打勾：

```
执行时间: _______________

□ 备份数据库完成
□ 1. create_tables
□ 2. enable_rls
□ 3. create_storage
□ 4. add_jobs_metadata
□ 5. add_jobs_updated_at (触发器函数)
□ 6. create_lamps_table
□ 7. create_fortunes_table
□ 8. add_razorpay_columns
□ 9. add_webhook_event_id_tracking
□ 10. enable_fortunes_rls
□ 11. extend_schema_reports_subscriptions (报告系统)
□ 12. add_rag_search_functions
□ 13. fix_jobs_updated_at_trigger (验证)
□ 14. add_lamps_rls_policies
□ 验证 SQL 全部通过
□ API 测试通过
```

## 🎯 核心要点

1. **必须按顺序执行**: 不能跳过任何迁移
2. **迁移 #5 和 #11 最关键**: 分别创建触发器函数和报告系统
3. **所有迁移现在是幂等的**: 可以安全重复执行
4. **使用 DROP IF EXISTS**: 避免重复执行错误

## 📚 完整文档参考

- [MIGRATION_FIX_REPORT.md](./MIGRATION_FIX_REPORT.md) - 详细修复说明
- [MIGRATION_EXECUTION_CHECKLIST.md](./MIGRATION_EXECUTION_CHECKLIST.md) - 执行检查清单
