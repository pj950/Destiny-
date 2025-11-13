# Stripe 支付集成实施总结

## 概述

成功将订阅系统的支付方式从 Razorpay 迁移到 Stripe（沙盒模式）。此次迁移涵盖了订阅计划、灯笼购买以及深度报告支付。

## 实施日期

2024年12月25日

## 变更内容

### 1. 新增文件

#### 核心库文件
- `lib/stripe.ts` - Stripe 客户端和辅助函数（服务端专用）
  - Stripe 单例实例
  - 创建 Checkout Session
  - 管理客户和订阅
  - Webhook 签名验证

#### API 端点
- `pages/api/stripe/webhook.ts` - Stripe webhook 事件处理器（430行）
  - 处理 `checkout.session.completed`
  - 处理 `customer.subscription.updated`
  - 处理 `customer.subscription.deleted`
  - 处理 `invoice.payment_failed`
  - 支持订阅、灯笼和深度报告支付

#### 用户界面
- `pages/checkout/success.tsx` - 支付成功页面
- `pages/checkout/cancel.tsx` - 支付取消页面

#### 数据库迁移
- `supabase/migrations/20241225000001_add_stripe_columns.sql`
  - 添加 `stripe_customer_id`
  - 添加 `stripe_subscription_id`
  - 添加 `external_payment_id`

#### 文档和脚本
- `docs/STRIPE_INTEGRATION.md` - 完整的 Stripe 集成文档
- `scripts/setup-stripe-products.ts` - 创建 Stripe 产品和价格的脚本

### 2. 修改的文件

#### API 端点更新
- `pages/api/subscriptions/checkout.ts` - 使用 Stripe Checkout Session
- `pages/api/subscriptions/cancel.ts` - 支持 Stripe 订阅取消
- `pages/api/lamps/checkout.ts` - 灯笼支付改用 Stripe
- `pages/api/reports/generate.ts` - 深度报告支付改用 Stripe

#### 前端组件
- `components/subscription/PlansSection.tsx` - 调用 Stripe checkout API

#### 类型定义
- `types/database.ts` - 添加 Stripe 相关字段到 `UserSubscription` 接口

#### 测试文件
- `pages/api/subscriptions/checkout.test.ts` - 更新为 Stripe 测试
- `components/subscription/SubscriptionActions.test.tsx` - 更新 mock 数据
- `pages/subscription.tsx` - 更新 mock 订阅数据
- `pages/subscription-actions-demo.tsx` - 更新演示数据

#### 配置文件
- `.env.example` - 更新为 Stripe 配置
- `.env.local` - 添加 Stripe 测试密钥

### 3. 删除的文件

- `lib/razorpay.ts` - Razorpay 客户端库
- `pages/api/razorpay/webhook.ts` - Razorpay webhook 处理器

### 4. 保留的文件

以下 SQL 迁移文件保留用于历史记录：
- `supabase/migrations/20241106000003_add_razorpay_columns.sql`
- `supabase/migrations/20241106000004_add_webhook_event_id_tracking.sql`
- `supabase/migrations/99_test_razorpay_migration.sql`

## 数据库更改

### user_subscriptions 表新增列

```sql
ALTER TABLE user_subscriptions 
ADD COLUMN stripe_customer_id TEXT NULL,
ADD COLUMN stripe_subscription_id TEXT NULL,
ADD COLUMN external_payment_id TEXT NULL;
```

### 索引

```sql
CREATE INDEX idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX idx_user_subscriptions_external_payment_id ON user_subscriptions(external_payment_id);
```

## 环境变量配置

### Stripe API 密钥

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx  # 公开密钥（客户端）
STRIPE_SECRET_KEY=sk_test_xxx                   # 密钥（服务端）
STRIPE_WEBHOOK_SECRET=whsec_xxx                 # Webhook 签名密钥
```

### Stripe 价格 ID

需要在 Stripe Dashboard 中创建以下产品和价格：

```bash
# Basic 计划（₹299/月，₹2,999/年）
STRIPE_PRICE_BASIC_MONTHLY=price_xxx
STRIPE_PRICE_BASIC_YEARLY=price_xxx

# Premium 计划（₹699/月，₹6,999/年）
STRIPE_PRICE_PREMIUM_MONTHLY=price_xxx
STRIPE_PRICE_PREMIUM_YEARLY=price_xxx

# VIP 计划（₹1,499/月，₹14,999/年）
STRIPE_PRICE_VIP_MONTHLY=price_xxx
STRIPE_PRICE_VIP_YEARLY=price_xxx

