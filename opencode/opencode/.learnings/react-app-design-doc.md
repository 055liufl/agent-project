# OpenCode LLM Session Visualizer — Design Doc

> 基于 `react-app-ui-2.png` 参考设计实现。

---

## 一、UI 布局

```
┌──────────────────────────────────────────────────────────────────┐
│  OpenCode Visualizer  4efc0886  │ ◀ Round 1/3 ▶ │ 00:24 ULTRAWORKER│
├──────────┬───────────────────────┬───────────────────────────────┤
│          │  System Prompts  3p   │  Chat History   1 item        │
│ Log Files│  ▸ Prompt 1  43,295c  │  👤 [USER] Ultraworker        │
│          │  ▸ Prompt 2  43,295c  │  USER INPUT                   │
│ [拖放区]  │  ▸ Prompt 3  43,295c  │  src/tool 目录下有哪些工具？   │
│          │  (纯文本, 不做MD解析)  │  (Markdown 渲染)              │
│ 150b5e45 │                      ├───────────────────────────────┤
│ 4efc0886 │                      │  Tool Invocations     4 calls │
│          │                      │  #1 read 50ms 868c            │
│          │                      │  #2 read 81ms 23,216c         │
│          │                      │  (JSON高亮 args + XML高亮 result)│
├──────────┴───────────────────────┴───────────────────────────────┤
```

Grid: `150px 1fr 1fr`，无 Status Bar。

---

## 二、核心交互与四面板联动

| 交互 | 行为 | 影响面板 |
|------|------|---------|
| 左侧拖放/点击添加 | 加载 JSONL 文件到文件列表 | 全部 |
| 点击文件列表项 | 切换活跃文件，重置 Round 为 1 | 全部 |
| Header ◀▶ | 在当前文件的 Round 之间切换 | Chat History |
| System Prompt ▸/▾ | 折叠/展开单个 prompt | System Prompts |
| Tool Invocations 行 | 展开查看 args + result | Tool Invocations |

---

## 三、数据流与面板数据范围

```
JSONL files[] → parseJSONL → groupIntoTurns → turns[].rounds[]
activeFileIdx → 当前文件
currentRoundIdx → 当前 Round（Header ◀▶ 控制）
```

| 面板 | 数据范围 | 数据源 | 切换触发 |
|------|---------|--------|---------|
| **System Prompts** | 当前文件所有 system_prompt 条目 | `allEntries.filter(type=system_prompt)` | 切换文件 |
| **Chat History** | 仅当前 JSONL 自身数据 | `turn.userMessage` + `round.output` | 切换文件/Round |
| **Tool Invocations** | 当前文件所有 Round 的工具调用 | `allRounds.flatMap(r => r.toolCalls)` | 切换文件 |

**关键设计**：Chat History 不使用 messages 快照（含跨文件历史），只用 `user_message` 和 `llm_text_output` 条目。

---

## 四、渲染策略

| 内容类型 | 渲染方式 | 组件 |
|---------|---------|------|
| **USER INPUT**（用户输入） | Markdown 渲染 | `MarkdownView` |
| **System Prompts** | 纯文本（不做 MD 解析，保留 XML 标签） | `<pre>` |
| **CONTEXT / LLM OUTPUT** | 语法高亮代码块 | `CodeBlockView(language="markdown")` |
| **Tool Args** | JSON 语法高亮 | `CodeBlockView(language="json")` |
| **Tool Result** | XML 语法高亮 | `CodeBlockView(language="xml")` |

Chat History 中消息来源通过 `source` 字段区分：

| source | 含义 | 视觉样式 |
|--------|------|---------|
| `input` | 本轮真实用户输入 | 绿色浅底 + 绿色左边框 + `USER INPUT` 标签 |
| `output` | 本轮 LLM 最终输出 | 蓝色浅底 + 蓝色左边框 + `LLM OUTPUT` 标签 |

---

## 五、文件结构

```
opencode/visualizer/
├── src/
│   ├── main.tsx, App.tsx, types.ts, parser.ts
│   └── components/
│       ├── Header.tsx              # turnID + Round导航 + 时间 + Agent标签
│       ├── FileListPanel.tsx       # 拖放 + 文件列表
│       ├── SystemPromptPanel.tsx   # 折叠式, 纯文本渲染
│       ├── ChatHistoryPanel.tsx    # source区分 + MarkdownView/CodeBlockView
│       ├── ToolInvocationsPanel.tsx # JSON/XML 语法高亮
│       └── MarkdownView.tsx        # MarkdownView + CodeBlockView 导出
└── styles/
    ├── global.css, header.css, file-list.css
    ├── panels.css, chat.css, tool.css, markdown.css
```

---

## 六、技术栈

Vite 6 + React 18 + TypeScript 5 + react-markdown 9 + remark-gfm 4 + react-syntax-highlighter 15

---

*2026-05-07*
