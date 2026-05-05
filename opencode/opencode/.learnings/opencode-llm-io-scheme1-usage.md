# LLM IO Logger Plugin 使用手册

> 基于 OpenCode Plugin Hook 系统，捕获每个 turn 到 LLM 的完整输入和完整输出。

---

## 文件结构

```
项目根目录/
├── .opencode/
│   └── opencode.jsonc          ← 插件注册配置
├── opencode/
│   └── plugins/
│       └── llm-io-logger/
│           └── index.ts        ← 插件源码
└── logs/                       ← 运行时自动创建，JSONL 输出目录
    ├── {sessionID-1}.jsonl     ← 会话 1 的所有 turn
    ├── {sessionID-2}.jsonl     ← 会话 2 的所有 turn
    └── ...
```

---

## 配置

在 `.opencode/opencode.jsonc` 中添加 `plugin` 字段：

```jsonc
{
  // ... 其他配置 ...
  "plugin": [
    "./opencode/plugins/llm-io-logger/index.ts"
  ]
}
```

路径以 `./` 开头，相对于项目根目录。OpenCode 使用 Bun 运行时，可直接 import `.ts` 文件。

---

## 输出格式

每个会话生成一个独立的 JSONL 文件（`logs/{sessionID}.jsonl`）。同一会话内的所有 turn（用户输入 → 多轮工具调用 → 最终结果）按时间顺序 append 到同一文件中。

### 事件类型

每一行是一个 JSON 对象，通过 `type` 字段区分：

```
一个完整 turn 的事件序列：

  ┌─────────────────────┐
  │  user_message        │  用户消息（原始输入 + Parts）
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  system_prompt       │  完整 system prompt 数组
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  messages            │  发送给 LLM 的完整消息历史
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  chat_params         │  模型参数（temperature, topP 等）
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  tool_call_before    │  ┐
  │  tool_call_after     │  ├─ 可能有多轮工具调用
  │  tool_call_before    │  │
  │  tool_call_after     │  ┘
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  llm_text_output     │  LLM 最终文本输出
  └─────────────────────┘
```

### 各 type 的字段说明

#### `system_prompt` — 完整 System Prompt

```json
{
  "ts": "2026-05-05T10:00:00.000Z",
  "type": "system_prompt",
  "sessionID": "abc123",
  "model": { "providerID": "anthropic", "modelID": "claude-sonnet-4-20250514" },
  "system": [
    "You are OpenCode, the best coding agent...",
    "You are powered by the model named claude...",
    "Skills provide specialized instructions..."
  ]
}
```

#### `messages` — 发送给 LLM 的完整消息历史

```json
{
  "ts": "2026-05-05T10:00:00.100Z",
  "type": "messages",
  "sessionID": "abc123",
  "agent": "primary",
  "messages": [
    {
      "role": "user",
      "id": "msg-001",
      "parts": [{ "type": "text", "text": "Fix the bug in auth.ts" }]
    },
    {
      "role": "assistant",
      "id": "msg-002",
      "parts": [{ "type": "text", "text": "Let me look at the file..." }]
    }
  ]
}
```

#### `chat_params` — LLM 调用参数

```json
{
  "ts": "2026-05-05T10:00:00.200Z",
  "type": "chat_params",
  "sessionID": "abc123",
  "agent": "primary",
  "model": { "providerID": "anthropic", "modelID": "claude-sonnet-4-20250514" },
  "params": {
    "temperature": 0.7,
    "topP": 0.9,
    "topK": 40,
    "maxOutputTokens": 16384
  }
}
```

#### `user_message` — 用户消息

```json
{
  "ts": "2026-05-05T10:00:00.050Z",
  "type": "user_message",
  "sessionID": "abc123",
  "agent": "primary",
  "messageID": "msg-003",
  "message": { "role": "user", "content": "..." },
  "parts": [{ "type": "text", "text": "..." }]
}
```

#### `tool_call_before` — 工具调用前

