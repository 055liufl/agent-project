import { useState, useCallback } from "react"
import type { Turn, LogEntry, LLMRound, SystemPromptEntry } from "./types"
import { parseJSONL, groupIntoTurns } from "./parser"
import Header from "./components/Header"
import FileListPanel from "./components/FileListPanel"
import SystemPromptPanel from "./components/SystemPromptPanel"
import ChatHistoryPanel from "./components/ChatHistoryPanel"
import ToolInvocationsPanel from "./components/ToolInvocationsPanel"

export interface ChatItem {
  role: "user" | "assistant"
  agent: string
  text: string
  /** "input" = real user input this turn, "output" = LLM output this turn, "context" = system-injected history */
  source: "input" | "output" | "context"
}

interface LoadedFile {
  name: string
  turns: Turn[]
  entries: LogEntry[]
}

function buildChatItems(
  turn: Turn | null,
  round: LLMRound | null,
  agentShort: string,
): ChatItem[] {
  if (!turn) return []
  const items: ChatItem[] = []

  // 1. This turn's own user input (from user_message entry, NOT messages snapshot)
  if (turn.userMessage) {
    const text = turn.userMessage.parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text)
      .join("\n\n")
    if (text) items.push({ role: "user", agent: agentShort, text, source: "input" })
  }

  // 2. This turn's own LLM output (only when current round produced it)
  if (round?.output) {
    items.push({ role: "assistant", agent: agentShort, text: round.output.text, source: "output" })
  }

  return items
}

export default function App() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [activeFileIdx, setActiveFileIdx] = useState(0)
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0)

  const activeFile = files[activeFileIdx] ?? null
  const allEntries = activeFile?.entries ?? []
  const allRounds: LLMRound[] = (activeFile?.turns ?? []).flatMap((t) => t.rounds)
  const totalRounds = allRounds.length
  const currentRound = allRounds[currentRoundIdx] ?? null

  // Find which turn the current round belongs to
  let currentTurn: Turn | null = null
  if (activeFile) {
    let idx = 0
    for (const t of activeFile.turns) {
      if (currentRoundIdx >= idx && currentRoundIdx < idx + t.rounds.length) {
        currentTurn = t
        break
      }
      idx += t.rounds.length
    }
    if (!currentTurn) currentTurn = activeFile.turns[0] ?? null
  }

  const agentShort = (currentTurn?.agent ?? "").split(" - ").pop() ?? ""

  // === All 3 content panels derive from current state ===
  // System Prompts: ALL system_prompt entries from the active file (not per-round)
  const systemPrompts = allEntries.filter(
    (e) => e.type === "system_prompt"
  ) as SystemPromptEntry[]
  const chatItems = buildChatItems(currentTurn, currentRound, agentShort)
  // Tool Invocations: ALL tool calls from ALL rounds in the file
  const allToolCalls = allRounds.flatMap((r) => r.toolCalls)

  // === File management ===
  const handleAddFile = useCallback((name: string, content: string) => {
    const entries = parseJSONL(content)
    const grouped = groupIntoTurns(entries)
    setFiles((prev) => {
      const exists = prev.findIndex((f) => f.name === name)
      if (exists >= 0) {
        const updated = [...prev]
        updated[exists] = { name, turns: grouped, entries }
        return updated
      }
      return [...prev, { name, turns: grouped, entries }]
    })
    setActiveFileIdx(() => {
      const existIdx = files.findIndex((f) => f.name === name)
      return existIdx >= 0 ? existIdx : files.length
    })
    setCurrentRoundIdx(0)
  }, [files])

  const handleSelectFile = useCallback((idx: number) => {
    setActiveFileIdx(idx)
    setCurrentRoundIdx(0)
  }, [])

  // === Round navigation ===
  const goPrev = () => setCurrentRoundIdx((i) => Math.max(0, i - 1))
  const goNext = () => setCurrentRoundIdx((i) => Math.min(totalRounds - 1, i + 1))

  return (
    <div className="app">
      <div className="app-bg" />

      <Header
        turnId={currentTurn?.turnID ?? ""}
        agent={currentTurn?.agent ?? ""}
        startTime={currentTurn?.startTime ?? ""}
        currentRoundIdx={currentRoundIdx}
        totalRounds={totalRounds}
        onPrev={goPrev}
        onNext={goNext}
      />

      <main className="workspace">
        <FileListPanel
          files={files.map((f) => f.name)}
          activeIdx={activeFileIdx}
          onSelect={handleSelectFile}
          onAddFile={handleAddFile}
        />

        <div className="center-panel">
          <SystemPromptPanel
            key={`sp-${activeFileIdx}`}
            prompts={systemPrompts}
          />
        </div>

        <div className="right-panel">
          <ChatHistoryPanel
            key={`ch-${activeFileIdx}-${currentRoundIdx}`}
            chatItems={chatItems}
          />
          <ToolInvocationsPanel
            key={`ti-${activeFileIdx}`}
            toolCalls={allToolCalls}
          />
        </div>
      </main>
    </div>
  )
}
