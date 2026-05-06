# OpenCode LLM Session Visualizer — Design Doc

> 基于 `react-app-ui.png` 设计图实现的三栏面板布局，支持 back/fwd 在同一 JSONL 文件里切换不同 LLM Round。

---

## 一、UI 布局

```
┌──────────────────────────────────────────────────────────────────┐
│  title  │  ◀ Round 2/3 ▶  │  Session/Events/Duration  │ [Open] │
├─────────┼─────────────────┬┴─────────────────────────────────────┤
│         │                 │  Chat History (without tool)         │
│ Log List│                 │  当前 round 的 messages 文本部分      │
│ Panel   │ System Prompts  │  + llm_text_output (MD 渲染)         │
│         │                 ├──────────────────────────────────────┤
│ 可收缩   │ 当前 round 的   │  Tool History (just tool)            │
│ 点击高亮 │ system prompt   │  当前 round 的 tool_call 配对         │
│         │                 │  可展开 args + result                │
├─────────┴─────────────────┴──────────────────────────────────────┤
│  Sysprompt ~Xk tokens | Chat ~Xk tokens | Round tools | ...     │
└──────────────────────────────────────────────────────────────────┘
```

**核心交互**：Header 中的 `◀ back` / `▶ fwd` 按钮切换当前 Round，中间/右上/右下三个面板内容随之联动更新。

CSS Grid: `grid-template-columns: 260px 1fr 1fr`，收缩时 `36px 1fr 1fr`。

---

## 二、数据流

```
JSONL → parseJSONL() → LogEntry[]
       → groupIntoTurns() → Turn[] (每个 Turn 含 LLMRound[])
       → flatMap rounds → allRounds[]
       → currentRoundIdx 选择当前 round
       → 三个面板各自渲染 currentRound 的对应数据
```

| 面板 | 数据源 | 渲染内容 |
|------|--------|---------|
| **System Prompts** (中) | `round.systemPrompt` | 纯文本 + chars/tokens 统计 |
| **Chat History** (右上) | `round.messages`(仅 text parts) + `round.output` | Markdown 渲染 |
| **Tool History** (右下) | `round.toolCalls[]` | 按 callID 配对，可展开 args/result |
| **Log List** (左) | 全部 entries | 完整日志列表，点击高亮 |
| **Status Bar** (底) | 当前 round 统计 + 全局统计 | tokens / tools / duration |

---

## 三、文件结构

```
opencode/visualizer/
├── src/
│   ├── main.tsx, App.tsx, types.ts, parser.ts
│   └── components/
│       ├── Header.tsx           # + ◀▶ Round 导航
│       ├── LogListPanel.tsx     # 左侧可收缩日志列表
│       ├── SystemPromptPanel.tsx # 接收 round prop
│       ├── ChatHistoryPanel.tsx  # 接收 round prop
│       ├── ToolHistoryPanel.tsx  # 接收 round prop
│       ├── StatusBar.tsx        # 接收 currentRound prop
│       └── MarkdownView.tsx
└── styles/
    ├── global.css, header.css (含 round-nav)
    ├── log-list.css, panels.css, chat.css, tool.css
    ├── statusbar.css, markdown.css
```

---

## 四、技术栈

Vite 6 + React 18 + TypeScript 5 + react-markdown 9 + remark-gfm 4 + react-syntax-highlighter 15

---

*2026-05-06*
