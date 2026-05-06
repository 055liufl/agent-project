import { useRef } from "react"
import type { Turn, LogEntry } from "../types"
import { calcDuration } from "../parser"

interface HeaderProps {
  fileName: string
  onFileLoad: (name: string, content: string) => void
  turns: Turn[]
  entries: LogEntry[]
  currentRoundIdx: number
  totalRounds: number
  onBack: () => void
  onFwd: () => void
}

export default function Header({
  fileName, onFileLoad, turns, entries,
  currentRoundIdx, totalRounds, onBack, onFwd,
}: HeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onFileLoad(file.name, reader.result as string)
    reader.readAsText(file)
    e.target.value = ""
  }

  const sessionID = turns[0]?.sessionID ?? ""
  const duration = turns.length > 0
    ? calcDuration(turns[0].startTime, turns[turns.length - 1].endTime)
    : ""

  return (
    <header className="header">
      <div className="header-left">
        <span className="header-logo">&#x1F52C;</span>
        <h1 className="header-title">Session Visualizer</h1>
      </div>

      {totalRounds > 0 && (
        <div className="round-nav">
          <button
            className="nav-btn"
            onClick={onBack}
            disabled={currentRoundIdx <= 0}
            title="Previous message"
          >
            &#x25C0;
          </button>
          <span className="nav-label">
            Round {currentRoundIdx + 1} / {totalRounds}
          </span>
          <button
            className="nav-btn"
            onClick={onFwd}
            disabled={currentRoundIdx >= totalRounds - 1}
            title="Next message"
          >
            &#x25B6;
          </button>
        </div>
      )}

      <div className="header-meta">
        {sessionID && (
          <>
            <span className="meta-chip">
              <span className="meta-label">Session</span>
              <code>{sessionID.replace("ses_", "").slice(0, 12)}...</code>
            </span>
            <span className="meta-chip">
              <span className="meta-label">Events</span>
              <code>{entries.length}</code>
            </span>
            <span className="meta-chip">
              <span className="meta-label">Duration</span>
              <code>{duration}</code>
            </span>
          </>
        )}
      </div>

      <div className="header-right">
        {fileName && <span className="header-filename">{fileName}</span>}
        <button className="header-btn" onClick={() => inputRef.current?.click()}>
          Open .jsonl
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".jsonl,.json"
          style={{ display: "none" }}
          onChange={handleChange}
        />
      </div>
    </header>
  )
}
