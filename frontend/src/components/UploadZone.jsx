import { useState, useRef } from 'react'
import { uploadDocument } from '../api.js'

const FORMATS = ['.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md']

const FORMAT_ICONS = {
  '.pdf':  '📄',
  '.docx': '📝',
  '.pptx': '📊',
  '.xlsx': '📈',
  '.txt':  '📃',
  '.md':   '📋',
}

export default function UploadZone({ onUploaded }) {
  const [dragOver, setDragOver]   = useState(false)
  const [status, setStatus]       = useState(null)   // null | 'uploading' | 'success' | 'error'
  const [progress, setProgress]   = useState(0)
  const [message, setMessage]     = useState('')
  const inputRef                  = useRef(null)

  async function handleFile(file) {
    if (!file) return

    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!FORMATS.includes(ext)) {
      setStatus('error')
      setMessage(`Unsupported format: ${ext}. Use ${FORMATS.join(', ')}`)
      return
    }

    const max_size_mb = 20
    if (file.size > max_size_mb * 1024 * 1024) {
      setStatus('error')
      setMessage(`File too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB. Max limit is ${max_size_mb}MB.`)
      return
    }

    setStatus('uploading')
    setProgress(0)
    setMessage(`Uploading ${file.name}…`)

    try {
      const result = await uploadDocument(file, (pct) => {
        setProgress(pct)
        if (pct === 100) setMessage('Processing document…')
      })
      setStatus('success')
      setMessage(`✓ ${result.chunks_stored} chunks stored · ${result.word_count.toLocaleString()} words`)
      onUploaded(result)

      // Reset after 3s
      setTimeout(() => {
        setStatus(null)
        setMessage('')
        setProgress(0)
      }, 3000)
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Upload failed')
    }
  }

  function onInputChange(e) {
    handleFile(e.target.files[0])
    e.target.value = ''   // allow re-uploading same file
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div>
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => status !== 'uploading' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={FORMATS.join(',')}
          onChange={onInputChange}
          disabled={status === 'uploading'}
          style={{ display: 'none' }}
        />

        <div className="upload-icon">
          {status === 'uploading' ? (
            <svg className="upload-svg spinner" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1.5s linear infinite' }}>
              <line x1="12" y1="2" x2="12" y2="6"></line>
              <line x1="12" y1="18" x2="12" y2="22"></line>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
              <line x1="2" y1="12" x2="6" y2="12"></line>
              <line x1="18" y1="12" x2="22" y2="12"></line>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>
          ) : status === 'success' ? (
            <svg className="upload-svg success-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg className="upload-svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          )}
        </div>

        <div className="upload-title">
          {status === 'uploading' ? 'Uploading…' : 'Drop a document here'}
        </div>

        <div className="upload-sub">
          {status ? '' : 'or click to browse'}
        </div>

        {/* Progress bar */}
        {status === 'uploading' && (
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Format tags — only when idle */}
        {!status && (
          <div className="upload-formats">
            {FORMATS.map(f => (
              <span key={f} className="format-tag">{f}</span>
            ))}
          </div>
        )}
      </div>

      {/* Status message below the zone */}
      {message && (
        <div className={`upload-status ${status}`}>
          {message}
        </div>
      )}
    </div>
  )
}
