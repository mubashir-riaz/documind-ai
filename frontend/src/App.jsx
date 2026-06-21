import { useState, useEffect } from "react";
import { checkHealth, listDocuments, getStats } from "./api.js";
import UploadZone from "./components/UploadZone.jsx";
import DocList from "./components/DocList.jsx";
import ChatBox from "./components/ChatBox.jsx";

export default function App() {
  const [online, setOnline] = useState(null); // null=checking, true, false
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState(null);

  // ── Chat sessions state with local storage persistence ─────────────────
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem("documind_chats");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      } catch {
        // fail silently
      }
    }
    return [
      { id: "default", title: "General Chat", docId: null, messages: [] }
    ];
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = localStorage.getItem("documind_active_chat_id");
    return saved || "default";
  });

  // Save chats to localStorage
  useEffect(() => {
    localStorage.setItem("documind_chats", JSON.stringify(chats));
  }, [chats]);

  // Save activeChatId to localStorage
  useEffect(() => {
    localStorage.setItem("documind_active_chat_id", activeChatId);
  }, [activeChatId]);

  // ── On mount: check health + load docs ───────────────────────────────────
  useEffect(() => {
    checkHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));

    fetchDocs();
  }, []);

  async function fetchDocs() {
    try {
      const [docsRes, statsRes] = await Promise.all([
        listDocuments(),
        getStats(),
      ]);
      setDocs(docsRes.documents || []);
      setStats(statsRes);
    } catch {
      // backend might not be running — fail silently
    }
  }

  // ── Find active chat session ─────────────────────────────────────────────
  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0] || {
    id: "default",
    title: "General Chat",
    docId: null,
    messages: []
  };

  const selectedDocId = activeChat.docId;
  const selectedDoc = docs.find((d) => d.doc_id === selectedDocId);
  const selectedDocName = selectedDoc?.filename || null;

  // ── Chat handlers ────────────────────────────────────────────────────────
  function handleNewChat() {
    const newChat = {
      id: "chat_" + Date.now(),
      title: "New Chat",
      docId: null,
      messages: []
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  }

  function handleDeleteChat(e, chatId) {
    e.stopPropagation();
    
    // Find remaining chats
    const remaining = chats.filter((c) => c.id !== chatId);
    
    setChats(remaining.length > 0 ? remaining : [
      { id: "default", title: "General Chat", docId: null, messages: [] }
    ]);

    if (activeChatId === chatId) {
      if (remaining.length > 0) {
        setActiveChatId(remaining[0].id);
      } else {
        setActiveChatId("default");
      }
    }
  }

  function handleSelectDoc(docId) {
    const doc = docs.find((d) => d.doc_id === docId);
    if (!doc) return;

    // Create a new chat session linked to this document
    const newChat = {
      id: "chat_" + Date.now(),
      title: doc.filename,
      docId: docId,
      messages: []
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  }

  function handleClearActiveDoc() {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === activeChat.id) {
          return {
            ...c,
            docId: null,
            title: "General Chat"
          };
        }
        return c;
      })
    );
  }

  function handleMessagesChange(updatedMessages) {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === activeChat.id) {
          // If this was a fresh "New Chat", name it after the question to be user friendly
          let newTitle = c.title;
          if (c.title === "New Chat" && updatedMessages.length > 0) {
            const firstUserMsg = updatedMessages.find(m => m.role === 'user');
            if (firstUserMsg) {
              const text = firstUserMsg.text;
              newTitle = text.length > 25 ? text.slice(0, 22) + "…" : text;
            }
          }
          return {
            ...c,
            messages: updatedMessages,
            title: newTitle
          };
        }
        return c;
      })
    );
  }

  // ── After a successful upload, add to list + create a new linked chat ───
  function onUploaded(result) {
    const newDoc = {
      doc_id: result.doc_id,
      filename: result.filename,
      chunk_total: result.chunks_stored,
    };
    setDocs((prev) => [newDoc, ...prev]);
    setStats((prev) =>
      prev
        ? {
            ...prev,
            total_documents: prev.total_documents + 1,
            total_chunks: prev.total_chunks + result.chunks_stored,
          }
        : prev,
    );

    // Create a new chat session for this uploaded document
    const newChat = {
      id: "chat_" + Date.now(),
      title: result.filename,
      docId: result.doc_id,
      messages: []
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  }

  // ── After delete, remove from list + unlink from chats ───────────────────
  function onDeleted(docId) {
    const removed = docs.find((d) => d.doc_id === docId);
    setDocs((prev) => prev.filter((d) => d.doc_id !== docId));

    // Unlink the deleted document from any chat linked to it
    setChats((prev) =>
      prev.map((c) => {
        if (c.docId === docId) {
          return {
            ...c,
            docId: null,
            title: c.title === removed?.filename ? "General Chat" : c.title
          };
        }
        return c;
      })
    );

    if (removed && stats) {
      setStats((prev) =>
        prev
          ? {
              ...prev,
              total_documents: Math.max(0, prev.total_documents - 1),
              total_chunks: Math.max(
                0,
                prev.total_chunks - (removed.chunk_total || 0),
              ),
            }
          : prev,
      );
    }
  }

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-logo">
          Docu<span>Mind</span>
        </div>

        <div className="header-status">
          <span
            className={`status-dot ${online === true ? "online" : online === false ? "offline" : ""}`}
          />
          <span>
            {online === null
              ? "connecting…"
              : online === true
                ? "backend online"
                : "backend offline"}
          </span>
        </div>
      </header>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Upload */}
        <div className="sidebar-section">
          <div className="sidebar-label">Upload</div>
          <UploadZone onUploaded={onUploaded} />
        </div>

        {/* Chats Section */}
        <div className="sidebar-section">
          <div className="sidebar-header-row">
            <div className="sidebar-label">Chats</div>
            <button className="new-chat-btn" onClick={handleNewChat}>
              ＋ New
            </button>
          </div>
          <div className="chat-list">
            {chats.map((chat) => {
              const linkedDoc = docs.find((d) => d.doc_id === chat.docId);
              const isActive = chat.id === activeChat.id;
              return (
                <div
                  key={chat.id}
                  className={`chat-item ${isActive ? "selected" : ""}`}
                  onClick={() => setActiveChatId(chat.id)}
                >
                  <span className="chat-icon">💬</span>
                  <div className="chat-info">
                    <div className="chat-name">{chat.title}</div>
                    <div className="chat-meta">
                      {linkedDoc ? linkedDoc.filename : "All documents"}
                    </div>
                  </div>
                  <button
                    className="chat-delete-btn"
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    title="Delete chat"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Documents Library */}
        <div className="sidebar-section" style={{ flex: 1 }}>
          <div className="sidebar-label">
            Documents Library {docs.length > 0 && `(${docs.length})`}
          </div>
          <DocList
            docs={docs}
            selectedDocId={selectedDocId}
            onSelect={handleSelectDoc}
            onDeleted={onDeleted}
          />
        </div>

        {/* Stats */}
        {stats && (
          <div className="stats-bar">
            <div className="stat">
              <div className="stat-value">{stats.total_documents}</div>
              <div className="stat-label">DOCS</div>
            </div>
            <div className="stat">
              <div className="stat-value">
                {stats.total_chunks.toLocaleString()}
              </div>
              <div className="stat-label">CHUNKS</div>
            </div>
            <div className="stat">
              <div
                className="stat-value"
                style={{ fontSize: 11, color: "var(--text-3)" }}
              >
                {stats.model?.replace("all-", "").replace("-v2", "") ||
                  "MiniLM"}
              </div>
              <div className="stat-label">MODEL</div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main chat ──────────────────────────────────────────────────── */}
      <main className="main">
        <ChatBox
          selectedDocId={selectedDocId}
          selectedDocName={selectedDocName}
          onClearDoc={handleClearActiveDoc}
          messages={activeChat.messages}
          onMessagesChange={handleMessagesChange}
        />
      </main>
    </div>
  );
}
