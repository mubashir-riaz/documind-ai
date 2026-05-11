"""
retriever.py — Day 3

Similarity search against ChromaDB.
Given a user question, find the top-K most relevant chunks
from all stored documents.
"""

from ingest import _collection, get_embedding_model


def search(query: str, top_k: int = 5, doc_id: str = None) -> list[dict]:
    """
    Embed the query and find the most similar chunks in ChromaDB.

    How it works:
      1. Embed the query using the same model used to embed the documents
      2. ChromaDB computes cosine similarity between the query vector
         and every stored chunk vector
      3. Returns the top_k closest chunks

    Args:
        query:  the user's question
        top_k:  how many chunks to return (5 is a good default)
        doc_id: optional — filter to only one document

    Returns:
        List of dicts, each with: text, score, doc_id, chunk_index
    """
    if not query or not query.strip():
        raise ValueError("Query cannot be empty.")

    # Embed the query — same model as the documents
    model  = get_embedding_model()
    q_vec  = model.encode([query])[0].tolist()

    # Build optional filter (search within one doc only)
    where  = {"doc_id": doc_id} if doc_id else None

    # Query ChromaDB
    results = _collection.query(
        query_embeddings=[q_vec],
        n_results=top_k,
        where=where,
        include=["documents", "distances", "metadatas"],
    )

    # Format results — ChromaDB returns nested lists (one per query)
    chunks     = results["documents"][0]
    distances  = results["distances"][0]   # lower = more similar (cosine)
    metadatas  = results["metadatas"][0]

    formatted = []
    for text, dist, meta in zip(chunks, distances, metadatas):
        formatted.append({
            "text":        text,
            "score":       round(1 - dist, 4),   # convert distance → similarity
            "doc_id":      meta.get("doc_id"),
            "chunk_index": meta.get("chunk_index"),
        })

    # Sort by score descending (most relevant first)
    formatted.sort(key=lambda x: x["score"], reverse=True)
    return formatted


def collection_stats() -> dict:
    """Return stats about what is stored in ChromaDB. Useful for debugging."""
    count = _collection.count()
    return {
        "total_chunks": count,
        "collection":   "documents",
        "model":        "all-MiniLM-L6-v2",
    }