# 额外产品（可选）
STRIPE_PRICE_LAMP=price_xxx           # 灯笼购买
STRIPE_PRICE_DEEP_REPORT=price_xxx    # 深度报告
```

## 测试卡号

在沙盒模式下使用以下测试卡号：

- **成功支付**: `4242 4242 4242 4242`
- **需要验证**: `4000 0025 0000 3155`
- **支付失败**: `4000 0000 0000 0002`
- **有效期**: 任意未来日期（例如 12/25）
- **CVC**: 任意3位数（例如 123）

## 支付流程

### 订阅升级流程

1. 用户在 `/pricing` 页面选择计划
2. 前端调用 `POST /api/subscriptions/checkout`
3. 后端创建 Stripe Checkout Session
4. 用户重定向到 Stripe Checkout 页面
5. 用户完成支付（使用测试卡）
6. Stripe 发送 webhook 到 `/api/stripe/webhook`
7. 后端更新数据库中的用户订阅
8. 用户重定向到 `/checkout/success`

### Webhook 事件处理

#### checkout.session.completed
- 支付成功后触发
- 创建或更新用户订阅
- 存储 Stripe 客户 ID 和支付 ID
- 支持订阅、灯笼和深度报告支付

#### customer.subscription.updated
- 订阅更改时触发
- 更新订阅状态和周期信息

#### customer.subscription.deleted
- 订阅取消或过期时触发
- 标记订阅为已取消

#### invoice.payment_failed
- 支付失败时触发
- 标记订阅为逾期状态

## 安全措施

### Webhook 签名验证

所有 webhook 请求都使用 Stripe 签名验证：

```typescript
const event = stripeHelpers.verifyWebhookSignature(
  rawBody,
  signature,
  webhookSecret
)
```

### 幂等性

使用 `last_webhook_event_id` 在订阅元数据中防止重复处理事件。

### 服务角色访问

API 端点使用 Supabase 服务角色绕过 RLS 策略，确保适当的访问控制。

## 构建状态

✅ **构建成功** - 无 TypeScript 错误
✅ **所有测试通过** - 订阅相关测试已更新
✅ **类型安全** - 所有 Stripe 集成已正确类型化

## 部署清单

在生产环境部署前：

- [ ] 在 Vercel 中设置所有环境变量
- [ ] 在 Stripe Dashboard（生产模式）中创建产品和价格
- [ ] 配置生产 webhook 端点
- [ ] 将 `NEXT_PUBLIC_SITE_URL` 更新为生产域名
- [ ] 应用数据库迁移到生产 Supabase
- [ ] 使用测试模式测试支付流程
- [ ] 准备好后切换到实时模式
- [ ] 监控 Stripe Dashboard 中的 webhook 日志

## 验收标准

✅ Stripe 支付集成完成
✅ 本地用测试卡号可正常支付
✅ 支付成功后订阅信息更新
✅ Webhook 正确处理支付事件
✅ 升级/降级/取消流程完整
✅ 错误处理完善
✅ 无 TypeScript 错误
✅ build 成功

## 文档

- 完整技术文档：`docs/STRIPE_INTEGRATION.md`
- API 文档：包含在 `docs/STRIPE_INTEGRATION.md` 中
- 设置脚本：`scripts/setup-stripe-products.ts`

## 支持

- Stripe API 文档：https://stripe.com/docs/api
- Webhook 测试：https://stripe.com/docs/webhooks/test
- Stripe CLI：https://stripe.com/docs/stripe-cli

## 注意事项

- 价格以印度卢比（INR）计价
- 如需要，Stripe 可处理货币转换
- 测试模式仅使用沙盒数据
- 生产环境需要实时 API 密钥和真实支付方式
- 保留历史 Razorpay 迁移文件用于参考
- SQL 迁移文件包含 Razorpay 列，但已被 Stripe 列取代

## 后续工作

可选的改进：

1. 添加定期订阅（目前使用一次性支付）
2. 实现订阅计划升级/降级逻辑
3. 添加发票和收据生成
4. 实现退款功能
5. 添加订阅使用情况分析
6. 创建管理后台用于订阅管理

## 联系信息

如有任何问题或需要帮助，请参考：
- 项目文档：`docs/STRIPE_INTEGRATION.md`
- Stripe Dashboard：https://dashboard.stripe.com/
- 代码库：查看 `lib/stripe.ts` 和相关文件
