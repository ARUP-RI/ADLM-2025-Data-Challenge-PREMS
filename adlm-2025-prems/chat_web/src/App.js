// src/App.js
import React, { useState } from "react";
import ChatForm from "./components/ChatForm";
import ChatMessages from "./components/ChatMessages";
import { streamChat } from "./apiClient";
import "bootstrap/dist/css/bootstrap.min.css";

export default function App() {
  const [messages, setMessages] = useState([
    // optional seed
    { id: "w1", role: "assistant", text: "Hi! Ask me a question." },
  ]);
  const [err, setErr] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const startChat = async (userText) => {
    setErr("");

    // push user message immediately
    const userMsg = { id: crypto.randomUUID(), role: "user", text: userText };
    setMessages((prev) => [...prev, userMsg]);

    // create a placeholder assistant message to append to
    const asstId = crypto.randomUUID();
    let draft = "";
    setMessages((prev) => [...prev, { id: asstId, role: "assistant", text: "" }]);

    setIsStreaming(true);
    try {
      for await (const event of streamChat(userText)) {
        switch (event.type) {
          case "reply": {
            // payload is a small string chunk
            draft += typeof event.payload === "string" ? event.payload : String(event.payload);
            setMessages((prev) =>
              prev.map((m) => (m.id === asstId ? { ...m, text: draft } : m))
            );
            break;
          }
          case "tool_call_started": {
            // show tool activity in the transcript
            const info =
              typeof event.payload === "object"
                ? `Calling tool "${event.payload.function}"…`
                : "Calling tool…";
            const toolMsg = { id: crypto.randomUUID(), role: "system", text: info };
            setMessages((prev) => [...prev, toolMsg]);
            break;
          }
          case "tool_call_response": {
            const val =
              typeof event.payload === "object" && "value" in event.payload
                ? JSON.stringify(event.payload.value)
                : JSON.stringify(event.payload);
            const toolMsg = { id: crypto.randomUUID(), role: "system", text: `Tool result: ${val}` };
            setMessages((prev) => [...prev, toolMsg]);
            break;
          }
          case "error": {
            setErr(typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload));
            break;
          }
          default: {
            // ignore unknown lines, or log them
            console.debug("unhandled event", event);
          }
        }
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="container min-vh-100 d-flex flex-column py-3">
      <header className="mb-3">
        <h1 className="h4 mb-0">ADLM 2025</h1>
        <small className="text-muted">Desciption here.</small>
      </header>

      <div className="card shadow-sm flex-grow-1 d-flex">
        <div className="card-body p-0 d-flex flex-column" style={{ minHeight: 0 }}>
          <ChatMessages messages={messages} />

          {err && (
            <div className="alert alert-danger m-3 mb-0" role="alert">
              {err}
            </div>
          )}

          <div className="border-top p-3">
            <ChatForm
              placeholder={isStreaming ? "Receiving reply…" : "Type your message…"}
              onSubmit={startChat}
              disabled={isStreaming} // prevent overlapping requests
            />
          </div>
        </div>
      </div>

      <footer className="text-center text-muted small mt-3">
        PREMS 2025 ADLM Submission
      </footer>
    </div>
  );
}

