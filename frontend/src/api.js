/**
 * api.js — all backend calls in one place
 *
 * Base URL uses Vite proxy in dev (/api → http://localhost:8000)
 * In production set VITE_API_URL in frontend/.env
 */

const BASE = import.meta.env.VITE_API_URL || "/api";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    // FastAPI returns { detail: "..." } on errors
    throw new Error(data.detail || `HTTP ${res.status}`);
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Returns: { status, message }
 */
export async function checkHealth() {
  const res = await fetch(`${BASE}/health`);
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /upload
 * Body: FormData with "file" field
 * Returns: { doc_id, filename, format, size_mb, word_count,
 *            char_count, chunks_stored, embedding_dim, model,
 *            text_preview, status, message }
 */
export async function uploadDocument(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);

  // Use XMLHttpRequest so we can track upload progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data.detail || `Upload failed: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /documents
 * Returns: { total_documents, total_chunks, documents: [{ doc_id, chunk_total }] }
 */
export async function listDocuments() {
  const res = await fetch(`${BASE}/documents`);
  return handleResponse(res);
}

/**
 * DELETE /documents/:doc_id
 * Returns: { doc_id, chunks_deleted, status }
 */
export async function deleteDocument(docId) {
  const res = await fetch(`${BASE}/documents/${docId}`, { method: "DELETE" });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /stats
 * Returns: { total_chunks, total_documents, collection, model }
 */
export async function getStats() {
  const res = await fetch(`${BASE}/stats`);
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// ASK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /ask
 * Body: { question: string, doc_id?: string, top_k?: number }
 * Returns: { question, answer, model, chunks_used, context_chars,
 *            doc_id, sources: [{ chunk_index, score, preview }] }
 */
export async function askQuestion({ question, docId = null, topK = 5 }) {
  const res = await fetch(`${BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      doc_id: docId,
      top_k: topK,
    }),
  });
  return handleResponse(res);
}
