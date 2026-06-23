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

function Message({ msg }) {
  return (
    <div className={`message ${msg.role}`}>
      <div className="msg-role">{msg.role === 'user' ? 'you' : 'documind'}</div>

      {msg.role === 'assistant' && msg.error ? (
        <div className="error-bubble">{msg.text}</div>
      ) : (
        <div className="msg-bubble">{msg.text}</div>
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

function Welcome() {
  return (
    <div className="welcome">
      <div className="welcome-glyph">🧠</div>
      <div className="welcome-title">DocuMind <span>AI</span></div>
      <div className="welcome-sub">
        Upload a document and ask anything about it.
        Answers are grounded in your content — not guessed.
      </div>
      <div className="welcome-steps">
        <div className="step-pill"><span className="num">1</span> Upload a document</div>
        <div className="step-pill"><span className="num">2</span> Select it in the sidebar</div>
        <div className="step-pill"><span className="num">3</span> Ask any question</div>
      </div>
    </div>
  )
}

export default function ChatBox({ selectedDocId, selectedDocName, onClearDoc, messages = [], onMessagesChange }) {
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

  const canSend   = input.trim().length > 0 && !thinking
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
          <span className="context-all">All documents <span className="context-tip">(select one for focused answers)</span></span>
        )}
      </div>

      {/* Messages */}
      <div className="messages">
        {showEmpty && <Welcome />}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {thinking && <ThinkingBubble />}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="input-area">
        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="input-box"
            rows={1}
            placeholder={
              selectedDocId
                ? 'Ask anything about this document…'
                : 'Ask a question across all documents…'
            }
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            disabled={thinking}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!canSend}
            title="Send (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <div className="input-hint">
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </>
  )
}
