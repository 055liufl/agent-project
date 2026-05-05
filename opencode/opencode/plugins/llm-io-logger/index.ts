import { mkdirSync, appendFileSync, existsSync } from "fs"
import path from "path"

type Hooks = Record<string, any>
type PluginInput = {
  directory: string
  [key: string]: any
}

// Resolve logs directory relative to the project working directory
function logsDir(directory: string): string {
  return path.join(directory, "logs")
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// Sanitize sessionID for use as filename
function sanitize(sessionID: string): string {
  return sessionID.replace(/[^a-zA-Z0-9_-]/g, "_")
}

function logFile(directory: string, sessionID: string): string {
  const dir = logsDir(directory)
  ensureDir(dir)
  return path.join(dir, `${sanitize(sessionID)}.jsonl`)
}

function append(file: string, entry: Record<string, any>) {
  const line = JSON.stringify(entry) + "\n"
  appendFileSync(file, line, "utf-8")
}

const server = async (ctx: PluginInput): Promise<Hooks> => {
  const directory = ctx.directory

  return {
    // ─── LLM 输入：system prompt ───
    "experimental.chat.system.transform": async (
      input: { sessionID?: string; model?: any },
      output: { system: string[] },
    ) => {
      const sid = input.sessionID
      if (!sid) return
      append(logFile(directory, sid), {
        ts: new Date().toISOString(),
        type: "system_prompt",
        sessionID: sid,
        model: input.model
          ? { providerID: input.model.providerID, modelID: input.model.id ?? input.model.modelID }
          : undefined,
        system: output.system,
      })
    },

    // ─── LLM 输入：完整消息列表 ───
    "experimental.chat.messages.transform": async (
      _input: {},
      output: { messages: Array<{ info: any; parts: any[] }> },
    ) => {
      // We don't have sessionID here directly, so we embed it via a closure trick:
      // store latest messages and flush them in chat.params which does have sessionID.
      latestMessages = output.messages.map((m) => ({
        role: m.info?.role,
        id: m.info?.id,
        parts: m.parts,
      }))
    },

    // ─── LLM 输入：调用参数（也用于 flush messages） ───
    "chat.params": async (
      input: { sessionID: string; agent: string; model: any; provider: any; message: any },
      output: { temperature: number; topP: number; topK: number; maxOutputTokens: number | undefined },
    ) => {
      const sid = input.sessionID
      const file = logFile(directory, sid)

      // Flush captured messages
      if (latestMessages) {
        append(file, {
          ts: new Date().toISOString(),
          type: "messages",
          sessionID: sid,
          agent: input.agent,
          messages: latestMessages,
        })
        latestMessages = null
      }

      append(file, {
        ts: new Date().toISOString(),
        type: "chat_params",
        sessionID: sid,
        agent: input.agent,
        model: { providerID: input.model?.providerID, modelID: input.model?.id ?? input.model?.modelID },
        params: {
          temperature: output.temperature,
          topP: output.topP,
          topK: output.topK,
          maxOutputTokens: output.maxOutputTokens,
        },
      })
    },

    // ─── LLM 输入：用户消息 ───
    "chat.message": async (
      input: { sessionID: string; agent?: string; model?: any; messageID?: string },
      output: { message: any; parts: any[] },
    ) => {
      const sid = input.sessionID
      if (!sid) return
      append(logFile(directory, sid), {
        ts: new Date().toISOString(),
        type: "user_message",
        sessionID: sid,
        agent: input.agent,
        messageID: input.messageID,
        message: output.message,
        parts: output.parts,
      })
    },

    // ─── 工具调用：调用前 ───
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: any },
    ) => {
      append(logFile(directory, input.sessionID), {
        ts: new Date().toISOString(),
        type: "tool_call_before",
        sessionID: input.sessionID,
        tool: input.tool,
        callID: input.callID,
        args: output.args,
      })
    },

    // ─── 工具调用：调用后 ───
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string; args: any },
      output: { title: string; output: string; metadata: any },
    ) => {
      append(logFile(directory, input.sessionID), {
        ts: new Date().toISOString(),
        type: "tool_call_after",
        sessionID: input.sessionID,
        tool: input.tool,
        callID: input.callID,
        args: input.args,
        result: {
          title: output.title,
          output: output.output,
          metadata: output.metadata,
        },
      })
    },

    // ─── LLM 输出：文本生成完成 ───
    "experimental.text.complete": async (
      input: { sessionID: string; messageID: string; partID: string },
      output: { text: string },
    ) => {
      append(logFile(directory, input.sessionID), {
        ts: new Date().toISOString(),
        type: "llm_text_output",
        sessionID: input.sessionID,
        messageID: input.messageID,
        partID: input.partID,
        text: output.text,
      })
    },
  }
}

// Shared state: messages captured by messages.transform, flushed in chat.params
let latestMessages: any[] | null = null

export default { server }
