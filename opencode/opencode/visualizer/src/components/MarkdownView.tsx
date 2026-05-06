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

            if (match) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: "6px",
                    fontSize: "13px",
                  }}
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
        }}
      />
    </div>
  )
}
