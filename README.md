# NeuraDocs — Production-Grade Document Intelligence

A full-stack, production-ready Retrieval-Augmented Generation (RAG) chatbot.
Upload PDFs, ask questions in natural language, and get cited answers powered by OpenAI GPT.

---

## Architecture Overview

```
User Question
     │
     ▼
React Frontend (Vite + Tailwind)
     │  POST /api/v1/chat (SSE stream)
     ▼
FastAPI Backend
     │
     ├─► Embed query (OpenAI / sentence-transformers)
     │
     ├─► FAISS Semantic Search → Top-K chunks
     │
     ├─► Build prompt (system + context + history + question)
     │
     ├─► Stream tokens from GPT-3.5-turbo
     │
     └─► Return answer + source citations
```

### PDF Ingestion Pipeline
```
PDF Upload → Validate → Extract Text (PyMuPDF → pdfplumber → pypdf)
          → Chunk (RecursiveCharacterTextSplitter)
          → Embed (OpenAI / sentence-transformers)
          → Store in FAISS (with metadata JSON)
```

---

## Folder Structure

```
NeuraDocs-AI/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── upload.py       # POST /upload
│   │   │   ├── chat.py         # POST /chat (streaming SSE)
│   │   │   └── history.py      # GET/DELETE /history, /documents
│   │   ├── services/
│   │   │   ├── pdf_processor.py   # Text extraction (3-library fallback)
│   │   │   ├── chunker.py         # RecursiveCharacterTextSplitter
│   │   │   ├── embedder.py        # OpenAI / sentence-transformers
│   │   │   ├── rag_chain.py       # LangChain LCEL RAG pipeline
│   │   │   └── document_service.py # Ingestion orchestrator
│   │   ├── database/
│   │   │   ├── vector_store.py    # FAISS index + metadata
│   │   │   └── chat_history.py    # Session-based conversation memory
│   │   ├── models/
│   │   │   └── schemas.py         # Pydantic request/response models
│   │   ├── prompts/
│   │   │   └── rag_prompt.py      # System prompt + context builder
│   │   ├── utils/
│   │   │   └── logger.py          # Structured logging
│   │   ├── config.py              # Pydantic Settings (env vars)
│   │   └── main.py                # FastAPI app, CORS, middleware
│   ├── uploads/                   # Saved PDF files
│   ├── vectorstore/               # FAISS index + metadata + sessions
│   ├── tests/
│   │   └── test_api.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx         # Top bar with dark mode toggle
│   │   │   ├── Sidebar.jsx        # Document list + upload zone
│   │   │   ├── UploadZone.jsx     # Drag-and-drop PDF uploader
│   │   │   ├── MessageBubble.jsx  # Chat message with markdown + citations
│   │   │   └── ChatInput.jsx      # Auto-expanding textarea
│   │   ├── pages/
│   │   │   └── ChatPage.jsx       # Main chat layout
│   │   ├── hooks/
│   │   │   ├── useChat.js         # Streaming chat logic
│   │   │   └── useDocuments.js    # Document CRUD
│   │   ├── services/
│   │   │   └── api.js             # Axios + fetch SSE layer
│   │   ├── context/
│   │   │   └── AppContext.jsx     # Global state (useReducer)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- OpenAI API key (or use `sentence_transformers` for free offline embeddings)

### 1. Backend Setup

```bash
cd backend

# Copy and configure environment variables
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: http://localhost:5173

### 3. Docker (Full Stack)

```bash
# Copy and configure .env
cp backend/.env.example backend/.env
# Edit backend/.env with your OPENAI_API_KEY

# Build and start everything
docker-compose up --build

# App available at http://localhost:80
```

---

## API Reference

### POST /api/v1/upload
Upload one or more PDF files.

**Request:** `multipart/form-data`
- `files`: one or more PDF files

**Response:**
```json
[
  {
    "document_id": "uuid",
    "filename": "report.pdf",
    "page_count": 15,
    "chunk_count": 47,
    "message": "Successfully processed 'report.pdf'"
  }
]
```

### POST /api/v1/chat
Ask a question. Returns SSE stream by default.

