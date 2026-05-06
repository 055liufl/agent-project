import { mkdirSync, appendFileSync, existsSync } from "fs"
import { randomUUID } from "crypto"
import path from "path"

type Hooks = Record<string, any>
type PluginInput = {
  directory: string
  [key: string]: any
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_")
}

// logs/{sessionID}/{turnID}.jsonl
function logFile(directory: string, sessionID: string, turnID: string): string {
  const dir = path.join(directory, "logs", sanitize(sessionID))
  ensureDir(dir)
  return path.join(dir, `${turnID}.jsonl`)
}

function append(file: string, entry: Record<string, any>) {
  appendFileSync(file, JSON.stringify(entry) + "\n", "utf-8")
}

function newTurnID(): string {
  return randomUUID().slice(0, 8)
}

const server = async (ctx: PluginInput): Promise<Hooks> => {
  // Derive project root from this plugin's location: .opencode/plugins/llm-io-logger.ts → project root
  const pluginDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(new URL(import.meta.url).pathname)
  const directory = path.resolve(pluginDir, "../..")

  // Per-session turn tracking: sessionID → current turnID
  const turns = new Map<string, string>()
  // Pending messages captured by messages.transform (no sessionID available there)
  let pendingMessages: any[] | null = null

  function getTurnID(sessionID: string): string {
    let tid = turns.get(sessionID)
    if (!tid) {
      tid = newTurnID()
      turns.set(sessionID, tid)
    }
    return tid
  }

  function getFile(sessionID: string): string {
    return logFile(directory, sessionID, getTurnID(sessionID))
  }

  return {
    // ─── 用户消息：新 turn 起点 ───
    "chat.message": async (
      input: { sessionID: string; agent?: string; model?: any; messageID?: string },
      output: { message: any; parts: any[] },
    ) => {
      const sid = input.sessionID
      if (!sid) return

      // Generate new turnID for this conversation round
      const tid = newTurnID()
      turns.set(sid, tid)

      append(logFile(directory, sid, tid), {
        ts: new Date().toISOString(),
        type: "user_message",
        sessionID: sid,
        turnID: tid,
        agent: input.agent,
        messageID: input.messageID,
        message: output.message,
        parts: output.parts,
      })
    },

    // ─── LLM 输入：system prompt ───
    "experimental.chat.system.transform": async (
      input: { sessionID?: string; model?: any },
      output: { system: string[] },
    ) => {
      const sid = input.sessionID
      if (!sid) return
      const tid = getTurnID(sid)
      append(logFile(directory, sid, tid), {
        ts: new Date().toISOString(),
        type: "system_prompt",
        sessionID: sid,
        turnID: tid,
        model: input.model
          ? { providerID: input.model.providerID, modelID: input.model.id ?? input.model.modelID }
          : undefined,
        system: output.system,
      })
    },

    // ─── LLM 输入：完整消息列表（无 sessionID，暂存） ───
    "experimental.chat.messages.transform": async (
      _input: {},
      output: { messages: Array<{ info: any; parts: any[] }> },
    ) => {
      pendingMessages = output.messages.map((m) => ({
        role: m.info?.role,
        id: m.info?.id,
        parts: m.parts,
      }))
    },

    // ─── LLM 输入：调用参数（flush pending messages） ───
    "chat.params": async (
      input: { sessionID: string; agent: string; model: any; provider: any; message: any },
      output: { temperature: number; topP: number; topK: number; maxOutputTokens: number | undefined },
    ) => {
      const sid = input.sessionID
      const tid = getTurnID(sid)
      const file = logFile(directory, sid, tid)

      if (pendingMessages) {
        append(file, {
          ts: new Date().toISOString(),
          type: "messages",
          sessionID: sid,
          turnID: tid,
          agent: input.agent,
          messages: pendingMessages,
        })
        pendingMessages = null
      }

      append(file, {
        ts: new Date().toISOString(),
        type: "chat_params",
        sessionID: sid,
        turnID: tid,
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

    // ─── 工具调用：调用前 ───
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: any },
    ) => {
      const tid = getTurnID(input.sessionID)
      append(logFile(directory, input.sessionID, tid), {
        ts: new Date().toISOString(),
        type: "tool_call_before",
        sessionID: input.sessionID,
        turnID: tid,
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
      const tid = getTurnID(input.sessionID)
      append(logFile(directory, input.sessionID, tid), {
        ts: new Date().toISOString(),
        type: "tool_call_after",
        sessionID: input.sessionID,
        turnID: tid,
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
      const tid = getTurnID(input.sessionID)
      append(logFile(directory, input.sessionID, tid), {
        ts: new Date().toISOString(),
        type: "llm_text_output",
        sessionID: input.sessionID,
        turnID: tid,
        messageID: input.messageID,
        partID: input.partID,
        text: output.text,
      })
    },
  }
}

export default { id: "llm-io-logger", server }
