import type {
  LogEntry,
  Turn,
  LLMRound,
  ToolCall,
  SystemPromptEntry,
  MessagesEntry,
  ChatParamsEntry,
  ToolCallBeforeEntry,
  ToolCallAfterEntry,
  LLMTextOutputEntry,
  UserMessageEntry,
} from "./types"

export function parseJSONL(text: string): LogEntry[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as LogEntry)
}

export function groupIntoTurns(entries: LogEntry[]): Turn[] {
  const turnMap = new Map<string, LogEntry[]>()

  for (const entry of entries) {
    const tid = entry.turnID
    if (!turnMap.has(tid)) turnMap.set(tid, [])
    turnMap.get(tid)!.push(entry)
  }

  const turns: Turn[] = []

  for (const [turnID, turnEntries] of turnMap) {
    const sorted = turnEntries.sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    )

    const userMsg = sorted.find(
      (e) => e.type === "user_message"
    ) as UserMessageEntry | undefined

    const rounds = buildRounds(sorted)

    turns.push({
      turnID,
      sessionID: sorted[0].sessionID,
      agent: userMsg?.agent ?? (sorted.find((e) => "agent" in e) as any)?.agent ?? "unknown",
      userMessage: userMsg,
      rounds,
      startTime: sorted[0].ts,
      endTime: sorted[sorted.length - 1].ts,
    })
  }

  return turns.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )
}

function buildRounds(entries: LogEntry[]): LLMRound[] {
  const rounds: LLMRound[] = []
  let current: LLMRound | null = null
  const pendingToolBefore = new Map<string, ToolCallBeforeEntry>()

  for (const entry of entries) {
    switch (entry.type) {
      case "user_message":
        // Skip - handled at Turn level
        break

      case "system_prompt": {
        const sp = entry as SystemPromptEntry
        // Each system_prompt that belongs to the main agent starts a new round
        // Title agent system_prompts (small, contains "title generator") are skipped
        const isTitle = sp.system.some((s) =>
          s.includes("title generator")
        )
        if (isTitle) break

        current = {
          index: rounds.length,
          systemPrompt: sp,
          toolCalls: [],
        }
        rounds.push(current)
        break
      }

      case "messages":
        if (current) current.messages = entry as MessagesEntry
        break

      case "chat_params": {
        const cp = entry as ChatParamsEntry
        // Skip title agent params
        if (cp.agent === "title") break
        if (current) current.chatParams = cp
        break
      }

      case "tool_call_before": {
        const tcb = entry as ToolCallBeforeEntry
        pendingToolBefore.set(tcb.callID, tcb)
        break
      }

      case "tool_call_after": {
        const tca = entry as ToolCallAfterEntry
        const before = pendingToolBefore.get(tca.callID)
        if (current && before) {
          current.toolCalls.push({
            tool: tca.tool,
            callID: tca.callID,
            args: tca.args,
            before,
            after: tca,
          })
          pendingToolBefore.delete(tca.callID)
        }
        break
      }

      case "llm_text_output":
        if (current) current.output = entry as LLMTextOutputEntry
        break
    }
  }

  return rounds
}

export function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function calcDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + "..."
}
