import MarkdownView from "./MarkdownView"

interface ChatItem {
  role: "user" | "assistant"
  agent: string
  text: string
}

interface Props {
  chatItems: ChatItem[]
}

export default function ChatHistoryPanel({ chatItems }: Props) {
  const msgCount = chatItems.length
  const textPartCount = chatItems.length

  return (
    <div className="panel chat-panel">
      <div className="panel-header">
        <span className="panel-icon">&#x1F4AC;</span>
        <span className="panel-title">Chat History</span>
        <span className="panel-count">
          {msgCount} message(s), {textPartCount} text part(s)
        </span>
      </div>
      <div className="panel-scroll">
        {chatItems.length === 0 && (
          <div className="panel-empty">No chat messages</div>
        )}

        {chatItems.map((item, i) => (
          <div key={i} className="chat-msg">
            <div className="chat-msg-meta">
              <span className="chat-msg-icon">
                {item.role === "user" ? "\u{1F464}" : "\u{1F4CB}"}
              </span>
              <span className={`chat-role-tag role-${item.role}`}>
                {item.role.toUpperCase()}
              </span>
              {item.agent && <span className="chat-agent-name">{item.agent}</span>}
            </div>
            <div className="chat-msg-content">
              <MarkdownView content={item.text} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
