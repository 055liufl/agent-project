import { useState, useCallback } from "react"
import type { Turn, LogEntry, LLMRound } from "./types"
import { parseJSONL, groupIntoTurns } from "./parser"
import Header from "./components/Header"
import LogListPanel from "./components/LogListPanel"
import SystemPromptPanel from "./components/SystemPromptPanel"
import ChatHistoryPanel from "./components/ChatHistoryPanel"
import ToolHistoryPanel from "./components/ToolHistoryPanel"
import StatusBar from "./components/StatusBar"

export default function App() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [allEntries, setAllEntries] = useState<LogEntry[]>([])
  const [fileName, setFileName] = useState("")
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0)

  const handleFileLoad = useCallback((name: string, content: string) => {
    const entries = parseJSONL(content)
    const grouped = groupIntoTurns(entries)
    setAllEntries(entries)
    setTurns(grouped)
    setFileName(name)
    setSelectedEntry(null)
    setCurrentRoundIdx(0)
  }, [])

  // Flatten all rounds across turns
  const allRounds: LLMRound[] = turns.flatMap((t) => t.rounds)
  const totalRounds = allRounds.length
  const currentRound = allRounds[currentRoundIdx] ?? null

  const goBack = () => setCurrentRoundIdx((i) => Math.max(0, i - 1))
  const goFwd = () => setCurrentRoundIdx((i) => Math.min(totalRounds - 1, i + 1))

  return (
    <div className="app">
      <div className="app-bg" />
      <Header
        fileName={fileName}
        onFileLoad={handleFileLoad}
        turns={turns}
        entries={allEntries}
        currentRoundIdx={currentRoundIdx}
        totalRounds={totalRounds}
        onBack={goBack}
        onFwd={goFwd}
      />

      {allEntries.length === 0 ? (
        <main className="empty-state">
          <div className="empty-state-icon">&#x1F52C;</div>
          <h2>OpenCode Session Visualizer</h2>
          <p>打开一个 <code>.jsonl</code> 日志文件以查看 LLM 会话的完整输入输出流程</p>
          <p className="empty-hint">日志文件位于 <code>logs/&lt;sessionID&gt;/&lt;turnID&gt;.jsonl</code></p>
        </main>
      ) : (
        <main className={`workspace ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
          <LogListPanel
            entries={allEntries}
            selectedEntry={selectedEntry}
            onSelect={setSelectedEntry}
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
          <div className="center-panel">
            <SystemPromptPanel round={currentRound} selectedEntry={selectedEntry} />
          </div>
          <div className="right-panel">
            <ChatHistoryPanel round={currentRound} selectedEntry={selectedEntry} />
            <ToolHistoryPanel round={currentRound} selectedEntry={selectedEntry} />
          </div>
        </main>
      )}

      {allEntries.length > 0 && (
        <StatusBar entries={allEntries} turns={turns} currentRound={currentRound} />
      )}
    </div>
  )
}
