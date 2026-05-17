# DocuMind AI 🧠

> Upload any document. Ask any question. Get answers grounded in your content.

DocuMind AI is a full-stack RAG (Retrieval-Augmented Generation) application that lets you chat with your documents. It extracts, chunks, and embeds your files into a local vector database, then uses a large language model to answer questions using only what's in your documents — no hallucinations, no guessing.

**Live:** `https://your-deployment-url.railway.app`

---

## How It Works

```
Document Upload → Text Extraction → Chunking → Embeddings → ChromaDB
                                                                ↓
   User Query  → Embed Query    → Similarity Search → LLM Prompt → Answer
```

Every answer comes with source chunks and relevance scores so you can verify exactly where the information came from.

---

## Supported Formats

| Format             | Parser      |
| ------------------ | ----------- |
| PDF                | PyMuPDF     |
| Word (.docx)       | python-docx |
| PowerPoint (.pptx) | python-pptx |
| Excel (.xlsx)      | openpyxl    |
| Text / Markdown    | built-in    |

---

## Tech Stack

| Layer      | Technology                                       |
| ---------- | ------------------------------------------------ |
| Backend    | FastAPI · Python 3.11                            |
| Frontend   | React · Vite                                     |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` (local) |
| Vector DB  | ChromaDB (local, persistent)                     |
| LLM        | Llama 3.3 70B via Groq API                       |
| Chunking   | LangChain RecursiveCharacterTextSplitter         |
| Deploy     | Railway                                          |

> 100% free stack. Groq API key at [console.groq.com](https://console.groq.com) — no credit card needed.

---

## API

| Method   | Endpoint          | Description                                  |
| -------- | ----------------- | -------------------------------------------- |
| `GET`    | `/health`         | Service health check                         |
| `POST`   | `/upload`         | Ingest a document into the vector store      |
| `POST`   | `/search`         | Semantic search across stored chunks         |
| `POST`   | `/ask`            | Full RAG pipeline — returns answer + sources |
| `GET`    | `/documents`      | List all stored documents                    |
| `DELETE` | `/documents/{id}` | Remove a document from the store             |
| `GET`    | `/stats`          | Vector store statistics                      |

---

## Local Development

**Prerequisites:** Python 3.11 · Node.js 18+ · [Groq API key](https://console.groq.com)

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # add your GROQ_API_KEY
uvicorn main:app --reload    # → http://localhost:8000/docs

# Frontend
cd frontend
npm install
npm run dev                  # → http://localhost:5173

# Verify
cd backend && python verify.py
```

---

## Project Structure

```
documind-ai/
├── backend/
│   ├── main.py          # FastAPI app + all routes
│   ├── ingest.py        # Extraction · chunking · embeddings
│   ├── retriever.py     # ChromaDB similarity search
│   ├── llm.py           # Prompt builder + Groq LLM
│   ├── verify.py        # Health check script
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       ├── index.css
│       └── components/
│           ├── ChatBox.jsx
│           ├── DocList.jsx
│           └── UploadZone.jsx
├── .github/workflows/
│   └── ci.yml
└── README.md
```

---

## License

MIT
