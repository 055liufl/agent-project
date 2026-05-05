# OpenCode LLM 输入输出捕获方案

> 目标：不修改源码，获取 OpenCode 每次向 LLM 发送的完整输入和接收的完整输出。

---

## 方案总览

```
┌─────────────────────────────────────────────────────────────────┐
│                    3 种方案对比                                   │
├──────────────┬──────────┬──────────────┬────────────────────────┤
│  方案         │ 难度     │ 完整度       │ 适用场景               │
├──────────────┼──────────┼──────────────┼────────────────────────┤
│ 1. Plugin    │ 中等     │ ★★★★☆      │ 最佳推荐，覆盖最全      │
│ 2. OTel      │ 低       │ ★★★☆☆      │ 只需时序+元数据         │
│ 3. SSE Event │ 极低     │ ★★☆☆☆      │ 快速调试/粗粒度监控     │
└──────────────┴──────────┴──────────────┴────────────────────────┘
```

---

## 方案一：Plugin Hook（最佳推荐）

### 原理

OpenCode 有完整的 plugin 系统（`@opencode-ai/plugin` 包），插件以函数形式导出，返回一个 `Hooks` 对象。每个 hook 在特定生命周期点被调用，接收 `(input, output)` 参数，可以读取甚至修改数据。

### 相关源文件

| 文件 | 作用 |
|------|------|
| `packages/plugin/src/index.ts` | `Hooks` 接口定义（所有 hook 的完整类型） |
| `packages/plugin/src/example.ts` | 插件示例 |
| `packages/opencode/src/plugin/index.ts` | 插件加载与 trigger 执行逻辑 |
| `packages/opencode/src/session/llm.ts` | LLM 调用处触发 hook 的位置 |
| `packages/opencode/src/session/prompt.ts` | 消息处理处触发 hook 的位置 |

### 与 LLM 输入输出相关的所有 Hooks

```
LLM 调用生命周期：

  用户输入
     │
     ▼
  ┌──────────────────────────────────┐
  │  chat.message                    │ ← 用户消息创建后触发
  │  input:  sessionID, agent,       │
  │          model, messageID        │
  │  output: { message, parts }      │   UserMessage + Part[]
  └──────────┬───────────────────────┘
             │
             ▼
  ┌──────────────────────────────────────────────┐
  │  experimental.chat.messages.transform        │ ← 消息列表组装后、发送前
  │  input:  {}                                  │
  │  output: { messages: [{info, parts}, ...] }  │   ★ 完整消息历史
  └──────────┬───────────────────────────────────┘
             │
             ▼
  ┌──────────────────────────────────────────────┐
  │  experimental.chat.system.transform          │ ← system prompt 组装后
  │  input:  { sessionID, model }                │
  │  output: { system: string[] }                │   ★ 完整 system prompt 数组
  └──────────┬───────────────────────────────────┘
             │
             ▼
  ┌──────────────────────────────────────────────┐
  │  chat.params                                 │ ← API 调用参数确定后
  │  input:  { sessionID, agent, model,          │
  │           provider, message }                │
  │  output: { temperature, topP, topK,          │
  │           maxOutputTokens, options }         │
  └──────────┬───────────────────────────────────┘
             │
             ▼
  ┌──────────────────────────────────┐
  │  chat.headers                    │ ← HTTP 请求头确定后
  │  input:  (同 chat.params)        │
  │  output: { headers: {...} }      │
  └──────────┬───────────────────────┘
             │
             ▼
        ┌────────────┐
        │  LLM API   │ ← streamText() 发起调用
        │  调用       │
        └────┬───────┘
             │
             ▼
  ┌──────────────────────────────────────────────┐
  │  tool.execute.before                         │ ← 工具调用前
  │  input:  { tool, sessionID, callID }         │
  │  output: { args: any }                       │   ★ 工具参数
  └──────────┬───────────────────────────────────┘
             │
             ▼
  ┌──────────────────────────────────────────────┐
  │  tool.execute.after                          │ ← 工具调用后
  │  input:  { tool, sessionID, callID, args }   │
  │  output: { title, output, metadata }         │   ★ 工具返回结果
  └──────────┬───────────────────────────────────┘
             │
             ▼
  ┌──────────────────────────────────────────────┐
  │  experimental.text.complete                  │ ← LLM 文本生成完成
  │  input:  { sessionID, messageID, partID }    │
  │  output: { text: string }                    │   ★ LLM 文本输出
  └──────────┬───────────────────────────────────┘
             │
             ▼
  ┌──────────────────────────────────┐
  │  event                           │ ← 所有 Bus 事件（兜底）
  │  input:  { event: Event }        │   全局事件流
  └──────────────────────────────────┘
```

### Hooks 接口完整类型定义

