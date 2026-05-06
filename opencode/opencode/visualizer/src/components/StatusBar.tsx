import type { LogEntry, Turn, LLMRound } from "../types"
import { calcDuration } from "../parser"

interface Props {
  entries: LogEntry[]
  turns: Turn[]
  currentRound: LLMRound | null
}

export default function StatusBar({ entries, turns, currentRound }: Props) {
  const totalRounds = turns.reduce((s, t) => s + t.rounds.length, 0)
  const totalToolCalls = entries.filter((e) => e.type === "tool_call_before").length

  // Current round stats
  const sysChars = currentRound?.systemPrompt?.system.reduce((s, t) => s + t.length, 0) ?? 0
  const sysTokensEst = Math.round(sysChars / 4)

  const chatChars = currentRound?.messages
    ? JSON.stringify(currentRound.messages.messages).length
    : 0
  const chatTokensEst = Math.round(chatChars / 4)

  const roundToolCalls = currentRound?.toolCalls.length ?? 0

  const totalDuration = turns.length > 0
    ? calcDuration(turns[0].startTime, turns[turns.length - 1].endTime)
    : "0s"

  return (
    <footer className="status-bar">
      <div className="status-item">
        <span className="status-label">Sysprompt</span>
        <span className="status-value">~{(sysTokensEst / 1000).toFixed(1)}k tokens</span>
      </div>
      <div className="status-sep" />
      <div className="status-item">
        <span className="status-label">Chat history</span>
        <span className="status-value">~{(chatTokensEst / 1000).toFixed(1)}k tokens</span>
      </div>
      <div className="status-sep" />
      <div className="status-item">
        <span className="status-label">Round tools</span>
        <span className="status-value">{roundToolCalls}</span>
      </div>
      <div className="status-sep" />
      <div className="status-item">
        <span className="status-label">Total rounds</span>
        <span className="status-value">{totalRounds}</span>
      </div>
      <div className="status-sep" />
      <div className="status-item">
        <span className="status-label">Total tools</span>
        <span className="status-value">{totalToolCalls}</span>
      </div>
      <div className="status-sep" />
      <div className="status-item">
        <span className="status-label">Duration</span>
        <span className="status-value">{totalDuration}</span>
      </div>
    </footer>
  )
}
