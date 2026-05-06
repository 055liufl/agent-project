import type { LogEntry, LLMRound } from "../types"

interface Props {
  round: LLMRound | null
  selectedEntry: LogEntry | null
}

export default function SystemPromptPanel({ round }: Props) {
  if (!round?.systemPrompt) {
    return (
      <div className="panel system-panel">
        <div className="panel-header">
          <span className="panel-title">System Prompts</span>
        </div>
        <div className="panel-empty">No system prompt for this round</div>
      </div>
    )
  }

  const sp = round.systemPrompt
  const totalChars = sp.system.reduce((s, t) => s + t.length, 0)

  return (
    <div className="panel system-panel">
      <div className="panel-header">
        <span className="panel-title">System Prompts</span>
        <span className="panel-badge">{totalChars.toLocaleString()} chars</span>
        <span className="panel-badge">~{Math.round(totalChars / 4).toLocaleString()} tokens</span>
      </div>
      <div className="system-content panel-scroll">
        <pre className="code-block">{sp.system.join("\n\n---\n\n")}</pre>
      </div>
    </div>
  )
}
