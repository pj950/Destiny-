# 🚀 每日一签AI功能快速修复指南

## ⚡ 立即修复（5分钟）

### 步骤1: 替换环境变量

编辑 `.env.local` 文件，替换以下占位符值：

```bash
# ❌ 删除这些测试值
# NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
# GOOGLE_API_KEY=test-google-api-key

# ✅ 添加真实值
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-real-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-real-service-key
GOOGLE_API_KEY=your-real-google-api-key
```

### 步骤2: 获取凭据

**Supabase (2分钟):**
1. 访问 [supabase.com](https://supabase.com)
2. 登录并选择项目
3. Settings → API → 复制URL和密钥

**Google AI (2分钟):**
1. 访问 [AI Studio](https://makersuite.google.com/app/apikey)
2. 创建新密钥
3. 复制API密钥

### 步骤3: 验证修复

```bash
npm run dev

# 测试健康状态
curl http://localhost:3000/api/fortune/health

# 测试抽签功能
curl -X POST http://localhost:3000/api/fortune/draw \
  -H "Content-Type: application/json" \
  -d '{"category": "事业运"}'
```

## 🔍 诊断工具

### 健康检查
访问 `/api/fortune/health` 获取详细状态

### 诊断脚本
```bash
node diagnose-fortune.js
```

## ✅ 成功标志

修复成功后，健康检查应返回：
```json
{
  "status": "healthy",
  "checks": {
    "database": {"status": "pass"},
    "googleAI": {"status": "pass"},
    "environment": {"status": "pass"}
  }
}
```

## 🆘 遇到问题？

1. **数据库连接失败**: 检查Supabase项目是否活跃
2. **AI服务失败**: 确认Google API密钥有Gemini权限
3. **权限错误**: 运行数据库迁移文件

---

**需要帮助？** 查看 `FORTUNE_AI_DIAGNOSIS_AND_FIX.md` 获取详细说明
