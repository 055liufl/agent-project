import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "../styles/global.css"
import "../styles/header.css"
import "../styles/file-list.css"
import "../styles/panels.css"
import "../styles/chat.css"
import "../styles/tool.css"
import "../styles/markdown.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
