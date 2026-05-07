import type { ChatItem } from "../App"
import MarkdownView from "./MarkdownView"
import { CodeBlockView } from "./MarkdownView"

interface Props {
  chatItems: ChatItem[]
}

const SOURCE_LABEL: Record<string, string> = {
  input: "USER INPUT",
  output: "LLM OUTPUT",
  context: "CONTEXT",
}

export default function ChatHistoryPanel({ chatItems }: Props) {
  const contextCount = chatItems.filter((c) => c.source === "context").length

  return (
    <div className="panel chat-panel">
      <div className="panel-header">
        <span className="panel-icon">&#x1F4AC;</span>
        <span className="panel-title">Chat History</span>
        <span className="panel-count">
          {chatItems.length} item(s)
          {contextCount > 0 && ` · ${contextCount} context`}
        </span>
      </div>
      <div className="panel-scroll">
        {chatItems.length === 0 && (
          <div className="panel-empty">No chat messages</div>
        )}

        {chatItems.map((item, i) => (
          <div key={i} className={`chat-msg chat-source-${item.source}`}>
            <div className="chat-msg-meta">
              <span className="chat-msg-icon">
                {item.source === "context" ? "\u{1F4D6}" : item.role === "user" ? "\u{1F464}" : "\u{1F4CB}"}
              </span>
              <span className={`chat-role-tag role-${item.role}`}>
                {item.role.toUpperCase()}
              </span>
              {item.agent && <span className="chat-agent-name">{item.agent}</span>}
              <span className={`chat-source-tag source-${item.source}`}>
                {SOURCE_LABEL[item.source]}
              </span>
            </div>
            <div className="chat-msg-content">
              {item.source === "input" ? (
                <MarkdownView content={item.text} />
              ) : (
                <CodeBlockView content={item.text} language="markdown" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
