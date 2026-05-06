import type { LogEntry } from "../types"
import { formatTimestamp } from "../parser"

interface Props {
  entries: LogEntry[]
  selectedEntry: LogEntry | null
  onSelect: (entry: LogEntry) => void
  open: boolean
  onToggle: () => void
}

const TYPE_ICONS: Record<string, string> = {
  user_message: "\u{1F4AC}",
  system_prompt: "\u{1F4CB}",
  messages: "\u{1F4E8}",
  chat_params: "\u2699\uFE0F",
  tool_call_before: "\u{1F527}",
  tool_call_after: "\u2705",
  llm_text_output: "\u{1F4A1}",
}

const TYPE_LABELS: Record<string, string> = {
  user_message: "User Message",
  system_prompt: "System Prompt",
  messages: "Messages",
  chat_params: "Chat Params",
  tool_call_before: "Tool Before",
  tool_call_after: "Tool After",
  llm_text_output: "LLM Output",
}

function entrySummary(entry: LogEntry): string {
  switch (entry.type) {
    case "user_message":
      return entry.parts?.[0]?.text?.slice(0, 50) ?? ""
    case "system_prompt":
      return `${entry.system.reduce((s, t) => s + t.length, 0).toLocaleString()} chars`
    case "messages":
      return `${entry.messages.length} messages`
    case "chat_params":
      return entry.agent
    case "tool_call_before":
      return `${entry.tool}()`
    case "tool_call_after":
      return `${entry.tool} → ${entry.result.output.length.toLocaleString()} chars`
    case "llm_text_output":
      return entry.text.slice(0, 50)
    default:
      return ""
  }
}

export default function LogListPanel({ entries, selectedEntry, onSelect, open, onToggle }: Props) {
  return (
    <div className={`log-list-panel ${open ? "" : "collapsed"}`}>
      <button className="panel-collapse-btn" onClick={onToggle} title={open ? "收缩" : "展开"}>
        {open ? "\u25C0" : "\u25B6"}
      </button>

      {open && (
        <>
          <div className="panel-header">
            <span className="panel-title">Log Events</span>
            <span className="panel-count">{entries.length}</span>
          </div>
          <div className="log-list-scroll">
            {entries.map((entry, i) => {
              const isSelected = selectedEntry === entry
              return (
                <button
                  key={i}
                  className={`log-list-item ${isSelected ? "selected" : ""} log-type-${entry.type}`}
                  onClick={() => onSelect(entry)}
                >
                  <span className="log-item-index">{i + 1}</span>
                  <span className="log-item-icon">{TYPE_ICONS[entry.type] ?? "?"}</span>
                  <div className="log-item-info">
                    <span className="log-item-type">{TYPE_LABELS[entry.type] ?? entry.type}</span>
                    <span className="log-item-summary">{entrySummary(entry)}</span>
                  </div>
                  <span className="log-item-time">{formatTimestamp(entry.ts)}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
