# OpenCode System Prompt 与工具调用深度解析

> 基于 `packages/opencode/` 源码分析，涵盖所有 system prompt、tool prompt 及其组装逻辑。

---

## 目录

1. [架构总览](#1-架构总览)
2. [System Prompt 组装流程](#2-system-prompt-组装流程)
3. [Provider 级 System Prompt（9 套）](#3-provider-级-system-prompt9-套)
4. [Agent 级 Prompt（4 套）](#4-agent-级-prompt4-套)
5. [模式控制 Prompt（4 套）](#5-模式控制-prompt4-套)
6. [工具定义与 Prompt（16 个工具）](#6-工具定义与-prompt16-个工具)
7. [Skill 与 Permission 系统](#7-skill-与-permission-系统)
8. [关键设计模式总结](#8-关键设计模式总结)

---

## 1. 架构总览

OpenCode 是一个基于 TypeScript + Effect.ts 的多模型 AI 编程助手 CLI 工具。其 prompt 体系采用**分层组装**架构：

```
┌─────────────────────────────────────────────────────────┐
│                    最终 System Message                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Agent Prompt   │  │ Provider     │  │ Environment  │  │
│  │ (可选,按Agent │  │ Prompt       │  │ Block        │  │
│  │  类型注入)     │  │ (按模型选择) │  │ (cwd/git/os) │  │
│  └───────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│          │                 │                 │          │
│          ▼                 ▼                 ▼          │
│  ┌─────────────────────────────────────────────────┐    │
│  │            System Messages 数组 (有序拼接)        │    │
│  └─────────────────────────────────────────────────┘    │
│          │                                              │
│          ▼                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Custom Msgs   │  │ Skills Info  │  │ Mode Prompt  │  │
│  │ (用户自定义)  │  │ (可用技能)   │  │ (plan/build) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Tool Definitions (按 Agent 权限过滤后注入)              │
└─────────────────────────────────────────────────────────┘
```

**关键源文件：**

| 文件 | 职责 |
|------|------|
| `src/session/system.ts` | Provider prompt 选择 + 环境信息 + Skills 注入 |
| `src/session/llm.ts` | 组装所有 system message + 工具调用流式处理 |
| `src/session/prompt/*.txt` | 13 个 Provider/模式 prompt 文件 |
| `src/agent/prompt/*.txt` | 4 个 Agent prompt 文件 |
| `src/tool/*.ts` | 16+ 个工具定义 |
| `src/tool/registry.ts` | 工具注册中心 |

---

## 2. System Prompt 组装流程

**源文件：** `src/session/system.ts` + `src/session/llm.ts`

### 2.1 Provider Prompt 路由逻辑

```
provider(model) 路由规则：
┌──────────────────────────┬───────────────────────┐
│  模型 ID 包含             │  选用 Prompt          │
├──────────────────────────┼───────────────────────┤
│  "gpt-4" / "o1" / "o3"  │  beast.txt            │
│  "gpt" + "codex"         │  codex.txt            │
│  "gpt" (其他)            │  gpt.txt              │
│  "gemini-"               │  gemini.txt           │
│  "claude"                │  anthropic.txt        │
│  "trinity" (不区分大小写) │  trinity.txt          │
│  "kimi" (不区分大小写)    │  kimi.txt             │
│  其他所有模型             │  default.txt          │
└──────────────────────────┴───────────────────────┘
```

### 2.2 环境信息注入

每次调用都会生成如下环境块：

```xml
You are powered by the model named {model.api.id}.
The exact model ID is {providerID}/{model.api.id}

Here is some useful information about the environment you are running in:
<env>
  Working directory: /path/to/project
  Workspace root folder: /path/to/worktree
  Is directory a git repo: yes
  Platform: linux
  Today's date: Mon May 05 2026
</env>
```

### 2.3 完整组装顺序

```
System Messages = [
  1. Agent-specific prompt      (如 explore.txt, 仅子 Agent 有)
  2. Provider-specific prompt   (如 anthropic.txt, 按模型路由)
  3. Custom system messages      (外部注入)
  4. User message system override
  5. Skills information          (可用技能列表, 条件注入)
  6. Structured output requirements (如有)
  7. Mode prompts               (plan.txt / build-switch.txt, 按模式注入)
]
```

---

## 3. Provider 级 System Prompt（9 套）

### 3.1 anthropic.txt — Claude 模型

**文件：** `src/session/prompt/anthropic.txt`（106 行）

**定位：** "You are OpenCode, the best coding agent on the planet."

**核心特征：**
- 强调 **TodoWrite 工具**进行任务管理和进度追踪
- 要求"专业客观性"——技术准确 > 讨好用户
- 推荐使用 Task 工具委托子 Agent 进行代码探索
- 详细的 TodoWrite 使用示例（含两个 `<example>` 块）
- 代码引用格式 `file_path:line_number`

**关键指令摘要：**
```
- NEVER 生成/猜测 URL
- 只在用户要求时使用 emoji
- CLI 输出保持简短
- 大量使用 TodoWrite 跟踪任务
- 文件搜索优先使用 Task 工具委托子 Agent
- 并行调用独立工具
- 使用专用工具代替 bash 命令（Read > cat, Edit > sed）
```

---

### 3.2 gpt.txt — OpenAI GPT 模型

**文件：** `src/session/prompt/gpt.txt`（108 行）

**定位：** "You are a deeply pragmatic, effective software engineer."

**核心特征：**
- 最小化修改原则（"The best changes are often the smallest correct changes"）
- 高度自治：除非用户问问题/头脑风暴，否则直接实现代码
- 多工作者协同意识（不回退未知更改）
- 双通道输出：`commentary`（中间更新）+ `final`（完成响应）
- 前端任务有专门的设计指导
- Git 安全规则严格（NEVER 使用 `git reset --hard`）

**独特设计 — 双通道输出：**
```
┌─────────────────────────────────────┐
│  commentary 通道                     │
│  - 短小进度更新                      │
│  - 发现/权衡/阻碍/计划              │
│  - 不要叙述常规读取和搜索            │
├─────────────────────────────────────┤
│  final 通道                          │
│  - 完成的响应                        │
│  - 复杂度匹配任务                    │
│  - 简单任务 = 一句话                 │
└─────────────────────────────────────┘
```

---

### 3.3 beast.txt — 高级 GPT 模型 (GPT-4/o1/o3)

**文件：** `src/session/prompt/beast.txt`（148 行）

**定位：** 最激进的自治模式

**核心特征：**
- **强制互联网研究**："THE PROBLEM CAN NOT BE SOLVED WITHOUT EXTENSIVE INTERNET RESEARCH"
- 递归 URL 抓取（webfetch 获取链接后继续抓取子链接）
- 10 步结构化工作流（Fetch → Understand → Investigate → Research → Plan → Implement → Debug → Test → Iterate → Validate）
- 内建 Memory 系统（`.github/instructions/memory.instruction.md`）
- 绝不允许自动 git commit
- resume/continue 关键字自动恢复上次任务

**工作流图：**
```
用户输入
   │
   ▼
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 1.Fetch │───▶│ 2.理解   │───▶│ 3.调查   │───▶│ 4.研究   │
│  URLs   │    │  问题    │    │  代码库  │    │  (Google)│
└─────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                     │
   ┌─────────────────────────────────────────────────┘
   ▼
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 5.计划  │───▶│ 6.实现   │───▶│ 7.调试   │───▶│ 8.测试   │
│ (todo)  │    │ (增量)   │    │ (根因)   │    │ (频繁)   │
└─────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                     │
                                    ┌────────────────┘
                                    ▼
                              ┌──────────┐    ┌──────────┐
                              │ 9.迭代   │───▶│10.验证   │
                              │ (循环)   │    │ (全面)   │
                              └──────────┘    └──────────┘
```

---

### 3.4 gemini.txt — Google Gemini 模型

**文件：** `src/session/prompt/gemini.txt`（156 行）

**定位：** 严谨的约定遵守者

**核心特征：**
- 5 大"核心指令"：约定遵守、库验证、风格模仿、惯用修改、注释节制
- 完整的"新应用构建"工作流（6 步：理解→提案→审批→实现→验证→反馈）
- 安全规则突出（修改文件系统前必须解释命令）
- 大量示例（8 个 `<example>` 块覆盖各种场景）
- 研究/数据处理独立指南

---

### 3.5 codex.txt — OpenAI Codex 模型

**文件：** `src/session/prompt/codex.txt`（80 行）

**定位：** "You are OpenCode, the best coding agent on the planet."

**核心特征：**
- 偏好 `apply_patch` 工具进行代码编辑
- ASCII 优先编辑约束
- 专用工具 > Shell 命令的使用策略
- Git 工作区卫生规则
- 前端设计反"AI 风格"指导
- 双通道输出 + 文件引用格式规范

---

### 3.6 kimi.txt — Kimi 模型

**文件：** `src/session/prompt/kimi.txt`（96 行）

**定位：** 通用 AI Agent，强调行动导向

**核心特征：**
- 强调 `<system-reminder>` 标签的权威性（"you MUST follow"）
- 推荐并行工具调用以提升效率
- 用户语言自动匹配
- AGENTS.md 文件作为项目信息源
- 最小修改原则
- 禁止未经请求的 git 操作

---

### 3.7 copilot-gpt-5.txt — GitHub Copilot GPT-5

**文件：** `src/session/prompt/copilot-gpt-5.txt`（144 行）

**定位：** "Expert AI programming assistant"

**核心特征：**
- 完整 `<gptAgentInstructions>` 块，强调自治完成
- `<structuredWorkflow>` 8 步工作流
- `<codeSearchInstructions>` 代码搜索策略
- `<codeSearchToolUseInstructions>` 工具选择指导（semantic_search vs grep_search vs search_workspace_symbols）
- `<outputFormatting>` 详细格式化规则（KaTeX 数学公式支持）
- `<toolUseInstructions>` 工具使用策略
- 独特的 checklist 风格代码块格式（`// ...existing code...` 语法）

---

### 3.8 trinity.txt — Trinity 模型

**文件：** `src/session/prompt/trinity.txt`（同 default.txt 内容）

**定位：** 极简模式，与 default.txt 共享内容

**核心特征：**
- 回答必须 < 4 行
- 最小 token 输出
- 单词回答为最佳

---

### 3.9 default.txt — 默认回退

**文件：** `src/session/prompt/default.txt`（106 行）

**定位：** 所有未匹配模型的回退 prompt

**核心特征：**
- 极简 CLI 风格（< 4 行回答）
- 无前言后语
- 安全约定遵守
- 不添加注释除非被要求
- Task 工具委托文件搜索

---

## 4. Agent 级 Prompt（4 套）

Agent prompt 在 Provider prompt 之前注入，为特定子 Agent 提供角色定义。

```
┌───────────────────────────────────────────┐
│              Agent 体系                    │
├───────────┬───────────────────────────────┤
│  explore  │ 文件搜索专家                  │
│  summary  │ PR 描述生成器                 │
│  title    │ 会话标题生成器                │
│ compaction│ 上下文压缩助手                │
└───────────┴───────────────────────────────┘
```

### 4.1 explore.txt — 文件搜索专家

```
角色：file search specialist
工具：Glob (模式匹配), Grep (内容搜索), Read (文件读取), Bash (文件操作)
约束：
  - 不创建文件
  - 不修改系统状态
  - 返回绝对路径
  - 不使用 emoji
```

### 4.2 summary.txt — PR 描述生成器

```
角色：pull request description writer
规则：
  - 2-3 句话
  - 描述变更，非过程
  - 第一人称 ("I added...", "I fixed...")
  - 不提及测试/构建步骤
  - 保留未回答的问题原文
```

### 4.3 title.txt — 会话标题生成器

```
角色：title generator
规则：
  - 单行，≤50 字符
  - 使用用户的语言
  - 保留技术术语/数字/文件名
  - 删除 the/this/my/a/an
  - 永远不使用工具
  - 10 个参考示例
```

### 4.4 compaction.txt — 上下文压缩助手

```
角色：anchored context summarization assistant
规则：
  - 只总结给定的对话历史
  - 如有 <previous-summary>，更新而非重写
  - 保留文件路径和标识符
  - 简洁 bullet > 段落
  - 不回答对话内容本身
  - 使用对话语言
```

---

## 5. 模式控制 Prompt（4 套）

OpenCode 支持 Plan / Build 双模式切换：

```
┌──────────┐   plan_exit 工具   ┌──────────┐
│          │  ───────────────▶  │          │
│  PLAN    │                    │  BUILD   │
│  MODE    │  ◀───────────────  │  MODE    │
│          │   用户切换回 plan   │          │
└──────────┘                    └──────────┘
     │                               │
     ▼                               ▼
  plan.txt                     build-switch.txt
  plan-reminder-anthropic.txt
  (READ-ONLY 约束)             (解除只读，允许修改)
```

### 5.1 plan.txt — Plan 模式（通用）

```
CRITICAL: Plan mode ACTIVE - READ-ONLY
- 严禁任何文件编辑/修改/系统变更
- 不可使用 sed/tee/echo/cat 等修改命令
- bash 命令仅限读取/检查
- 此约束覆盖所有其他指令（包括用户直接请求）
```

### 5.2 plan-reminder-anthropic.txt — Plan 模式（Anthropic 增强）

5 阶段工作流：
```
Phase 1: Initial Understanding
  └─ 启动最多 3 个 Explore Agent 并行探索代码库
Phase 2: Planning
  └─ 启动 Plan 子 Agent 制定方案
Phase 3: Synthesis
  └─ 综合各 Agent 视角，向用户确认权衡
Phase 4: Final Plan
  └─ 更新计划文件
Phase 5: Call ExitPlanMode
  └─ 结束规划，等待用户批准
```

### 5.3 build-switch.txt — 切换到 Build 模式

```
"Your operational mode has changed from plan to build."
→ 解除 read-only 约束
→ 允许文件修改、Shell 执行、工具调用
```

### 5.4 max-steps.txt — 步数上限

```
CRITICAL - MAXIMUM STEPS REACHED
→ 工具全部禁用
→ 仅限文本响应
→ 必须包含：已完成摘要 + 未完成任务 + 下步建议
```

---

## 6. 工具定义与 Prompt（16 个工具）

**源文件：** `src/tool/registry.ts` + `src/tool/*.ts`

### 6.1 工具全景图

```
┌─────────────────────────────────────────────────────────────┐
│                      Tool Registry                           │
├─────────────┬────────────────────────────────────────────────┤
│  文件操作    │  read · write · edit · glob · grep            │
│             │  apply_patch                                   │
├─────────────┼────────────────────────────────────────────────┤
│  执行/Shell  │  shell                                        │
├─────────────┼────────────────────────────────────────────────┤
│  Agent 委托  │  task                                         │
├─────────────┼────────────────────────────────────────────────┤
│  任务管理    │  todowrite                                    │
├─────────────┼────────────────────────────────────────────────┤
│  用户交互    │  question                                     │
├─────────────┼────────────────────────────────────────────────┤
│  网络        │  webfetch · websearch                         │
├─────────────┼────────────────────────────────────────────────┤
│  技能        │  skill                                        │
├─────────────┼────────────────────────────────────────────────┤
│  代码智能    │  lsp                                          │
├─────────────┼────────────────────────────────────────────────┤
│  模式控制    │  plan_exit                                    │
├─────────────┼────────────────────────────────────────────────┤
│  错误处理    │  invalid                                      │
└─────────────┴────────────────────────────────────────────────┘
```

### 6.2 各工具详解

#### read — 文件/目录读取

| 属性 | 值 |
|------|------|
| **ID** | `read` |
| **参数** | `filePath` (必需), `offset` (可选, 1-indexed), `limit` (可选, 默认 2000) |

**Description Prompt 要点：**
- 读取文件或目录
- 返回格式：`<行号>: <内容>`
- 超过 2000 字符的行会截断
- 支持图片文件和 PDF（作为附件返回）
- 检测二进制文件并拒绝读取
- 鼓励并行调用多文件读取

---

#### write — 文件写入

| 属性 | 值 |
|------|------|
| **ID** | `write` |
| **参数** | `filePath` (必需), `content` (必需) |

**Description Prompt 要点：**
- 覆盖已有文件
- 修改已有文件前必须先 Read
- 优先 Edit 而非 Write
- 自动创建父目录
- 不主动创建 .md/README 文件

---

#### edit — 精确字符串替换

| 属性 | 值 |
|------|------|
| **ID** | `edit` |
| **参数** | `filePath` (必需), `oldString` (必需), `newString` (必需), `replaceAll` (可选) |

**Description Prompt 要点：**
- 编辑前必须先 Read
- 注意行号前缀格式（`行号: 内容`），不要包含前缀
- oldString 必须唯一，否则失败
- 支持 `replaceAll` 全局替换

**内部实现亮点 — 9 级回退匹配策略：**
```
1. Simple              (精确匹配)
2. LineTrimmed         (行首尾空白容错)
3. BlockAnchor         (Levenshtein 距离)
4. WhitespaceNormalized(空白归一化)
5. IndentationFlexible (缩进弹性)
6. EscapeNormalized    (转义归一化)
7. MultiOccurrence     (多次出现处理)
8. TrimmedBoundary     (边界修剪)
9. ContextAware        (上下文感知)
```

---

#### glob — 文件模式匹配

| 属性 | 值 |
|------|------|
| **ID** | `glob` |
| **参数** | `pattern` (必需), `path` (可选) |

**Description Prompt 要点：**
- 支持 `**/*.js`、`src/**/*.ts` 等模式
- 按修改时间排序返回（最新优先）
- 最多返回 100 个匹配
- 底层使用 ripgrep

---

#### grep — 内容正则搜索

| 属性 | 值 |
|------|------|
| **ID** | `grep` |
| **参数** | `pattern` (必需), `path` (可选), `include` (可选) |

**Description Prompt 要点：**
- 完整正则语法支持
- `include` 参数过滤文件类型（如 `*.js`）
- 按修改时间排序
- 最多 100 个匹配
- 底层使用 ripgrep
- **不要使用 bash grep**，使用此工具

---

#### shell — Shell 命令执行

| 属性 | 值 |
|------|------|
| **ID** | `shell` |
| **参数** | `command` (必需), `description` (必需), `timeout` (可选), `workdir` (可选) |

**Description Prompt 要点：**
- 动态生成，包含平台特定的 Shell 介绍
- 要求提供命令描述（5-10 词）
- 默认 2 分钟超时
- 输出超限截断
- 使用 tree-sitter 解析命令

---

#### apply_patch — 补丁应用

| 属性 | 值 |
|------|------|
| **ID** | `apply_patch` |
| **参数** | `patchText` (必需) |

**补丁格式：**
```
*** Begin Patch
*** Add File: <path>        ← 新建文件，后续行以 + 开头
*** Delete File: <path>     ← 删除文件，无后续内容
*** Update File: <path>     ← 修改文件，含 hunk 块
*** End Patch
```

---

#### task — 子 Agent 委托

| 属性 | 值 |
|------|------|
| **ID** | `task` |
| **参数** | `description` (必需), `prompt` (必需), `subagent_type` (必需), `task_id` (可选), `command` (可选) |

**Description Prompt 要点：**
- 用于复杂多步任务的自治处理
- 可通过 `task_id` 恢复之前的子 Agent 会话
- 权限从父会话继承（deny 规则 + external_directory）
- 可并行启动多个 Agent
- Agent 结果对用户不可见，需主动转述

---

#### todowrite — 任务追踪

| 属性 | 值 |
|------|------|
| **ID** | `todowrite` |
| **参数** | `todos` (必需, 数组: content + status + priority) |

**Description Prompt 要点：**
- 状态：`pending` / `in_progress` / `completed` / `cancelled`
- 优先级：`high` / `medium` / `low`
- 复杂任务（3+ 步骤）时使用
- 完成即标记，不批量处理

---

#### question — 用户提问

| 属性 | 值 |
|------|------|
| **ID** | `question` |
| **参数** | `questions` (必需, 问题数组) |

**Description Prompt 要点：**
- 收集用户偏好/需求
- 澄清模糊指令
- 支持多选 (`multiple: true`)
- 推荐选项放第一个，加 "(Recommended)"

---

#### webfetch — URL 内容抓取

| 属性 | 值 |
|------|------|
| **ID** | `webfetch` |
| **参数** | `url` (必需), `format` (可选: text/markdown/html), `timeout` (可选) |

**Description Prompt 要点：**
- HTTP 自动升级 HTTPS
- 支持 markdown/text/html 格式
- 5MB 内容限制
- Cloudflare 防机器人检测回退

---

#### websearch — Web 搜索

| 属性 | 值 |
|------|------|
| **ID** | `websearch` |
| **参数** | `query` (必需), `numResults` (可选), `livecrawl` (可选), `type` (可选), `contextMaxCharacters` (可选) |

**Description Prompt 要点：**
- 使用 Exa AI 后端
- 搜索类型：auto / fast / deep
- 爬取模式：fallback / preferred
- 模板变量 `{{year}}` 注入当前年份

---

#### skill — 技能加载

| 属性 | 值 |
|------|------|
| **ID** | `skill` |
| **参数** | `name` (必需) |

**Description Prompt 要点：**
- 注入技能指令和资源到当前对话
- 技能名必须匹配 system prompt 中列出的技能
- 返回技能内容（XML 标签包装）+ 目录文件列表

---

#### lsp — 语言服务器协议

| 属性 | 值 |
|------|------|
| **ID** | `lsp` |
| **参数** | `operation` (必需, 9 种), `filePath` (必需), `line` (必需, 1-based), `character` (必需, 1-based), `query` (可选) |

**支持的 9 种 LSP 操作：**
```
goToDefinition · findReferences · hover
documentSymbol · workspaceSymbol · goToImplementation
prepareCallHierarchy · incomingCalls · outgoingCalls
```

---

#### plan_exit — 退出 Plan 模式

| 属性 | 值 |
|------|------|
| **ID** | `plan_exit` |
| **参数** | 无 |

**行为：**
- 提示用户确认切换到 Build Agent
- 批准后注入 build-switch.txt 并创建合成用户消息
- 拒绝则抛出 RejectedError

---

#### invalid — 无效工具处理

| 属性 | 值 |
|------|------|
| **ID** | `invalid` |
| **参数** | `tool` (工具名), `error` (错误信息) |

**行为：** 当 LLM 调用不存在的工具时返回错误提示。

---

## 7. Skill 与 Permission 系统

### 7.1 Skill 注入

Skills 在 system prompt 中以详细（verbose）格式呈现：

```typescript
// system.ts
skills: (agent) => {
  if (Permission.disabled(["skill"], agent.permission).has("skill"))
    return undefined  // Agent 无 skill 权限则不注入

  const list = skill.available(agent)
  return [
    "Skills provide specialized instructions and workflows...",
    Skill.fmt(list, { verbose: true }),  // verbose 版本在 system prompt
  ].join("\n")
}
```

### 7.2 Permission 模型

```
┌──────────────────────────────────────────┐
│  Agent Permission Ruleset                 │
├──────────────────────────────────────────┤
│  allow: [tool_id, ...]                   │
│  deny:  [tool_id, ...]                   │
│  ask:   [tool_id, ...]                   │
│  external_directory: [path, ...]         │
├──────────────────────────────────────────┤
│  子 Agent 继承父会话的 deny 规则          │
│  + external_directory 限制               │
└──────────────────────────────────────────┘
```

---

## 8. 关键设计模式总结

### 8.1 各 Provider Prompt 的设计哲学对比

```
┌──────────────┬────────────┬────────────┬──────────┬──────────┐
│   维度        │ Anthropic  │ GPT        │ Beast    │ Gemini   │
├──────────────┼────────────┼────────────┼──────────┼──────────┤
│ 自治程度      │ 中等       │ 高         │ 极高     │ 中等     │
│ 任务管理      │ TodoWrite  │ 无特殊要求 │ Markdown │ 无特殊   │
│              │ 重度依赖   │            │ todo     │ 要求     │
├──────────────┼────────────┼────────────┼──────────┼──────────┤
│ 互联网依赖    │ 低         │ 低         │ 极高     │ 低       │
│ 输出详细度    │ 简短       │ 按需       │ 详细     │ 极简     │
│ 验证要求      │ 中等       │ 高         │ 极高     │ 高       │
│ Git 安全      │ 标准       │ 严格       │ 严格     │ 标准     │
│ 前端设计指导  │ 无         │ 有         │ 无       │ 有       │
└──────────────┴────────────┴────────────┴──────────┴──────────┘
```

### 8.2 Prompt 分层设计的优势

```
  用户请求
     │
     ▼
┌─────────────────┐
│  模型路由        │ ← 不同 LLM 有不同的"性格"和指令风格
│  (system.ts)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agent 专精      │ ← explore/plan/summary 各有分工
│  (agent/prompt)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  模式约束        │ ← plan=只读 / build=可写 / max-steps=停止
│  (mode prompts) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  环境 + 技能     │ ← 运行时动态注入
│  (system.ts)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  工具权限过滤    │ ← 按 Agent 权限决定可用工具集
│  (registry.ts)  │
└─────────────────┘
```

### 8.3 共性规则（所有 Prompt 共享）

1. **安全第一** — 不暴露密钥、不自动 commit、不执行破坏性 git 命令
2. **约定遵守** — 模仿已有代码风格、验证库可用性
3. **工具优先** — Read > cat, Edit > sed, Grep > grep
4. **并行执行** — 独立工具调用尽量并行
5. **CLI 风格** — Markdown 输出、简短回答、无 emoji
6. **代码引用** — `file_path:line_number` 格式

---

*文档生成时间：2026-05-05 | 基于 OpenCode 源码 `packages/opencode/` 目录分析*