```json
{
  "ts": "2026-05-05T10:00:01.000Z",
  "type": "tool_call_before",
  "sessionID": "abc123",
  "tool": "read",
  "callID": "call-001",
  "args": { "filePath": "/path/to/auth.ts", "offset": 0 }
}
```

#### `tool_call_after` — 工具调用后

```json
{
  "ts": "2026-05-05T10:00:02.000Z",
  "type": "tool_call_after",
  "sessionID": "abc123",
  "tool": "read",
  "callID": "call-001",
  "args": { "filePath": "/path/to/auth.ts" },
  "result": {
    "title": "Read auth.ts",
    "output": "1: import express from 'express';\n2: ...",
    "metadata": { "lines": 150 }
  }
}
```

#### `llm_text_output` — LLM 文本输出

```json
{
  "ts": "2026-05-05T10:00:05.000Z",
  "type": "llm_text_output",
  "sessionID": "abc123",
  "messageID": "msg-004",
  "partID": "part-001",
  "text": "I found the bug in auth.ts:42. The issue is..."
}
```

---

## 使用示例

### 查看最近的日志

```bash
# 列出所有会话日志
ls -lt logs/*.jsonl

# 查看某个会话的所有事件
cat logs/{sessionID}.jsonl | jq .

# 只看 system prompt
cat logs/{sessionID}.jsonl | jq 'select(.type == "system_prompt")'

# 只看 LLM 输出
cat logs/{sessionID}.jsonl | jq 'select(.type == "llm_text_output") | .text'

# 只看完整消息历史
cat logs/{sessionID}.jsonl | jq 'select(.type == "messages") | .messages'

# 只看工具调用
cat logs/{sessionID}.jsonl | jq 'select(.type | startswith("tool_call"))'

# 统计各事件类型数量
cat logs/{sessionID}.jsonl | jq -r '.type' | sort | uniq -c | sort -rn
```

### 用 Python 分析

```python
import json

def read_session(path):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]

events = read_session("logs/session-abc123.jsonl")

# 提取所有 system prompt
prompts = [e for e in events if e["type"] == "system_prompt"]

# 提取所有 LLM 文本输出
outputs = [e["text"] for e in events if e["type"] == "llm_text_output"]

# 提取完整对话流
for e in events:
    print(f"[{e['ts']}] {e['type']}")
```

---

## 捕获覆盖范围

```
✅ 完整捕获：
  ├─ System prompt（所有 system message，含 provider prompt + env + skills）
  ├─ 消息历史（发送给 LLM 的完整 messages 数组）
  ├─ 用户消息（原始 UserMessage + Parts）
  ├─ 模型参数（temperature, topP, topK, maxOutputTokens）
  ├─ 工具调用参数（tool name + args）
  ├─ 工具调用结果（output + metadata）
  └─ LLM 文本输出（最终完整文本）

⚠️ 不包含：
  ├─ LLM 流式 chunks（只记录最终完整文本）
  ├─ 原始 HTTP request/response body
  └─ Token 用量统计
```

---

## 禁用插件

从 `.opencode/opencode.jsonc` 中移除 plugin 数组项即可：

```jsonc
{
  // "plugin": ["./opencode/plugins/llm-io-logger/index.ts"]
}
```

---

## 注意事项

1. **日志大小** — 每个 turn 会记录完整消息历史（含所有之前的 turn），长会话的 JSONL 会迅速增大。建议定期清理 `logs/` 目录。
2. **性能影响** — 插件使用同步 `appendFileSync` 写入，在极高频调用时可能有微小延迟，一般场景下可忽略。
3. **敏感信息** — 日志包含完整的 system prompt 和消息内容，可能含有 API key 等敏感信息。注意将 `logs/` 加入 `.gitignore`。
4. **experimental 前缀 Hook** — `experimental.chat.system.transform`、`experimental.chat.messages.transform`、`experimental.text.complete` 是实验性 API，未来版本可能变更。

---

*文档生成时间：2026-05-05*
