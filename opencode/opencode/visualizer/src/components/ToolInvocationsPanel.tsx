import { useState } from "react"
import type { ToolCall } from "../types"
import { formatTimestamp, calcDuration } from "../parser"

interface Props {
  toolCalls: ToolCall[]
}

export default function ToolInvocationsPanel({ toolCalls }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="panel tool-panel">
      <div className="panel-header">
        <span className="panel-icon">&#x1F527;</span>
        <span className="panel-title">Tool Invocations</span>
        <span className="panel-count">{toolCalls.length} call(s)</span>
      </div>
      <div className="panel-scroll">
        {toolCalls.length === 0 && (
          <div className="panel-empty">No tool calls</div>
        )}
        {toolCalls.map((tc, i) => {
          const isOpen = expandedId === tc.callID
          const duration = tc.after ? calcDuration(tc.before.ts, tc.after.ts) : "..."
          const outputLen = tc.after?.result.output.length ?? 0

          return (
            <div key={tc.callID} className="tool-item">
              <button
                className="tool-item-header"
                onClick={() => setExpandedId(isOpen ? null : tc.callID)}
              >
                <span className="tool-index">#{i + 1}</span>
                <span className="tool-name">{tc.tool}</span>
                <span className="tool-duration">{duration}</span>
                {outputLen > 0 && (
                  <span className="tool-size">{outputLen.toLocaleString()} chars</span>
                )}
                <span className="tool-time">{formatTimestamp(tc.before.ts)}</span>
                <span className="tool-arrow">{isOpen ? "\u25BE" : "\u25B8"}</span>
              </button>
              {isOpen && (
                <div className="tool-detail">
                  <div className="tool-section">
                    <div className="tool-section-label">ARGS</div>
                    <pre className="code-block tool-code">
                      {JSON.stringify(tc.args, null, 2)}
                    </pre>
                  </div>
                  {tc.after && (
                    <div className="tool-section">
                      <div className="tool-section-label">RESULT — {tc.after.result.title}</div>
                      <pre className="code-block tool-code tool-result-code">
                        {tc.after.result.output}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
