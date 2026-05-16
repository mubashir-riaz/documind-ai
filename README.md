# DocuMind AI 🧠📄

A RAG (Retrieval-Augmented Generation) app.
Upload **any document** → ask questions → get answers grounded in your content.

**Live demo:** `https://documind-ai.vercel.app` _(replace with your URL after deploy)_

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

| Layer           | Technology                                  | Cost      |
| --------------- | ------------------------------------------- | --------- |
| Backend         | FastAPI (Python 3.11)                       | Free      |
| Frontend        | React + Vite                                | Free      |
| Doc Parsing     | PyMuPDF, python-docx, python-pptx, openpyxl | Free      |
| Chunking        | LangChain TextSplitter                      | Free      |
| Embeddings      | sentence-transformers (runs locally)        | Free      |
| Vector DB       | ChromaDB                                    | Free      |
| LLM             | Llama 3.3 70B via Groq API                  | Free      |
| Backend Deploy  | Railway                                     | Free tier |
| Frontend Deploy | Vercel                                      | Free tier |

> **100% free stack.** Get your Groq API key at [console.groq.com](https://console.groq.com) — no credit card needed.

## Progress

| Feature                          | Status  |
| -------------------------------- | ------- |
| Project setup & FastAPI          | ✅ Done |
| Multi-format document extraction | ✅ Done |
| Chunking + embeddings + ChromaDB | ✅ Done |
| Search / retrieval endpoint      | ✅ Done |
| LLM response via Groq            | ✅ Done |
| React frontend                   | ✅ Done |
| Deploy to Railway + Vercel       | ✅ Done |

## Local Setup

### Prerequisites

- Python 3.11
- Node.js 18+
- Groq API key → [console.groq.com](https://console.groq.com) (free, no credit card)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac / Linux

pip install -r requirements.txt

cp .env.example .env
# Open .env — paste your GROQ_API_KEY

uvicorn main:app --reload
```

API docs: **http://localhost:8000/docs**

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: **http://localhost:5173**

### Verify everything works

```bash
cd backend
python verify.py
```

## API Endpoints

| Method | Endpoint        | Description                                    |
| ------ | --------------- | ---------------------------------------------- |
| GET    | /health         | Health check                                   |
| POST   | /upload         | Upload document → extract, chunk, embed, store |
| POST   | /search         | Search stored chunks by query                  |
| POST   | /ask            | Full RAG — question → grounded answer          |
| GET    | /documents      | List all stored documents                      |
| DELETE | /documents/{id} | Delete a document                              |
| GET    | /stats          | Collection stats                               |

## Project Structure

```
documind-ai/
├── backend/
│   ├── main.py            # FastAPI app + all routes
│   ├── ingest.py          # Doc extraction + chunking + embeddings
│   ├── retriever.py       # ChromaDB similarity search
│   ├── llm.py             # Prompt builder + Groq LLM
│   ├── verify.py          # Pre-run health check
│   ├── requirements.txt
│   ├── railway.toml       # Railway deploy config
│   ├── Procfile           # Backup start command
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── index.css
│   │   └── components/
│   │       ├── ChatBox.jsx
│   │       ├── DocList.jsx
│   │       └── UploadZone.jsx
│   ├── vercel.json        # Vercel deploy config
│   ├── vite.config.js
│   └── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
└── README.md
```

## Deploying

### Backend → Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select `documind-ai` repo → set **Root Directory** to `backend`
3. Add environment variables:
   - `GROQ_API_KEY` = your Groq key
   - `FRONTEND_URL` = your Vercel URL (add after frontend deploy)
4. Railway auto-deploys on every push to `main`
5. Copy your Railway URL (e.g. `https://documind-ai-production.up.railway.app`)

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select `documind-ai` repo → set **Root Directory** to `frontend`
3. Add environment variable:
   - `VITE_API_URL` = your Railway backend URL
4. Vercel auto-deploys on every push to `main`
5. Copy your Vercel URL → go back to Railway → add it as `FRONTEND_URL`

## License

MIT
