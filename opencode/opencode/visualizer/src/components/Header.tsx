import { formatTimestamp } from "../parser"

interface Props {
  turnId: string
  agent: string
  startTime: string
  currentRoundIdx: number
  totalRounds: number
  onPrev: () => void
  onNext: () => void
}

export default function Header({
  turnId, agent, startTime,
  currentRoundIdx, totalRounds, onPrev, onNext,
}: Props) {
  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">OpenCode Visualizer</h1>
        {turnId && <code className="header-turn-id">{turnId}</code>}
      </div>

      {totalRounds > 0 && (
        <div className="turn-nav">
          <button className="nav-btn" onClick={onPrev} disabled={currentRoundIdx <= 0}>
            &#x25C0;
          </button>
          <span className="nav-label">
            Round {currentRoundIdx + 1} / {totalRounds}
          </span>
          <button className="nav-btn" onClick={onNext} disabled={currentRoundIdx >= totalRounds - 1}>
            &#x25B6;
          </button>
        </div>
      )}

      <div className="header-right">
        {startTime && <span className="header-time">{formatTimestamp(startTime)}</span>}
        {agent && <span className="header-agent">{agent.split(" - ").pop()}</span>}
      </div>
    </header>
  )
}
