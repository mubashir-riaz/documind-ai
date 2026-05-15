# DocuMind AI 🧠📄

A RAG (Retrieval-Augmented Generation) app.
Upload **any document** → ask questions → get answers grounded in your content.

## Supported Document Formats

| Format             | Library     |
| ------------------ | ----------- |
| PDF (.pdf)         | PyMuPDF     |
| Word (.docx)       | python-docx |
| PowerPoint (.pptx) | python-pptx |
| Excel (.xlsx)      | openpyxl    |
| Text (.txt)        | built-in    |
| Markdown (.md)     | built-in    |

## Architecture

```
Document Upload → Text Extraction → Chunking → Embeddings → ChromaDB
                                                                 ↓
User Query → Embed Query → Similarity Search → Prompt Builder → LLM → Answer
```

## Tech Stack

| Layer       | Technology                                  | Cost |
| ----------- | ------------------------------------------- | ---- |
| Backend     | FastAPI (Python)                            | Free |
| Frontend    | React + Vite                                | Free |
| Doc Parsing | PyMuPDF, python-docx, python-pptx, openpyxl | Free |
| Chunking    | LangChain TextSplitter                      | Free |
| Embeddings  | sentence-transformers (runs locally)        | Free |
| Vector DB   | ChromaDB                                    | Free |
| LLM         | Llama 3.3 70B via Groq API                  | Free |
| Deploy      | Railway + Vercel                            | Free |

> **100% free stack.** Get your Groq API key at [console.groq.com](https://console.groq.com) — no credit card needed.

## Progress

| Feature                          | Status     |
| -------------------------------- | ---------- |
| Project setup & FastAPI          | ✅ Done    |
| Multi-format document extraction | ✅ Done    |
| Chunking + embeddings + ChromaDB | ✅ Done    |
| Search / retrieval endpoint      | ✅ Done    |
| LLM response via Groq            | ✅ Done    |
| React frontend                   | 🔜 Pending |
| Deploy to Railway + Vercel       | 🔜 Pending |

## Local Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Groq API key → [console.groq.com](https://console.groq.com) (free, no credit card)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Open .env and paste your GROQ_API_KEY

uvicorn main:app --reload
```

Visit **http://localhost:8000/docs** — Swagger UI with all endpoints.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173**

### Verify everything is working

```bash
cd backend
python verify.py
```

## API Endpoints

| Method | Endpoint | Description                                        |
| ------ | -------- | -------------------------------------------------- |
| GET    | /health  | Health check (used by deploy platforms)            |
| POST   | /upload  | Upload any document → extract, chunk, embed, store |
| POST   | /search  | Search stored chunks by query                      |
| POST   | /ask     | Ask a question, get a grounded answer              |

## Project Structure

```
documind-ai/
├── backend/
│   ├── main.py          # FastAPI app + routes
│   ├── ingest.py        # Document extraction + chunking + embeddings
│   ├── retriever.py     # ChromaDB similarity search
│   ├── llm.py           # Prompt builder + Groq LLM call
│   ├── verify.py        # Health check script
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── App.jsx
│       └── components/
├── .github/workflows/
│   └── ci.yml
└── README.md
```

## License

MIT
