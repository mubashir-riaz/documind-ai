import { useState, useRef, useEffect } from 'react'
import { askQuestion } from '../api.js'

function scoreClass(score) {
  if (score >= 0.75) return 'score-high'
  if (score >= 0.5)  return 'score-med'
  return 'score-low'
}

function SourcesAccordion({ sources }) {
  const [open, setOpen] = useState(false)
  if (!sources || sources.length === 0) return null

  return (
    <div className="sources">
      <button className="sources-toggle" onClick={() => setOpen(o => !o)}>
        <span>{open ? '▾' : '▸'}</span>
        <span>{sources.length} source chunk{sources.length !== 1 ? 's' : ''} used</span>
      </button>

      {open && (
        <div className="sources-list">
          {sources.map((src, i) => (
            <div key={i} className="source-item">
              <div className="source-meta">
                <span>Chunk {src.chunk_index + 1}</span>
                <span className={`score-badge ${scoreClass(src.score)}`}>
                  {(src.score * 100).toFixed(0)}% match
                </span>
              </div>
              <div className="source-preview">{src.preview}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatMessageText(text) {
  if (!text) return "";

  // Split by code blocks first (e.g. ```python ... ```)
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const content = part.slice(3, -3).trim();
      const firstLineBreak = content.indexOf("\n");
      let lang = "";
      let code = content;
      if (firstLineBreak !== -1) {
        lang = content.slice(0, firstLineBreak).trim();
        code = content.slice(firstLineBreak + 1);
      }
      return (
        <pre key={i} className="code-block" style={{ margin: '8px 0', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', overflowX: 'auto' }}>
          {lang && <div className="code-lang" style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.5, marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>{lang}</div>}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{code}</code>
        </pre>
      );
    }

    // Process normal text lines
    const lines = part.split("\n");
    return lines.map((line, j) => {
      // Check if line is bullet list or numbered list
      const isBullet = line.trim().startsWith("* ") || line.trim().startsWith("- ");
      const isNumbered = /^\d+\.\s/.test(line.trim());

      let content = line;
      if (isBullet) {
        content = content.trim().replace(/^[-*]\s+/, "");
      } else if (isNumbered) {
        content = content.trim().replace(/^\d+\.\s+/, "");
      }

      // Inline formatting: bold (**), italic (*), inline code (`)
      const tokens = content.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
      const renderedTokens = tokens.map((token, k) => {
        if (token.startsWith("**") && token.endsWith("**")) {
          return <strong key={k} style={{ color: 'var(--accent)', fontWeight: '600' }}>{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith("*") && token.endsWith("*")) {
          return <em key={k}>{token.slice(1, -1)}</em>;
        }
        if (token.startsWith("`") && token.endsWith("`")) {
          return <code key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>{token.slice(1, -1)}</code>;
        }
        return token;
      });

      if (isBullet) {
        return <li key={j} className="msg-bullet" style={{ marginLeft: '16px', listStyleType: 'disc' }}>{renderedTokens}</li>;
      }
      if (isNumbered) {
        return <li key={j} className="msg-numbered" style={{ marginLeft: '16px', listStyleType: 'decimal' }}>{renderedTokens}</li>;
      }

      // Return a paragraph. If line is empty, render a small space or ignore to prevent double spacing
      if (line.trim() === "") {
        return <div key={j} style={{ height: '0.5em' }} />;
      }

      return (
        <p key={j} className="msg-paragraph" style={{ margin: '0 0 0.5em 0' }}>
          {renderedTokens}
        </p>
      );
    });
  });
}

function Message({ msg }) {
  return (
    <div className={`message ${msg.role}`}>
      <div className="msg-role">{msg.role === 'user' ? 'you' : 'documind'}</div>

      {msg.role === 'assistant' && msg.error ? (
        <div className="error-bubble">{msg.text}</div>
      ) : (
        <div className="msg-bubble">{formatMessageText(msg.text)}</div>
      )}

      {msg.role === 'assistant' && msg.sources && (
        <SourcesAccordion sources={msg.sources} />
      )}
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="message assistant">
      <div className="msg-role">documind</div>
      <div className="thinking">
        <div className="thinking-dots">
          <span /><span /><span />
        </div>
        Thinking…
      </div>
    </div>
  )
}

function Welcome({ hasDocs, hasSelectedDoc }) {
  const isStep1Active = !hasDocs
  const isStep2Active = hasDocs && !hasSelectedDoc
  const isStep3Active = hasSelectedDoc

  return (
    <div className="welcome">
      <div className="welcome-glyph">🧠</div>
      <div className="welcome-title">DocuMind <span>AI</span></div>
      <div className="welcome-sub">
        Upload a document and ask anything about it.
        Answers are grounded in your content — not guessed.
      </div>
      <div className="welcome-steps">
        <div className={`step-pill ${isStep1Active ? 'active' : ''}`}>
          <span className="num">1</span>
          <span>Upload a document</span>
        </div>
        <div className={`step-pill ${isStep2Active ? 'active' : ''}`}>
          <span className="num">2</span>
          <span>Select it in the sidebar</span>
        </div>
        <div className={`step-pill ${isStep3Active ? 'active' : ''}`}>
          <span className="num">3</span>
          <span>Ask any question</span>
        </div>
      </div>
    </div>
  )
}

export default function ChatBox({ selectedDocId, selectedDocName, onClearDoc, messages = [], onMessagesChange, hasDocs }) {
  const [input,     setInput]     = useState('')
  const [thinking,  setThinking]  = useState(false)
  const bottomRef                 = useRef(null)
  const textareaRef               = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  // Auto-resize textarea
  function onInputChange(e) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleSend() {
    const question = input.trim()
    if (!question || thinking) return

    // Add user message
    const updatedWithUser = [...messages, { role: 'user', text: question }]
    onMessagesChange(updatedWithUser)
    setInput('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setThinking(true)

    try {
      const result = await askQuestion({
        question,
        docId: selectedDocId,
        topK:  5,
      })

      onMessagesChange([...updatedWithUser, {
        role:    'assistant',
        text:    result.answer,
        sources: result.sources,
        model:   result.model,
      }])
    } catch (err) {
      onMessagesChange([...updatedWithUser, {
        role:  'assistant',
        text:  err.message || 'Something went wrong. Please try again.',
        error: true,
      }])
    } finally {
      setThinking(false)
    }
  }

  const canSend   = input.trim().length > 0 && !thinking && !!selectedDocId
  const showEmpty = messages.length === 0 && !thinking

  return (
    <>
      {/* Context bar — shows which doc is active */}
      <div className="context-bar">
        <span className="context-label">context:</span>
        {selectedDocId ? (
          <>
            <span className="context-doc">📄 {selectedDocName || selectedDocId.slice(0, 12) + '…'}</span>
            <button className="context-clear" onClick={onClearDoc}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }}>
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              clear
            </button>
          </>
        ) : (
          <span className="context-all no-doc">No document selected <span className="context-tip">(select one from the library to ask questions)</span></span>
        )}
      </div>

      {/* Messages */}
      <div className="messages">
        {showEmpty && <Welcome hasDocs={hasDocs} hasSelectedDoc={!!selectedDocId} />}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {thinking && <ThinkingBubble />}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="input-area">
        <div className={`input-row ${!selectedDocId ? 'disabled' : ''}`}>
          <textarea
            ref={textareaRef}
            className="input-box"
            rows={1}
            placeholder={
              selectedDocId
                ? 'Ask anything about this document…'
                : hasDocs
                  ? 'Please select a document from the library to start chatting…'
                  : 'Please upload a document to start chatting…'
            }
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            disabled={thinking || !selectedDocId}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!canSend}
            title={selectedDocId ? 'Send (Enter)' : 'Please select a document first'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <div className="input-hint">
          {selectedDocId 
            ? 'Enter to send · Shift+Enter for new line' 
            : 'Chat is disabled until a document is selected.'}
        </div>
      </div>
    </>
  )
}
