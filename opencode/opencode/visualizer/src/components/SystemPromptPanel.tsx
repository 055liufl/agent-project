import { useState } from "react"
import type { SystemPromptEntry } from "../types"

interface Props {
  prompts: SystemPromptEntry[]
}

export default function SystemPromptPanel({ prompts }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(
    prompts.length > 0 ? prompts.length - 1 : null
  )

  const toggle = (i: number) => setExpandedIdx(expandedIdx === i ? null : i)

  return (
    <div className="panel system-panel">
      <div className="panel-header">
        <span className="panel-icon">&#x1F4CB;</span>
        <span className="panel-title">System Prompts</span>
        <span className="panel-count">{prompts.length} prompt(s)</span>
      </div>
      <div className="panel-scroll">
        {prompts.length === 0 && <div className="panel-empty">No system prompts</div>}
        {prompts.map((sp, i) => {
          const chars = sp.system.reduce((s, t) => s + t.length, 0)
          const isOpen = expandedIdx === i
          return (
            <div key={i} className="prompt-item">
              <button className="prompt-header" onClick={() => toggle(i)}>
                <span className="prompt-arrow">{isOpen ? "\u25BE" : "\u25B8"}</span>
                <span className="prompt-label">Prompt {i + 1}</span>
                <span className="prompt-chars">{chars.toLocaleString()} chars</span>
              </button>
              {isOpen && (
                <div className="prompt-body">
                  <pre className="code-block">{sp.system.join("\n\n---\n\n")}</pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