```typescript
// 来源: packages/plugin/src/index.ts (第 222-333 行)

export interface Hooks {
  // === 全局事件 ===
  event?: (input: { event: Event }) => Promise<void>
  config?: (input: Config) => Promise<void>

  // === 自定义工具 ===
  tool?: { [key: string]: ToolDefinition }

  // === 认证 ===
  auth?: AuthHook
  provider?: ProviderHook

  // === LLM 输入相关 ===

  /** 用户消息创建后 */
  "chat.message"?: (
    input: {
      sessionID: string
      agent?: string
      model?: { providerID: string; modelID: string }
      messageID?: string
      variant?: string
    },
    output: { message: UserMessage; parts: Part[] },
  ) => Promise<void>

  /** 修改发送给 LLM 的参数 */
  "chat.params"?: (
    input: {
      sessionID: string
      agent: string
      model: Model
      provider: ProviderContext
      message: UserMessage
    },
    output: {
      temperature: number
      topP: number
      topK: number
      maxOutputTokens: number | undefined
      options: Record<string, any>
    },
  ) => Promise<void>

  /** 修改发送给 LLM 的 HTTP 请求头 */
  "chat.headers"?: (
    input: {
      sessionID: string
      agent: string
      model: Model
      provider: ProviderContext
      message: UserMessage
    },
    output: { headers: Record<string, string> },
  ) => Promise<void>

  // === 工具调用 ===

  /** 工具调用前 */
  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: any },
  ) => Promise<void>

  /** 工具调用后 */
  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string; args: any },
    output: { title: string; output: string; metadata: any },
  ) => Promise<void>

  /** 修改工具定义（description + parameters） */
  "tool.definition"?: (
    input: { toolID: string },
    output: { description: string; parameters: any },
  ) => Promise<void>

  // === Experimental ===

  /** 修改完整消息列表（发送前） */
  "experimental.chat.messages.transform"?: (
    input: {},
    output: { messages: { info: Message; parts: Part[] }[] },
  ) => Promise<void>

  /** 修改 system prompt（组装后） */
  "experimental.chat.system.transform"?: (
    input: { sessionID?: string; model: Model },
    output: { system: string[] },
  ) => Promise<void>

  /** LLM 文本生成完成 */
  "experimental.text.complete"?: (
    input: { sessionID: string; messageID: string; partID: string },
    output: { text: string },
  ) => Promise<void>

  // === 权限/命令/会话 ===

  "permission.ask"?: (
    input: Permission,
    output: { status: "ask" | "deny" | "allow" },
  ) => Promise<void>

  "command.execute.before"?: (
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Part[] },
  ) => Promise<void>

  "shell.env"?: (
    input: { cwd: string; sessionID?: string; callID?: string },
    output: { env: Record<string, string> },
  ) => Promise<void>

  "experimental.session.compacting"?: (
    input: { sessionID: string },
    output: { context: string[]; prompt?: string },
  ) => Promise<void>

  "experimental.compaction.autocontinue"?: (
    input: {
      sessionID: string; agent: string; model: Model;
      provider: ProviderContext; message: UserMessage; overflow: boolean
    },
    output: { enabled: boolean },
  ) => Promise<void>
}
```

### 插件示例骨架

```typescript
// my-llm-logger-plugin.ts
import { Plugin } from "@opencode-ai/plugin"
import { appendFileSync } from "fs"

const log = (label: string, data: any) =>
  appendFileSync("/tmp/opencode-llm.jsonl",
    JSON.stringify({ ts: Date.now(), label, data }) + "\n")

export const server: Plugin = async (_ctx) => ({

  // ★ 捕获完整 system prompt
  "experimental.chat.system.transform": async (input, output) => {
    log("system", { sessionID: input.sessionID, model: input.model, system: output.system })
  },

  // ★ 捕获完整消息历史（发送给 LLM 的 messages 数组）
  "experimental.chat.messages.transform": async (_input, output) => {
    log("messages", output.messages.map(m => ({
      role: m.info.role,
      parts: m.parts,
    })))
  },

  // ★ 捕获 LLM 调用参数
  "chat.params": async (input, output) => {
    log("params", {
      sessionID: input.sessionID,
      agent: input.agent,
      model: { provider: input.model.providerID, model: input.model.id },
      temperature: output.temperature,
      topP: output.topP,
      maxOutputTokens: output.maxOutputTokens,
    })
  },

  // ★ 捕获工具调用前
  "tool.execute.before": async (input, output) => {
    log("tool.before", { tool: input.tool, callID: input.callID, args: output.args })
  },

  // ★ 捕获工具调用后
  "tool.execute.after": async (input, output) => {
    log("tool.after", {
      tool: input.tool, callID: input.callID,
      title: output.title, output: output.output, metadata: output.metadata,
    })
  },

  // ★ 捕获 LLM 文本输出
  "experimental.text.complete": async (input, output) => {
    log("llm.output", {
      sessionID: input.sessionID,
      messageID: input.messageID,
      text: output.text,
    })
  },

  // 兜底：所有事件
  event: async ({ event }) => {
    log("event", event)
  },
})
```

