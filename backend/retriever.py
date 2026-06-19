"""
retriever.py — Similarity search + collection management

Given a user question, finds the most relevant chunks
from stored documents using cosine similarity.
"""

from ingest import _collection, get_embedding_model


# ─────────────────────────────────────────────────────────────────────────────
# SEARCH
# ─────────────────────────────────────────────────────────────────────────────

def search(query: str, top_k: int = 5, doc_id: str = None) -> list[dict]:
    """
    Embed the query and find the most similar chunks in ChromaDB.

    How it works:
      1. Embed the query with the same model used on the documents
      2. ChromaDB computes cosine similarity against every stored chunk
      3. Returns top_k closest chunks ranked by relevance score

    Args:
        query:  the user's question or search phrase
        top_k:  how many chunks to return (5 is a good default)
        doc_id: optional — restrict search to one specific document

    Returns:
        List of dicts sorted by score desc:
        [{ text, score, doc_id, chunk_index, chunk_total }, ...]
    """
    if not query or not query.strip():
        raise ValueError("Query cannot be empty.")

    # Check collection has data before querying
    total = _collection.count()
    if total == 0:
        return []

    # Cap top_k to what's actually stored
    top_k = min(top_k, total)

    model = get_embedding_model()
    q_vec = model.encode([query])[0].tolist()

    where = {"doc_id": doc_id} if doc_id else None

    results = _collection.query(
        query_embeddings=[q_vec],
        n_results=top_k,
        where=where,
        include=["documents", "distances", "metadatas"],
    )

    chunks    = results["documents"][0]
    distances = results["distances"][0]
    metadatas = results["metadatas"][0]

    formatted = []
    from pathlib import Path
    for text, dist, meta in zip(chunks, distances, metadatas):
        filename = meta.get("filename")
        if not filename:
            did = meta.get("doc_id")
            uploads_dir = Path("uploads")
            matches = list(uploads_dir.glob(f"{did}.*")) if uploads_dir.exists() else []
            filename = f"Untitled{matches[0].suffix}" if matches else "Untitled"
        formatted.append({
            "text":        text,
            "score":       round(1 - dist, 4),  # cosine distance → similarity
            "doc_id":      meta.get("doc_id"),
            "chunk_index": meta.get("chunk_index"),
            "chunk_total": meta.get("chunk_total"),
            "filename":    filename,
        })

    formatted.sort(key=lambda x: x["score"], reverse=True)
    return formatted


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

def list_documents() -> list[dict]:
    """
    Return all unique documents currently stored in ChromaDB.
    Groups chunks by doc_id and returns one entry per document.
    """
    from pathlib import Path
    
    total = _collection.count()
    if total == 0:
        return []

    # Fetch all stored chunks with their metadata
    all_data = _collection.get(include=["metadatas"])
    metadatas = all_data["metadatas"]

    # Group by doc_id
    docs = {}
    for meta in metadatas:
        did = meta.get("doc_id")
        if did not in docs:
            filename = meta.get("filename")
            if not filename:
                uploads_dir = Path("uploads")
                matches = list(uploads_dir.glob(f"{did}.*")) if uploads_dir.exists() else []
                filename = f"Untitled{matches[0].suffix}" if matches else "Untitled"
            docs[did] = {
                "doc_id":      did,
                "chunk_total": meta.get("chunk_total", 0),
                "filename":    filename,
            }

    return list(docs.values())


def delete_document(doc_id: str) -> dict:
    """
    Delete all chunks belonging to a specific document from ChromaDB.

    Args:
        doc_id: the document ID returned by /upload

    Returns:
        dict confirming deletion and how many chunks were removed
    """
    # Check it exists first
    existing = _collection.get(where={"doc_id": doc_id})
    count = len(existing["ids"])

    if count == 0:
        raise ValueError(f"Document '{doc_id}' not found in the database.")

    _collection.delete(where={"doc_id": doc_id})

    return {
        "doc_id":          doc_id,
        "chunks_deleted":  count,
        "status":          "deleted",
    }


def collection_stats() -> dict:
    """Return stats about what is stored in ChromaDB."""
    total_chunks = _collection.count()
    docs = list_documents()
    return {
        "total_chunks":    total_chunks,
        "total_documents": len(docs),
        "collection":      "documents",
        "model":           "all-MiniLM-L6-v2",
    }

