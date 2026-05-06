import type { LogEntry, LLMRound, MessagesEntry } from "../types"
import { formatTimestamp } from "../parser"
import MarkdownView from "./MarkdownView"

interface Props {
  round: LLMRound | null
  selectedEntry: LogEntry | null
}

export default function ChatHistoryPanel({ round }: Props) {
  if (!round) {
    return (
      <div className="panel chat-panel">
        <div className="panel-header">
          <span className="panel-title">Chat History</span>
        </div>
        <div className="panel-empty">No data</div>
      </div>
    )
  }

  const msgs = round.messages as MessagesEntry | undefined
  // Filter to messages with text parts only (no tool/tool_result)
  const chatMsgs = msgs?.messages.filter((m) =>
    m.parts.some((p) => p.type === "text" && p.text)
  ) ?? []

  return (
    <div className="panel chat-panel">
      <div className="panel-header">
        <span className="panel-title">Chat History</span>
        <span className="panel-badge">
          {chatMsgs.length} message{chatMsgs.length !== 1 ? "s" : ""}
        </span>
        {round.output && (
          <span className="panel-badge badge-green">has output</span>
        )}
      </div>
      <div className="panel-scroll">
        {chatMsgs.length === 0 && !round.output && (
          <div className="panel-empty">No chat messages in this round</div>
        )}

        {chatMsgs.map((msg, i) => {
          const textParts = msg.parts.filter((p) => p.type === "text" && p.text)
          if (textParts.length === 0) return null
          return (
            <div key={i} className={`chat-bubble chat-${msg.role}`}>
              <div className="chat-bubble-header">
                <span className={`chat-role role-${msg.role}`}>
                  {msg.role.toUpperCase()}
                </span>
              </div>
              <div className="chat-bubble-body">
                {textParts.map((p, j) => (
                  <div key={j} className="chat-text-part">
                    <MarkdownView content={p.text ?? ""} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {round.output && (
          <div className="chat-bubble chat-assistant chat-output">
            <div className="chat-bubble-header">
              <span className="chat-role role-output">LLM OUTPUT</span>
              <span className="chat-badge">{round.output.text.length.toLocaleString()} chars</span>
              <span className="chat-time">{formatTimestamp(round.output.ts)}</span>
            </div>
            <div className="chat-bubble-body">
              <MarkdownView content={round.output.text} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
