import { useState } from "react"
import type { LogEntry, LLMRound } from "../types"
import { formatTimestamp, calcDuration } from "../parser"

interface Props {
  round: LLMRound | null
  selectedEntry: LogEntry | null
}

export default function ToolHistoryPanel({ round }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toolCalls = round?.toolCalls ?? []

  return (
    <div className="panel tool-panel">
      <div className="panel-header">
        <span className="panel-title">Tool History</span>
        <span className="panel-badge">
          {toolCalls.length} call{toolCalls.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="panel-scroll">
        {toolCalls.length === 0 && (
          <div className="panel-empty">No tool calls in this round</div>
        )}
        {toolCalls.map((tc, i) => {
          const isExpanded = expandedId === tc.callID
          const duration = tc.after
            ? calcDuration(tc.before.ts, tc.after.ts)
            : "..."
          const outputLen = tc.after?.result.output.length ?? 0

          return (
            <div key={tc.callID} className="tool-item">
              <button
                className="tool-item-header"
                onClick={() => setExpandedId(isExpanded ? null : tc.callID)}
              >
                <span className="tool-index">#{i + 1}</span>
                <span className="tool-name">{tc.tool}</span>
                <span className="tool-duration">{duration}</span>
                <span className="tool-output-size">
                  {outputLen > 0 ? `${outputLen.toLocaleString()} chars` : ""}
                </span>
                <span className="tool-time">{formatTimestamp(tc.before.ts)}</span>
                <span className="tool-arrow">{isExpanded ? "\u25BE" : "\u25B8"}</span>
              </button>

              {isExpanded && (
                <div className="tool-detail">
                  <div className="tool-section">
                    <div className="tool-section-label">ARGS</div>
                    <pre className="code-block tool-code">
                      {JSON.stringify(tc.args, null, 2)}
                    </pre>
                  </div>
                  {tc.after && (
                    <div className="tool-section">
                      <div className="tool-section-label">
                        RESULT — {tc.after.result.title}
                      </div>
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
