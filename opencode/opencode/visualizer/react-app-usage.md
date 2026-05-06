# OpenCode Session Visualizer — 使用手册

> 一个用于可视化 OpenCode LLM 会话日志（`.jsonl`）的 React 前端应用。

---

## 一、快速启动

### 1.1 安装依赖

```bash
cd opencode/visualizer
npm install
```

### 1.2 开发模式（热更新）

```bash
npm run dev
```

默认在 `http://localhost:5173` 启动，修改代码后自动刷新。

### 1.3 生产构建

```bash
npm run build
npm run preview   # 预览构建产物，默认 http://localhost:4173
```

构建产物输出到 `dist/` 目录，可直接部署到任意静态服务器。

---

## 二、使用方式

### 2.1 打开日志文件

1. 启动应用后，浏览器打开页面
2. 点击右上角 **「Open .jsonl」** 按钮
3. 选择一个 `.jsonl` 日志文件（通常位于 `logs/<sessionID>/<turnID>.jsonl`）
4. 文件内容会自动解析并展示

### 2.2 页面结构

```
┌─────────────────────────────────────────────────┐
│  Header：标题 + 当前文件名 + 打开文件按钮        │
├─────────────────────────────────────────────────┤
│                                                  │
│  Turn 卡片                                       │
│  ├── Turn 元信息（ID、Agent、时间、耗时、统计）   │
│  ├── 用户输入（紫色标签）                         │
│  └── LLM Rounds                                  │
│      ├── Round 1                                 │
│      │   ├── ▸ System Prompt   [可折叠]          │
│      │   ├── ▸ Messages        [可折叠]          │
│      │   ├── ▸ Chat Params     [可折叠]          │
│      │   └── ▸ Tool Call: xxx  [可折叠]          │
│      ├── Round 2                                 │
│      │   └── ...                                 │
│      └── Final Round                             │
│          ├── ▸ System Prompt                     │
│          ├── ▸ Messages                          │
│          ├── ▸ Chat Params                       │
│          └── ▸ LLM Output     [默认展开, MD渲染] │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 2.3 交互操作

| 操作 | 说明 |
|------|------|
| 点击 **▸ 条目标题** | 折叠/展开该条目的详细内容 |
| **滚动条** | 长内容区域（System Prompt、工具结果、LLM 输出等）自带滚动条，不会撑开页面 |
| **重新选择文件** | 随时点击「Open .jsonl」切换不同日志文件 |

### 2.4 颜色标识

| 颜色 | 含义 |
|------|------|
| 蓝色 | System Prompt |
| 紫色 | Messages / 用户消息 |
| 灰色 | Chat Params |
| 橙色 | 工具调用（Tool Call） |
| 绿色 | LLM 最终输出 |

---

## 三、支持的日志类型

应用能解析以下 7 种 `type` 的日志行：

| type | 说明 | 展示方式 |
|------|------|---------|
| `user_message` | 用户输入 | Turn 卡片顶部紫色消息栏 |
| `system_prompt` | LLM 的 System Prompt | 可折叠，纯文本渲染 |
| `messages` | 发送给 LLM 的完整消息历史 | 可折叠，按 role 分组，标注 part 类型 |
| `chat_params` | LLM 调用参数 | 可折叠，JSON 格式 |
| `tool_call_before` | 工具调用参数 | 与 after 配对展示在同一条目中 |
| `tool_call_after` | 工具调用结果 | 展示 args + result，纯文本渲染 |
| `llm_text_output` | LLM 最终文本输出 | 默认展开，**Markdown 渲染 + 代码高亮** |

---

## 四、日志文件来源

日志由 OpenCode 的 `llm-io-logger` 插件自动生成，位于项目根目录的 `logs/` 下：

```
logs/
└── ses_<sessionID>/          ← 每个会话一个目录
    ├── <turnID_1>.jsonl      ← 每个 Turn 一个文件
    ├── <turnID_2>.jsonl
    └── ...
```

每个 `.jsonl` 文件包含一个完整 Turn 的所有事件，按时间顺序排列，每行一个 JSON。

---

## 五、技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vite | 6.x | 构建工具 |
| React | 18.x | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| react-markdown | 9.x | Markdown 渲染 |
| remark-gfm | 4.x | GFM 表格/删除线支持 |
| react-syntax-highlighter | 15.x | 代码块语法高亮 |

---

## 六、项目文件结构

```
opencode/visualizer/
├── index.html                 # 入口 HTML
├── package.json               # 依赖与脚本
├── tsconfig.json              # TypeScript 配置
├── vite.config.ts             # Vite 配置
├── src/
│   ├── main.tsx               # React 入口，导入所有 CSS
│   ├── App.tsx                # 根组件（文件加载 + Turn 列表渲染）
│   ├── types.ts               # 7 种日志类型的 TypeScript 接口定义
│   ├── parser.ts              # JSONL 解析 → Turn 分组 → Round 构建
│   └── components/
│       ├── Header.tsx         # 顶部导航栏 + 文件选择器
│       ├── TurnCard.tsx       # Turn 卡片（元信息 + 用户消息 + Rounds）
│       ├── RoundSection.tsx   # 单个 LLM Round 的所有条目
│       ├── LogEntry.tsx       # 可折叠/展开的日志条目
│       └── MarkdownView.tsx   # Markdown + 代码高亮渲染器
└── styles/
    ├── global.css             # 科幻天蓝色主题、网格背景、玻璃效果、滚动条
    ├── header.css             # 深色半透明头部栏
    ├── turn-card.css          # Turn 卡片与用户消息
    ├── round-section.css      # Round 分组与消息列表
    ├── log-entry.css          # 折叠/展开条目
    └── markdown.css           # Markdown 内容渲染样式
```

---

*2026-05-06*
