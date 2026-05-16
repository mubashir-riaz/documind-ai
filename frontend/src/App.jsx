import { useState, useEffect } from "react";
import { checkHealth, listDocuments, getStats } from "./api.js";
import UploadZone from "./components/UploadZone.jsx";
import DocList from "./components/DocList.jsx";
import ChatBox from "./components/ChatBox.jsx";

export default function App() {
  const [online, setOnline] = useState(null); // null=checking, true, false
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(null);

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

  // ── After a successful upload, add to the list ───────────────────────────
  function onUploaded(result) {
    // Add the new doc to the local list immediately (no full refetch needed)
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

    // Auto-select the just-uploaded doc
    setSelectedDocId(result.doc_id);
  }

  // ── After delete, remove from the list ──────────────────────────────────
  function onDeleted(docId) {
    const removed = docs.find((d) => d.doc_id === docId);
    setDocs((prev) => prev.filter((d) => d.doc_id !== docId));
    if (selectedDocId === docId) setSelectedDocId(null);

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

  // ── Find the selected doc's filename for display ─────────────────────────
  const selectedDoc = docs.find((d) => d.doc_id === selectedDocId);
  const selectedDocName = selectedDoc?.filename || null;

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

        {/* Documents */}
        <div className="sidebar-section" style={{ flex: 1 }}>
          <div className="sidebar-label">
            Documents {docs.length > 0 && `(${docs.length})`}
          </div>
          <DocList
            docs={docs}
            selectedDocId={selectedDocId}
            onSelect={setSelectedDocId}
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
          onClearDoc={() => setSelectedDocId(null)}
        />
      </main>
    </div>
  );
}
