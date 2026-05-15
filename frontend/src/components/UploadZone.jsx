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

        <span className="upload-icon">
          {status === 'uploading' ? '⏳' : status === 'success' ? '✅' : '📂'}
        </span>

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
