import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"

interface MarkdownViewProps {
  content: string
}

export default function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "")
            const codeStr = String(children).replace(/\n$/, "")
            const isBlock = codeStr.includes("\n") || match

            if (isBlock) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match?.[1] ?? "text"}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: "6px",
                    fontSize: "12px",
                    lineHeight: "1.5",
                  }}
                  wrapLongLines
                >
                  {codeStr}
                </SyntaxHighlighter>
              )
            }

            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            )
          },
          table({ children }) {
            return (
              <div className="md-table-wrap">
                <table>{children}</table>
              </div>
            )
          },
          pre({ children }) {
            return <div className="md-pre-wrap">{children}</div>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

/** Renders raw text/XML/JSON as a syntax-highlighted code block */
export function CodeBlockView({ content, language = "text" }: { content: string; language?: string }) {
  return (
    <div className="markdown-body">
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: "6px",
          fontSize: "12px",
          lineHeight: "1.5",
        }}
        wrapLongLines
      >
        {content}
      </SyntaxHighlighter>
    </div>
  )
}