**Request:**
```json
{
  "question": "What are the main findings?",
  "session_id": "session_123",
  "document_ids": [],
  "stream": true
}
```

**SSE Response format:**
```
data: The main findings\n\n
data:  include three\n\n
data: [SOURCES][{"filename":"report.pdf","page_number":3,...}]\n\n
data: [DONE]\n\n
```

### GET /api/v1/history/{session_id}
Get conversation history for a session.

### DELETE /api/v1/history/{session_id}
Clear conversation history.

### GET /api/v1/documents
List all uploaded documents.

### DELETE /api/v1/documents/{document_id}
Delete a document and its vectors.

---

## Configuration (.env)

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Required for OpenAI provider |
| `OPENAI_CHAT_MODEL` | `gpt-3.5-turbo` | LLM model |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `EMBEDDING_PROVIDER` | `openai` | `openai` or `sentence_transformers` |
| `CHUNK_SIZE` | `800` | Characters per chunk |
| `CHUNK_OVERLAP` | `150` | Overlap between chunks |
| `TOP_K` | `5` | Number of chunks to retrieve |
| `MAX_FILE_SIZE_MB` | `20` | Max PDF size |

---

## Running Tests

```bash
cd backend
pip install pytest pytest-anyio httpx
pytest tests/ -v
```

---

## Deployment

### Backend → Railway / Render
1. Push `backend/` to a GitHub repo
2. Connect to Railway/Render
3. Set environment variables from `.env.example`
4. Deploy — the `Dockerfile` handles everything

### Frontend → Vercel
1. Push `frontend/` to GitHub
2. Import to Vercel
3. Set `VITE_API_URL=https://your-backend-url.railway.app/api/v1`
4. Deploy

---

## Interview Q&A

**Q: What is RAG and why use it instead of fine-tuning?**
A: RAG (Retrieval-Augmented Generation) retrieves relevant documents at query time and injects them into the prompt. Fine-tuning bakes knowledge into model weights — expensive, slow to update, and prone to hallucination on specific facts. RAG is cheaper, updatable in real-time, and provides citations.

**Q: Why chunk documents instead of feeding the whole PDF?**
A: LLMs have a context window limit (e.g., 16K tokens for GPT-3.5). A 100-page PDF is ~75K tokens. Chunking splits text into pieces that fit the window. Overlap preserves context across boundaries.

**Q: How does semantic search work?**
A: Text is converted to dense vectors (embeddings) where semantically similar text has similar vectors. FAISS computes cosine similarity between the query vector and all stored chunk vectors, returning the top-K closest matches — even without keyword overlap.

**Q: Why FAISS over Pinecone/Qdrant?**
A: FAISS is free, runs locally, and is perfect for prototypes and small-medium datasets (<10M vectors). Pinecone/Qdrant are managed cloud services with better scalability, filtering, and multi-tenancy for production at scale.

**Q: How does streaming work?**
A: The LLM generates tokens one at a time. We use Server-Sent Events (SSE) — a one-way HTTP stream. The backend yields each token as `data: <token>\n\n`. The frontend reads the stream with `fetch` + `ReadableStream`, appending tokens to the UI in real-time.

**Q: How do you prevent hallucination?**
A: The system prompt explicitly instructs the model to answer ONLY from the provided context and say "I don't know" if the context is insufficient. Temperature is set to 0.1 (near-deterministic). Source citations make hallucinations verifiable.

**Q: How does conversation memory work?**
A: Each session has a JSON file storing all messages. The last N turns are injected into the prompt as `chat_history` via LangChain's `MessagesPlaceholder`. This gives the model context of the conversation without exceeding the token limit.

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | FastAPI, Pydantic, Uvicorn |
| RAG Framework | LangChain LCEL |
| LLM | OpenAI GPT-3.5-turbo |
| Embeddings | OpenAI text-embedding-3-small / sentence-transformers |
| Vector DB | FAISS (local) |
| PDF Processing | PyMuPDF, pdfplumber, pypdf |
| Deployment | Docker, Docker Compose, Vercel, Railway |
