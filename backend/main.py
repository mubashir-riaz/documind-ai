# import os
import uuid
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ingest import extract_text, chunk_text, embed_and_store, SUPPORTED_FORMATS

# ── upload folder lives inside backend/ and is gitignored ──────────────────
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="AI Document Analyzer",
    description="RAG-powered multi-format document Q&A",
    version="0.3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# EXISTING ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "AI Document Analyzer is running!"}


@app.get("/")
def root():
    return {
        "project": "AI Document Analyzer",
        "version": "0.3.0",
        "supported_formats": SUPPORTED_FORMATS,
        "docs": "/docs",
        "endpoints": ["/health", "/upload", ""]
    }


# ─────────────────────────────────────────────────────────────────────────────
# DAY 2 + DAY 3 — FULL UPLOAD PIPELINE
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

    Accepts: PDF, DOCX, PPTX, XLSX, TXT, MD
    Returns: doc_id, stats, preview — ready for /ask
    """

    # ── Step 1: validate format ──────────────────────────────────────────────
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type: '{file_ext}'. "
                f"Supported: {', '.join(SUPPORTED_FORMATS)}"
            )
        )

    # ── Step 2: validate size (max 20MB) ────────────────────────────────────
    MAX_SIZE_MB = 20
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {size_mb:.1f}MB. Max: {MAX_SIZE_MB}MB."
        )

    # ── Step 3: save to disk ─────────────────────────────────────────────────
    doc_id    = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{doc_id}{file_ext}"
    with open(save_path, "wb") as f:
        f.write(contents)

    # ── Step 4: extract text ─────────────────────────────────────────────────
    try:
        text = extract_text(str(save_path))
    except ValueError as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    # ── Step 5: chunk text ───────────────────────────────────────────────────
    try:
        chunks = chunk_text(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chunking failed: {e}")

    # ── Step 6: embed + store in ChromaDB ───────────────────────────────────
    try:
        store_result = embed_and_store(chunks, doc_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")

    # ── Step 7: return full result ───────────────────────────────────────────
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
        "status":        "ready",           # doc is ready to be queried
        "message":       f"Document ingested into {store_result['chunks_stored']} chunks. Ready for /ask!"
    }