### 注册方式

在项目的 `opencode.json` 中添加：

```json
{
  "plugin": [
    "./my-llm-logger-plugin.ts"
  ]
}
```

### 能捕获 vs 不能捕获

```
✅ 能捕获的：
  ├─ 完整 system prompt 数组          (experimental.chat.system.transform)
  ├─ 完整消息历史 (messages[])        (experimental.chat.messages.transform)
  ├─ 模型/参数/provider 信息          (chat.params)
  ├─ HTTP 请求头                      (chat.headers)
  ├─ 用户消息 + Parts                 (chat.message)
  ├─ 工具调用参数                     (tool.execute.before)
  ├─ 工具调用结果                     (tool.execute.after)
  ├─ LLM 文本输出（最终完整文本）     (experimental.text.complete)
  └─ 所有 Bus 事件                    (event)

⚠️ 不直接暴露的：
  ├─ LLM 原始 HTTP response body（流式 SSE chunks）
  ├─ token 用量统计（需从 event 事件中提取）
  └─ 最终发送给 API 的完整 request body（需自行拼接 system + messages + tools）

❌ 无法捕获的：
  └─ 底层 HTTP 传输层细节（需 HTTP 代理）
```

---

## 方案二：OpenTelemetry

### 配置方式

在 `opencode.json` 中设置：

```json
{
  "experimental": {
    "openTelemetry": true
  }
}
```

### 原理

- Vercel AI SDK 的 `streamText()` 支持 `experimental_telemetry` 选项
- 启用后会产出 OTEL span，包含 `functionId: "session.llm"` 及 metadata（userId, sessionId）
- 需要配合 OTEL Collector（如 Jaeger、Honeycomb）收集数据

### 相关源码

```typescript
// packages/opencode/src/session/llm.ts:406-414
experimental_telemetry: {
  isEnabled: cfg.experimental?.openTelemetry,
  functionId: "session.llm",
  tracer: telemetryTracer,
  metadata: {
    userId: cfg.username ?? "unknown",
    sessionId: input.sessionID,
  },
}
```

### 局限

- 默认只记录 metadata 和时序信息，不包含完整 prompt 内容
- 需要额外配置 OTEL exporter 和 collector
- Vercel AI SDK 的 telemetry 可通过 `recordInputs`/`recordOutputs` 控制是否记录内容，但 opencode 没有暴露这些选项的配置

---

## 方案三：SSE Event Stream

### 使用方式

OpenCode 内置 HTTP server（默认端口 4096），暴露 SSE 端点：

```bash
curl -N http://localhost:4096/event
```

### 原理

```typescript
// packages/opencode/src/server/routes/instance/event.ts
const unsub = Bus.subscribeAll((event) => {
  q.push(JSON.stringify(event))
})
```

广播所有 `Bus` 事件，包括：
- 会话创建/更新
- 消息创建/更新/删除
- 文件编辑事件
- 错误事件

### 局限

- 事件是处理后的业务事件，不是原始 API 请求/响应
- 粒度较粗，不包含 system prompt 或完整 messages 数组
- 适合快速调试和监控，不适合完整 IO 记录

---

## 方案四（补充）：HTTP 代理拦截

如果需要捕获 **最底层的原始 HTTP 请求/响应**（包括流式 chunks），可以在 provider 配置中将 `baseURL` 指向本地代理：

```
OpenCode → mitmproxy / litellm proxy → 实际 LLM API
```

### 实现方式

1. 启动 litellm proxy 或 mitmproxy
2. 在 `opencode.json` 的 provider 配置中修改 `baseURL` 指向代理
3. 代理记录所有请求/响应

这是唯一能拿到原始 HTTP body（含流式 chunks）的方式，但设置成本较高。

---

## 最终建议

```
需求场景                              推荐方案
──────────────────────────────────────────────────
调试/了解 prompt 内容                  → 方案一 Plugin（最全面）
性能分析/调用链追踪                    → 方案二 OTel
快速看看发生了什么                     → 方案三 SSE curl
需要原始 HTTP body + 流式 chunks       → 方案四 HTTP 代理
完整记录所有输入输出用于分析           → 方案一 + 方案四 组合
```

**方案一（Plugin）是最佳选择**：零依赖、纯 TypeScript、覆盖 LLM 生命周期所有关键节点、通过配置文件注册即可生效。唯一需要注意的是 `experimental.*` 前缀的 hook 未来可能有 breaking change。

---

*基于 `packages/opencode/` 和 `packages/plugin/` 源码分析 | 2026-05-05*
