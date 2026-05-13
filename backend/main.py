import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingest import extract_text, chunk_text, embed_and_store, SUPPORTED_FORMATS
from retriever import search, list_documents, delete_document, collection_stats

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="DocuMind AI",
    description="RAG-powered multi-format document Q&A",
    version="0.4.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE MODELS
# ─────────────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query:  str
    top_k:  int   = 5
    doc_id: Optional[str] = None   # optional — search all docs or just one


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH + ROOT
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "DocuMind AI is running!"}


@app.get("/")
def root():
    return {
        "project":           "DocuMind AI",
        "version":           "0.4.0",
        "supported_formats": SUPPORTED_FORMATS,
        "docs":              "/docs",
    }


# ─────────────────────────────────────────────────────────────────────────────
# UPLOAD — full ingestion pipeline
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Full ingestion pipeline:
      1. Validate format + size
      2. Save file to disk
      3. Extract text
      4. Chunk text
      5. Embed + store in ChromaDB

    Returns doc_id — use this in /search and /ask to target this document.
    """

    # Validate format
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{file_ext}'. Supported: {', '.join(SUPPORTED_FORMATS)}"
        )

    # Validate size (max 20MB)
    contents = await file.read()
    size_mb  = len(contents) / (1024 * 1024)
    if size_mb > 20:
        raise HTTPException(status_code=400, detail=f"File too large: {size_mb:.1f}MB. Max: 20MB.")

    # Save to disk
    doc_id    = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{doc_id}{file_ext}"
    with open(save_path, "wb") as f:
        f.write(contents)

    # Extract
    try:
        text = extract_text(str(save_path))
    except ValueError as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    # Chunk
    try:
        chunks = chunk_text(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chunking failed: {e}")

    # Embed + store
    try:
        store_result = embed_and_store(chunks, doc_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")

    return {
        "doc_id":        doc_id,
        "filename":      file.filename,
        "format":        file_ext,
        "size_mb":       round(size_mb, 2),
        "word_count":    len(text.split()),
        "char_count":    len(text),
        "chunks_stored": store_result["chunks_stored"],
        "embedding_dim": store_result["embedding_dim"],
        "model":         store_result["model"],
        "text_preview":  text[:500] + ("..." if len(text) > 500 else ""),
        "status":        "ready",
        "message":       f"Ingested {store_result['chunks_stored']} chunks. Ready for /search and /ask!"
    }


# ─────────────────────────────────────────────────────────────────────────────
# SEARCH — find relevant chunks by query
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/search")
def search_documents(req: SearchRequest):
    """
    Search stored chunks by natural language query.

    How it works:
      1. Embeds your query into a vector
      2. Finds the most similar chunks in ChromaDB
      3. Returns them ranked by relevance score (0-1)

    Use doc_id to search within one document only.
    Leave doc_id empty to search across all documents.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    if req.top_k < 1 or req.top_k > 20:
        raise HTTPException(status_code=400, detail="top_k must be between 1 and 20.")

    try:
        results = search(
            query  = req.query,
            top_k  = req.top_k,
            doc_id = req.doc_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")

    return {
        "query":        req.query,
        "doc_id":       req.doc_id,
        "top_k":        req.top_k,
        "results_count": len(results),
        "results":      results,
    }


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENTS — list + delete
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/documents")
def get_documents():
    """List all documents currently stored in ChromaDB."""
    try:
        docs  = list_documents()
        stats = collection_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "total_documents": stats["total_documents"],
        "total_chunks":    stats["total_chunks"],
        "documents":       docs,
    }


@app.delete("/documents/{doc_id}")
def remove_document(doc_id: str):
    """
    Delete a document and all its chunks from ChromaDB.
    This cannot be undone — you would need to re-upload the file.
    """
    try:
        result = delete_document(doc_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return result


# ─────────────────────────────────────────────────────────────────────────────
# STATS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/stats")
def get_stats():
    """Return ChromaDB collection stats — total docs and chunks stored."""
    try:
        return collection_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# ASK — placeholder for Day 5
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/ask")
def ask_question(req: SearchRequest):
    """LLM-powered Q&A — coming next."""
    raise HTTPException(
        status_code=501,
        detail="Not implemented yet. Coming soon!"
    )