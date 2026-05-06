# LLM IO Logger Plugin 使用手册

> 基于 OpenCode Plugin Hook 系统，捕获每个 turn 到 LLM 的完整输入和完整输出。

---

## 文件结构

```
项目根目录/
├── .opencode/
│   └── plugins/
│       └── llm-io-logger.ts          ← 插件文件（自动扫描加载）
└── logs/                             ← 运行时自动创建
    ├── {sessionID-1}/                ← 会话 1
    │   ├── a3f8c1d2.jsonl            ← 第 1 次对话 (turn)
    │   ├── 7b2e9f04.jsonl            ← 第 2 次对话
    │   └── e1c4d890.jsonl            ← 第 3 次对话
    └── {sessionID-2}/                ← 会话 2
        └── f9ab12c7.jsonl
```

**命名规则：**
- 目录名 = `sessionID`（OpenCode 会话 ID）
- 文件名 = `turnID`（UUID 前 8 位），每次用户输入生成新 turnID
- 同一次对话（用户输入 → 多轮工具调用 → 最终结果）的所有事件在同一个 JSONL 文件中

---

## 配置

插件放在 `.opencode/plugins/` 目录下即可，**无需在 config 中手动声明**。OpenCode 启动时自动扫描 `.opencode/{plugin,plugins}/*.{ts,js}` 并加载。

**注意事项：**
- file 类型插件**必须**导出 `id` 字段（如 `export default { id: "llm-io-logger", server }`）
- 插件路径通过 `import.meta.url` 自动推导项目根目录，不依赖 `ctx.directory`（后者受 `--cwd` 影响）

---

## turnID 切换机制

```
Session (持久会话)
│
├── Turn a3f8c1d2 ← chat.message 触发，生成新 turnID
│   ├── user_message
│   ├── system_prompt
│   ├── messages
│   ├── chat_params
│   ├── tool_call_before / after    (可能多轮)
│   └── llm_text_output             ← 不换 ID
│
├── Turn 7b2e9f04 ← 下一个 chat.message 触发，生成新 turnID
│   ├── user_message
│   ├── system_prompt
│   ├── messages
│   ├── chat_params
│   └── llm_text_output
│
└── ...
```

- **新 turnID 的时机：** `chat.message`（用户发送新消息时）
- **不换 ID 的时机：** `llm_text_output`、工具调用——它们属于当前 turn 的一部分

---

## 输出格式

每一行是一个 JSON 对象，所有记录都包含 `turnID` 字段。通过 `type` 字段区分事件类型：

### 各 type 的字段说明

#### `user_message` — 用户消息（turn 的起点）

```json
{
  "ts": "2026-05-05T10:00:00.000Z",
  "type": "user_message",
  "sessionID": "abc123",
  "turnID": "a3f8c1d2",
  "agent": "primary",
  "messageID": "msg-001",
  "message": { "role": "user", "content": "Fix the bug in auth.ts" },
  "parts": [{ "type": "text", "text": "Fix the bug in auth.ts" }]
}
```

#### `system_prompt` — 完整 System Prompt

```json
{
  "ts": "2026-05-05T10:00:00.050Z",
  "type": "system_prompt",
  "sessionID": "abc123",
  "turnID": "a3f8c1d2",
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
  "turnID": "a3f8c1d2",
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
  "turnID": "a3f8c1d2",
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

#### `tool_call_before` — 工具调用前

```json
{
  "ts": "2026-05-05T10:00:01.000Z",
  "type": "tool_call_before",
  "sessionID": "abc123",
  "turnID": "a3f8c1d2",
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
  "turnID": "a3f8c1d2",
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
  "turnID": "a3f8c1d2",
  "messageID": "msg-004",
  "partID": "part-001",
  "text": "I found the bug in auth.ts:42. The issue is..."
}
```

---

## 使用示例

### 查看日志

```bash
# 列出所有会话
ls logs/

# 列出某个会话的所有 turn（按时间排序）
ls -lt logs/{sessionID}/

# 查看某个 turn 的完整事件流
cat logs/{sessionID}/{turnID}.jsonl | jq .

# 只看某 turn 的 system prompt
cat logs/{sessionID}/{turnID}.jsonl | jq 'select(.type == "system_prompt") | .system'

# 只看某 turn 的 LLM 输出
cat logs/{sessionID}/{turnID}.jsonl | jq 'select(.type == "llm_text_output") | .text'

# 只看某 turn 的完整消息历史
cat logs/{sessionID}/{turnID}.jsonl | jq 'select(.type == "messages") | .messages'

# 只看某 turn 的工具调用
cat logs/{sessionID}/{turnID}.jsonl | jq 'select(.type | startswith("tool_call"))'

# 查看某会话所有 turn 的事件统计
for f in logs/{sessionID}/*.jsonl; do
  echo "=== $(basename $f) ==="
  jq -r '.type' "$f" | sort | uniq -c | sort -rn
done
```

### 用 Python 分析

```python
import json
from pathlib import Path

def read_turn(path):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]

def read_session(session_dir):
    """读取一个会话的所有 turn，按文件修改时间排序"""
    turns = {}
    for f in sorted(Path(session_dir).glob("*.jsonl")):
        turns[f.stem] = read_turn(f)
    return turns

# 读取某个会话
session = read_session("logs/session-abc123")

for turn_id, events in session.items():
    print(f"\n=== Turn {turn_id} ({len(events)} events) ===")
    for e in events:
        print(f"  [{e['ts']}] {e['type']}")
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

删除或重命名 `.opencode/plugins/llm-io-logger.ts` 即可（如改为 `.ts.bak`）。

---

## 注意事项

1. **日志大小** — `messages` 类型事件包含完整消息历史（含之前所有 turn 的内容），长会话后期的 turn 文件会较大。建议定期清理 `logs/` 目录。
2. **性能影响** — 插件使用同步 `appendFileSync` 写入，一般场景下可忽略。
3. **敏感信息** — 日志包含完整的 system prompt 和消息内容，注意将 `logs/` 加入 `.gitignore`。
4. **experimental 前缀 Hook** — `experimental.chat.system.transform`、`experimental.chat.messages.transform`、`experimental.text.complete` 是实验性 API，未来版本可能变更。

---

*文档更新时间：2026-05-05*
