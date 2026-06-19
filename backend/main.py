import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from ingest import extract_text, chunk_text, embed_and_store, SUPPORTED_FORMATS
from retriever import search, list_documents, delete_document, collection_stats
from llm import answer_question


load_dotenv()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# ── CORS — allow both local dev and production frontend ──────────────────────
# FRONTEND_URL is set in Railway environment variables on deploy
_frontend_url = os.getenv("FRONTEND_URL", "")
_origins = [
    "http://localhost:5173",     # local Vite dev server
    "http://localhost:4173",     # local Vite preview
]
if _frontend_url:
    _origins.append(_frontend_url)

app = FastAPI(
    title="DocuMind AI",
    description="RAG-powered multi-format document Q&A",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query:  str
    top_k:  int            = 5
    doc_id: Optional[str]  = None


class AskRequest(BaseModel):
    question: str
    doc_id:   Optional[str] = None
    top_k:    int           = 5


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
        "version":           "1.0.0",
        "supported_formats": SUPPORTED_FORMATS,
        "docs":              "/docs",
    }


# ─────────────────────────────────────────────────────────────────────────────
# UPLOAD
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{file_ext}'. Supported: {', '.join(SUPPORTED_FORMATS)}"
        )

    contents = await file.read()
    size_mb  = len(contents) / (1024 * 1024)
    if size_mb > 20:
        raise HTTPException(status_code=400, detail=f"File too large: {size_mb:.1f}MB. Max: 20MB.")

    doc_id    = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{doc_id}{file_ext}"
    with open(save_path, "wb") as f:
        f.write(contents)

    try:
        text = extract_text(str(save_path))
    except ValueError as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    try:
        chunks = chunk_text(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chunking failed: {e}")

    try:
        store_result = embed_and_store(chunks, doc_id, filename=file.filename)
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
# SEARCH
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/search")
def search_documents(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    if req.top_k < 1 or req.top_k > 20:
        raise HTTPException(status_code=400, detail="top_k must be between 1 and 20.")

    try:
        results = search(query=req.query, top_k=req.top_k, doc_id=req.doc_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")

    return {
        "query":         req.query,
        "doc_id":        req.doc_id,
        "top_k":         req.top_k,
        "results_count": len(results),
        "results":       results,
    }


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/documents")
def get_documents():
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
    try:
        return delete_document(doc_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# STATS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/stats")
def get_stats():
    try:
        return collection_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# ASK — full RAG pipeline
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/ask")
def ask(req: AskRequest):
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if req.top_k < 1 or req.top_k > 20:
        raise HTTPException(status_code=400, detail="top_k must be between 1 and 20.")

    try:
        chunks = search(query=req.question, top_k=req.top_k, doc_id=req.doc_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {e}")

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail="No documents found. Please upload a document first using /upload."
        )

    try:
        result = answer_question(
            question       = req.question,
            context_chunks = [c["text"] for c in chunks],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {e}")

    return {
        "question":      result["question"],
        "answer":        result["answer"],
        "model":         result["model"],
        "chunks_used":   result["chunks_used"],
        "context_chars": result["context_chars"],
        "doc_id":        req.doc_id,
        "sources": [
            {
                "chunk_index": c["chunk_index"],
                "score":       c["score"],
                "preview":     c["text"][:200] + ("..." if len(c["text"]) > 200 else ""),
            }
            for c in chunks
        ],
    }
