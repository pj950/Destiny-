# Gemini Prompt Library

本文件说明 `lib/gemini/` 目录下的核心组件、使用方式与版本扩展流程，便于快速迭代新的 Prompt 方案。

## 目录结构

```
lib/gemini/
  ├── client.ts          // Gemini SDK 客户端：统一的初始化、重试、错误处理
  ├── prompts.ts         // Prompt 工厂：生成三个核心业务 Prompt
  ├── parser.ts          // `parseGeminiJsonResponse` 解析工具
  ├── schemas.ts         // Zod Schema，定义 AI 结构化返回数据
  └── prompts.test.ts    // 单元测试，覆盖 Prompt 与解析流程
```

## 客户端使用说明

- `getGeminiClient()`：按需（lazy）初始化 `GoogleGenerativeAI`，并提供文本生成与向量嵌入的封装。
- 默认模型：
  - 文本：`process.env.GEMINI_MODEL_REPORT` → `GEMINI_MODEL_SUMMARY` → `GEMINI_TEXT_MODEL` → `gemini-2.5-pro`
  - 向量：`process.env.GEMINI_MODEL_EMBEDDING` → `text-embedding-004`
- 支持 `timeout`、`abortSignal`、指数退避重试，并对 429/5xx 及网络瞬时错误自动重试。
- 若环境变量缺失，可使用 `tryGetGeminiClient()` 在开发模式下安全降级。

## Prompt 工厂函数

`prompts.ts` 暴露以下生成器，均内置中文写作规范、JSON 输出要求与业务字段说明：

1. `buildCharacterProfilePrompt(insights)`
   - 输入：`BaziInsights`
   - 输出：角色画像 Prompt，强调 `topTraits` 第三项的升级引导。
2. `buildYearlyFlowPrompt(chart, insights, targetYear)`
   - 输入：原始八字盘、洞察、目标年份
   - 输出：年运导航 Prompt，包含大运/流年拆解、月度时间线、行动清单等。
3. `buildQaPrompt(contextChunks, conversation, question)`
   - 输入：RAG 语境片段、既往对话、当前问题
   - 输出：问答 Prompt，约束引用 `[#chunkId]`、返回结构与跟进建议。

每个 Prompt 都会在文末明确提示：“最终仅输出符合 **Payload Schema** 的 JSON”，并要求使用 Markdown ` ```json ` 代码块包裹结果。

## 结构化 Schema

`schemas.ts` 使用 Zod 定义并导出：

- `CharacterProfilePayloadSchema`
- `YearlyFlowPayloadSchema`
- `QaAnswerPayloadSchema`

同时提供版本常量：

```ts
export const CHARACTER_PROFILE_PROMPT_VERSION = 'character_profile_v1'
export const YEARLY_FLOW_PROMPT_VERSION = 'yearly_flow_v1'
export const QA_PROMPT_VERSION = 'qa_answer_v1'
```

> 注意：`CharacterProfilePayloadSchema` 对第三个 `topTraits` 元素做了自定义校验，要求 `locked: true` 且包含 `upgradeHint`，用于“隐藏特质”经营策略。

## 解析工具

`parseGeminiJsonResponse(raw, schema, options?)`

- 自动识别 Markdown ` ``` ` 代码块，并截取首尾 `{}` 所在片段。
- 标准化引号与尾随逗号，提升解析容错能力。
- 若 JSON 解析或 Zod 校验失败，会抛出包含上下文 snippet 的可读错误信息。
- `options.responseLabel` 可自定义错误前缀，便于日志追踪。

## 如何新增或升级 Prompt 版本

1. **定义 Schema**：在 `schemas.ts` 中新增或升级对应的 Zod Schema，并设定新的 `PROMPT_VERSION` 常量（例如 `character_profile_v2`）。
2. **更新 Prompt**：在 `prompts.ts` 中调整 Prompt 文案，确保：
   - 使用最新的 `PROMPT_VERSION` 常量；
   - 明确写出 JSON 字段定义、字数范围与语气要求；
   - 若新增字段，请将说明补充进 `buildJsonInstruction` 的字段列表。
3. **添加测试**：
   - 在 `prompts.test.ts` 中增加覆盖，确保 Prompt 字符串包含新字段/版本号；
   - 构造示例响应，使用 `parseGeminiJsonResponse` + 新 Schema 校验。
4. **更新文档**：于本文件追加记录，说明版本变更的要点、上线日期与兼容策略。
5. **服务端集成**：在调用 Prompt 的 API/Worker 中引用新的 Schema 及解析逻辑，确保旧数据升级或兼容策略明确。

> 提示：若需要同时支持多版本，可在 Schema 中保留旧版本常量，或通过 `promptVersion` 字段在解析后路由不同的处理逻辑。

## 示例

```ts
import { getGeminiClient } from '@/lib/gemini/client'
import { buildCharacterProfilePrompt } from '@/lib/gemini/prompts'
import { parseGeminiJsonResponse } from '@/lib/gemini/parser'
import { CharacterProfilePayloadSchema } from '@/lib/gemini/schemas'

const prompt = buildCharacterProfilePrompt(insights)
const client = getGeminiClient()
const raw = await client.generateText({ prompt })
const payload = parseGeminiJsonResponse(raw, CharacterProfilePayloadSchema)
```

如需更多示例，可参考 `lib/gemini/prompts.test.ts` 中的测试用例。
