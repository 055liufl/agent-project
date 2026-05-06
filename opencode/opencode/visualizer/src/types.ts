export interface BaseEntry {
  ts: string
  type: string
  sessionID: string
  turnID: string
}

export interface UserMessageEntry extends BaseEntry {
  type: "user_message"
  agent: string
  messageID: string
  message: {
    id: string
    role: "user"
    sessionID: string
    time: { created: number }
    agent: string
    model: { providerID: string; modelID: string }
  }
  parts: Array<{
    id: string
    type: string
    text: string
    messageID: string
    sessionID: string
  }>
}

export interface SystemPromptEntry extends BaseEntry {
  type: "system_prompt"
  model: { providerID: string; modelID: string }
  system: string[]
}

export interface MessagesEntry extends BaseEntry {
  type: "messages"
  agent: string
  messages: Array<{
    role: "user" | "assistant"
    id: string
    parts: Array<{
      type: string
      text?: string
      [key: string]: unknown
    }>
  }>
}

export interface ChatParamsEntry extends BaseEntry {
  type: "chat_params"
  agent: string
  model: { providerID: string; modelID: string }
  params: {
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
  }
}

export interface ToolCallBeforeEntry extends BaseEntry {
  type: "tool_call_before"
  tool: string
  callID: string
  args: Record<string, unknown>
}

export interface ToolCallAfterEntry extends BaseEntry {
  type: "tool_call_after"
  tool: string
  callID: string
  args: Record<string, unknown>
  result: {
    title: string
    output: string
    metadata: unknown
  }
}

export interface LLMTextOutputEntry extends BaseEntry {
  type: "llm_text_output"
  messageID: string
  partID: string
  text: string
}

export type LogEntry =
  | UserMessageEntry
  | SystemPromptEntry
  | MessagesEntry
  | ChatParamsEntry
  | ToolCallBeforeEntry
  | ToolCallAfterEntry
  | LLMTextOutputEntry

export interface ToolCall {
  tool: string
  callID: string
  args: Record<string, unknown>
  before: ToolCallBeforeEntry
  after?: ToolCallAfterEntry
}

export interface LLMRound {
  index: number
  systemPrompt?: SystemPromptEntry
  messages?: MessagesEntry
  chatParams?: ChatParamsEntry
  toolCalls: ToolCall[]
  output?: LLMTextOutputEntry
}

export interface Turn {
  turnID: string
  sessionID: string
  agent: string
  userMessage?: UserMessageEntry
  rounds: LLMRound[]
  startTime: string
  endTime: string
}
