# import os
from pathlib import Path
import chromadb as _chromadb

# ── text extraction (all formats) ──────────────────────────────────────
# ── chunking + embeddings will be added below  ─────────────────────────

SUPPORTED_FORMATS = [".pdf", ".docx", ".pptx", ".xlsx", ".txt", ".md"]


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def extract_text(file_path: str) -> str:
    """
    Extract raw text from any supported document.
    Detects format by file extension and routes to the right parser.

    Args:
        file_path: absolute or relative path to the uploaded file

    Returns:
        Plain text string with all content from the document

    Raises:
        ValueError: if the file format is not supported
        FileNotFoundError: if the file does not exist
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = path.suffix.lower()

    if ext not in SUPPORTED_FORMATS:
        raise ValueError(
            f"Unsupported format: '{ext}'. "
            f"Supported: {', '.join(SUPPORTED_FORMATS)}"
        )

    extractors = {
        ".pdf":  _extract_pdf,
        ".docx": _extract_docx,
        ".pptx": _extract_pptx,
        ".xlsx": _extract_xlsx,
        ".txt":  _extract_txt,
        ".md":   _extract_txt,   # markdown is plain text
    }

    text = extractors[ext](str(path))

    # Basic cleanup: collapse excessive blank lines
    lines = text.splitlines()
    cleaned = "\n".join(line for line in lines if line.strip() != "" or lines.index(line) == 0)

    return cleaned.strip()


# ─────────────────────────────────────────────────────────────────────────────
# PRIVATE PARSERS — one per format
# ─────────────────────────────────────────────────────────────────────────────

def _extract_pdf(file_path: str) -> str:
    """Extract text from PDF using PyMuPDF (fitz). Handles multi-page docs."""
    import fitz  # PyMuPDF

    text_parts = []
    with fitz.open(file_path) as doc:
        for page_num, page in enumerate(doc, start=1):
            page_text = page.get_text("text")  # plain text mode
            if page_text.strip():
                text_parts.append(f"[Page {page_num}]\n{page_text}")

    if not text_parts:
        raise ValueError(
            "No text found in PDF. "
            "It may be a scanned image — OCR is not supported yet."
        )

    return "\n\n".join(text_parts)


def _extract_docx(file_path: str) -> str:
    """Extract text from Word .docx — paragraphs + tables."""
    from docx import Document

    doc = Document(file_path)
    text_parts = []

    # Paragraphs (headings, body, bullets)
    for para in doc.paragraphs:
        if para.text.strip():
            text_parts.append(para.text.strip())

    # Tables
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(
                cell.text.strip() for cell in row.cells if cell.text.strip()
            )
            if row_text:
                text_parts.append(row_text)

    return "\n".join(text_parts)


def _extract_pptx(file_path: str) -> str:
    """Extract text from PowerPoint .pptx — all slides and shapes."""
    from pptx import Presentation

    prs = Presentation(file_path)
    text_parts = []

    for slide_num, slide in enumerate(prs.slides, start=1):
        slide_texts = []
        for shape in slide.shapes:
            if not shape.has_text_frame:
                continue
            for para in shape.text_frame.paragraphs:
                line = " ".join(run.text for run in para.runs).strip()
                if line:
                    slide_texts.append(line)

        if slide_texts:
            text_parts.append(f"[Slide {slide_num}]\n" + "\n".join(slide_texts))

    return "\n\n".join(text_parts)


def _extract_xlsx(file_path: str) -> str:
    """Extract text from Excel .xlsx — all sheets, row by row."""
    from openpyxl import load_workbook

    wb = load_workbook(file_path, read_only=True, data_only=True)
    text_parts = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        sheet_text = [f"[Sheet: {sheet_name}]"]

        for row in ws.iter_rows(values_only=True):
            # Convert each cell to string, skip fully empty rows
            row_values = [str(cell) for cell in row if cell is not None]
            if row_values:
                sheet_text.append(" | ".join(row_values))

        if len(sheet_text) > 1:   # more than just the header
            text_parts.append("\n".join(sheet_text))

    wb.close()
    return "\n\n".join(text_parts)


def _extract_txt(file_path: str) -> str:
    """Extract text from plain .txt or .md files."""
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()



# ─────────────────────────────────────────────────────────────────────────────
# DAY 3 — CHUNKING
# ─────────────────────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> list[str]:
    """
    Split a long text into overlapping chunks.

    Why overlap? So a sentence that falls at a chunk boundary is not
    lost — the next chunk repeats the last few words of the previous one,
    giving the LLM enough context when retrieving.

    Args:
        text:          the full extracted text from the document
        chunk_size:    target size of each chunk in characters
        chunk_overlap: how many characters to repeat between chunks

    Returns:
        List of text chunks
    """
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    if not text or not text.strip():
        raise ValueError("Cannot chunk empty text.")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    chunks = splitter.split_text(text)
    return [c.strip() for c in chunks if c.strip()]


# ─────────────────────────────────────────────────────────────────────────────
# DAY 3 — EMBEDDINGS + VECTOR STORE
# ─────────────────────────────────────────────────────────────────────────────

_chroma_client = _chromadb.PersistentClient(path="./chroma_db")
_collection = _chroma_client.get_or_create_collection(
    name="documents",
    metadata={"hnsw:space": "cosine"},
)


def get_embedding_model():
    """Load all-MiniLM-L6-v2 — downloads ~90MB once, then cached."""
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")


def embed_and_store(chunks: list[str], doc_id: str) -> dict:
    """
    Embed each chunk with sentence-transformers and store in ChromaDB.

    Args:
        chunks: list of text chunks from chunk_text()
        doc_id: unique document ID

    Returns:
        dict with storage stats
    """
    if not chunks:
        raise ValueError("No chunks to embed.")

    model = get_embedding_model()
    embeddings = model.encode(chunks, show_progress_bar=False)

    ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [
        {"doc_id": doc_id, "chunk_index": i, "chunk_total": len(chunks)}
        for i in range(len(chunks))
    ]

    # Delete existing chunks for this doc (re-upload support)
    try:
        existing = _collection.get(where={"doc_id": doc_id})
        if existing["ids"]:
            _collection.delete(where={"doc_id": doc_id})
    except Exception:
        pass

    _collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings.tolist(),
        metadatas=metadatas,
    )

    return {
        "doc_id":        doc_id,
        "chunks_stored": len(chunks),
        "embedding_dim": len(embeddings[0]),
        "model":         "all-MiniLM-L6-v2",
    }