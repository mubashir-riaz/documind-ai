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

  return (
    <div className="doc-list">
      {docs.map(doc => (
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
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
