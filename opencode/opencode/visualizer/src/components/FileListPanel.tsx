import { useRef, useCallback } from "react"

interface Props {
  files: string[]
  activeIdx: number
  onSelect: (idx: number) => void
  onAddFile: (name: string, content: string) => void
}

export default function FileListPanel({ files, activeIdx, onSelect, onAddFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => onAddFile(file.name, reader.result as string)
    reader.readAsText(file)
  }, [onAddFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFiles = Array.from(e.dataTransfer.files)
    for (const f of droppedFiles) {
      if (f.name.endsWith(".jsonl") || f.name.endsWith(".json")) {
        readFile(f)
      }
    }
  }, [readFile])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files
    if (!chosen) return
    for (const f of Array.from(chosen)) readFile(f)
    e.target.value = ""
  }

  // Extract short display name (turnID) from filename like "4efc0886.jsonl"
  const shortName = (name: string) => name.replace(/\.jsonl?$/, "")

  return (
    <div className="file-list-panel" onDrop={handleDrop} onDragOver={handleDragOver}>
      <div className="file-list-header">
        <span className="file-list-title">Log Files</span>
      </div>

      <button className="file-drop-zone" onClick={() => inputRef.current?.click()}>
        Drop files or click to add
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".jsonl,.json"
        multiple
        style={{ display: "none" }}
        onChange={handleInputChange}
      />

      <div className="file-list-items">
        {files.map((name, i) => (
          <button
            key={name}
            className={`file-item ${i === activeIdx ? "active" : ""}`}
            onClick={() => onSelect(i)}
          >
            <span className="file-icon">&#x1F4C4;</span>
            <span className="file-name">{shortName(name)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
