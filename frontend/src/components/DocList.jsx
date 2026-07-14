import { useState } from 'react'
import { deleteDocument } from '../api.js'

const FORMAT_ICONS = {
  '.pdf':  '📄',
  '.docx': '📝',
  '.pptx': '📊',
  '.xlsx': '📈',
  '.txt':  '📃',
  '.md':   '📋',
}

function getIcon(filename) {
  if (!filename) return '📄'
  const ext = '.' + filename.split('.').pop().toLowerCase()
  return FORMAT_ICONS[ext] || '📄'
}

function shortName(filename, maxLen = 22) {
  if (!filename) return 'Untitled'
  if (filename.length <= maxLen) return filename
  const ext   = filename.split('.').pop()
  const base  = filename.slice(0, maxLen - ext.length - 4)
  return `${base}…${ext}`
}

export default function DocList({ docs, selectedDocId, onSelect, onDeleted }) {
  const [searchTerm, setSearchTerm] = useState('')

  if (docs.length === 0) {
    return <p className="empty-docs">No documents yet.<br />Upload one above.</p>
  }

  async function handleDelete(e, docId) {
    e.stopPropagation()   // don't also select the doc
    if (!confirm('Delete this document from the database?')) return
    try {
      await deleteDocument(docId)
      onDeleted(docId)
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  const filteredDocs = docs.filter(doc =>
    (doc.filename || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="doc-list-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="doc-search-wrapper" style={{ marginBottom: '12px' }}>
        <input
          type="text"
          className="doc-search-input"
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'rgba(255, 255, 255, 0.02)',
            color: 'var(--text)',
            fontSize: '13px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--border-hi)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      <div className="doc-list" style={{ flex: 1, overflowY: 'auto' }}>
        {filteredDocs.length === 0 ? (
          <p className="empty-docs" style={{ textAlign: 'center', opacity: 0.5, marginTop: '20px', fontSize: '13px' }}>
            No matching documents.
          </p>
        ) : (
          filteredDocs.map(doc => (
            <div
              key={doc.doc_id}
              className={`doc-item ${doc.doc_id === selectedDocId ? 'selected' : ''}`}
              onClick={() => onSelect(doc.doc_id === selectedDocId ? null : doc.doc_id)}
              title={doc.filename || doc.doc_id}
            >
              <span className="doc-icon">{getIcon(doc.filename)}</span>

              <div className="doc-info">
                <div className="doc-name">{shortName(doc.filename || doc.doc_id)}</div>
                <div className="doc-meta">{doc.chunk_total} chunks</div>
              </div>

              <button
                className="doc-delete"
                onClick={(e) => handleDelete(e, doc.doc_id)}
                title="Delete document"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
