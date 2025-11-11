# 订阅状态卡片组件 (SubscriptionStatusCard)

## 概述

`SubscriptionStatusCard` 是一个用于显示用户订阅信息的React组件，采用神秘主题设计，支持响应式布局和多种状态展示。

## 功能特性

- ✅ 显示订阅等级（Free/Basic/Premium/VIP）
- ✅ 显示订阅状态（有效/过期/已取消/逾期）
- ✅ 显示当前订阅周期
- ✅ 显示下次续费日期
- ✅ 显示自动续费状态
- ✅ 显示配额使用情况
- ✅ 加载状态（Skeleton loading）
- ✅ 错误处理和友好提示
- ✅ 响应式设计（手机端堆叠，桌面端水平布局）
- ✅ 神秘主题样式（深紫背景 + 金色边框 + 发光效果）

## 使用方法

### 基本用法

```tsx
import { SubscriptionStatusCard } from '../components/subscription'

export default function MyPage() {
  const userId = 'user-123' // 从认证系统获取用户ID
  
  return (
    <div>
      <SubscriptionStatusCard userId={userId} />
    </div>
  )
}
```

### 带自定义样式

```tsx
<SubscriptionStatusCard 
  userId={userId} 
  className="mb-6 max-w-2xl mx-auto" 
/>
```

## API 接口

### Props

| 属性名 | 类型 | 必需 | 默认值 | 描述 |
|--------|------|------|--------|------|
| `userId` | `string` | ✅ | - | 用户ID，用于获取订阅数据 |
| `className` | `string` | ❌ | `''` | 额外的CSS类名 |

### 数据结构

组件调用 `/api/subscriptions/current?user_id={userId}` 获取数据，期望返回：

```typescript
{
  ok: true,
  data: {
    tier: 'free' | 'basic' | 'premium' | 'vip',
    plan: string,
    subscription: {
      status: 'active' | 'past_due' | 'canceled' | 'expired',
      current_period_start: string,
      current_period_end: string,
      auto_renew: boolean,
      cancel_at: string | null,
    } | null,
    quota: {
      yearly_flow: { used: number; limit: number | null },
      qa: { used: number; limit: number | null },
    },
  }
}
```

## 样式设计

### 颜色方案

- **背景**: 深紫色到青色渐变 (`from-mystical-purple-900/80 to-mystical-cyan-950/80`)
- **边框**: 金色半透明 (`border-mystical-gold-700/40`)
- **文字**: 主要金色 (`text-mystical-gold-400/500/600`)
- **发光效果**: 金色发光 (`shadow-gold-glow`)

### 状态颜色

- **有效**: 绿色 (`text-green-400`)
- **逾期**: 黄色 (`text-yellow-400`)
- **已取消**: 红色 (`text-red-400`)
- **过期**: 灰色 (`text-gray-400`)

### 等级颜色

- **Free**: 灰色 (`text-gray-400`)
- **Basic**: 蓝色 (`text-blue-400`)
- **Premium**: 紫色 (`text-purple-400`)
- **VIP**: 金色 (`text-yellow-400`)

## 响应式设计

- **移动端**: 垂直堆叠布局，紧凑间距
- **桌面端**: 水平布局，优化空间利用
- **断点**: 使用 `sm:` 前缀进行响应式适配

## 状态处理

### 加载状态
- 显示骨架屏动画
- 使用 `animate-pulse` 类

### 错误状态
- 显示友好的错误消息
- 提供重试机制（通过重新渲染组件）

### 空数据状态
- 显示"暂无订阅信息"
- 适用于免费用户

## 测试

组件包含全面的单元测试，覆盖：

- ✅ 加载状态渲染
- ✅ 成功数据显示
- ✅ 错误状态处理
- ✅ 免费用户显示
- ✅ 取消订阅显示
- ✅ API调用验证
- ✅ 无限配额显示

运行测试：
```bash
npm test -- SubscriptionStatusCard
```

## 集成示例

### 在仪表板中使用

```tsx
import { SubscriptionStatusCard } from '../components/subscription'
import { getCurrentUserId } from '../lib/auth'

export default function Dashboard() {
  const userId = getCurrentUserId()
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto mb-8">
        <SubscriptionStatusCard userId={userId} />
      </div>
      {/* 其他仪表板内容 */}
    </div>
  )
}
```

### 在导航栏中使用

```tsx
import { SubscriptionStatusCard } from '../components/subscription'

export default function Layout({ children }) {
  const userId = useUserId()
  
  return (
    <div>
      <Navbar />
      {/* 可选：在小屏幕上显示简化版本 */}
      <div className="lg:hidden">
        <SubscriptionStatusCard userId={userId} />
      </div>
      <main>{children}</main>
    </div>
  )
}
```

## 依赖项

- React 18+
- Next.js 13+
- Tailwind CSS
- 项目现有的类型定义 (`types/database.ts`)

## 注意事项

1. **用户ID**: 确保传入有效的用户ID，这通常来自认证系统
2. **API可用性**: 确保订阅API端点可用且返回正确格式
3. **样式类**: 组件依赖项目中定义的神秘主题CSS类
4. **TypeScript**: 组件使用TypeScript，确保类型定义正确

## 故障排除

### 常见问题

**Q: 组件显示"加载失败"**
A: 检查API端点是否正常，用户ID是否有效

**Q: 样式显示异常**
A: 确保Tailwind CSS和神秘主题样式已正确加载

**Q: TypeScript错误**
A: 确保已导入正确的类型定义

**Q: 测试失败**
A: 检查mock数据格式是否与API响应匹配

## 更新日志

### v1.0.0 (2024-11-11)
- ✅ 初始版本发布
- ✅ 完整的订阅状态显示
- ✅ 响应式设计
- ✅ 神秘主题样式
- ✅ 全面的测试覆盖