# OpenCode LLM Session Visualizer — Design Doc

> 基于 `react-app-ui-2.png` 参考设计实现。

---

## 一、UI 布局

```
┌──────────────────────────────────────────────────────────────────┐
│  OpenCode Visualizer  ed81e38c  │ ◀ Turn 1/1 ▶ │ 02:54 SISYPHUS│
├──────────┬───────────────────────┬───────────────────────────────┤
│          │  System Prompts  2p   │  Chat History  2msg 2txt     │
│ Log Files│  ▸ Prompt 1   57c    │  [USER] Sisyphus             │
│          │  ▾ Prompt 2 1,508c   │  当前有哪些 skills            │
│ [拖放区]  │    <agent-identity>  │  [ASSISTANT] Sisyphus        │
│          │    You are Sisyphus.. │  当前可用的 skills 如下:      │
│ ed81e38c │    ...                │  (Markdown 表格渲染)          │
│ 1edc72cd │                      ├───────────────────────────────┤
│ 2998a376 │                      │  Tool Invocations     0 call  │
│          │                      │                               │
├──────────┴───────────────────────┴───────────────────────────────┤
```

Grid: `150px 1fr 1fr`，无 Status Bar。

---

## 二、核心交互

| 交互 | 行为 |
|------|------|
| 左侧拖放/点击添加 | 加载多个 JSONL 文件到文件列表 |
| 点击文件列表项 | 切换当前活跃文件，重置 Turn 为第 1 个 |
| Header ◀▶ | 在当前文件的不同 Turn 之间切换 |
| System Prompt ▸/▾ | 折叠/展开单个 prompt（独立） |
| Tool Invocations 行 | 展开查看 args + result |

---

## 三、数据流

```
JSONL files[] → 每个文件独立 parseJSONL → groupIntoTurns
activeFileIdx → 当前文件的 turns[]
currentTurnIdx → 当前 turn 的 rounds[]
  → System Prompts: 所有 rounds 的 systemPrompt 收集
  → Chat History: 最后一个 round 的 messages(仅 text) + output
  → Tool Invocations: 所有 rounds 的 toolCalls 聚合
```

---

## 四、文件结构

```
opencode/visualizer/
├── src/
│   ├── main.tsx, App.tsx, types.ts, parser.ts
│   └── components/
│       ├── Header.tsx              # turnID + Turn导航 + 时间 + Agent标签
│       ├── FileListPanel.tsx       # 拖放 + 文件列表
│       ├── SystemPromptPanel.tsx   # 折叠式 Prompt 1/2/...
│       ├── ChatHistoryPanel.tsx    # 角色标签(USER绿/ASSISTANT蓝) + MD渲染
│       ├── ToolInvocationsPanel.tsx # 工具调用列表
│       └── MarkdownView.tsx
└── styles/
    ├── global.css       # 白底主题 + Grid
    ├── header.css       # 含 Agent 绿色标签
    ├── file-list.css    # 拖放区 + 文件项
    ├── panels.css       # System Prompt 折叠
    ├── chat.css         # 气泡 + 角色标签
    ├── tool.css         # Tool 列表
    └── markdown.css
```

---

## 五、技术栈

Vite 6 + React 18 + TypeScript 5 + react-markdown 9 + remark-gfm 4 + react-syntax-highlighter 15

---

*2026-05-07*
