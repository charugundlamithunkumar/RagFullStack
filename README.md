# Multimodal RAG Knowledge Assistant

An advanced, production-ready **Multimodal Retrieval-Augmented Generation (RAG)** web application built with **Next.js 14**, **FastAPI**, **FAISS**, **SentenceTransformers**, **OpenCLIP**, **SQLite**, and **Groq / Local Ollama LLM**.

Upload multiple PDF documents or images (PNG, JPG, WEBP, etc.) or press **Ctrl+V** anywhere to paste images directly. Ask complex questions and get grounded answers with **text citations, formatted mathematical formulas, and inline visual diagrams/figures**.

---

## 📐 System Architecture & Project Overflow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND (Next.js 14)                                   │
│  - Apple HIG & Pages Design Aesthetics      - Claude-Style Collapsible Sidebar         │
│  - Clipboard Paste (Ctrl+V) Image Ingestion - Inline Math Formula Formatting           │
│  - Multiple File Uploads (PDF & Images)     - Copy Buttons & Text Selection (I-beam)   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP / REST API
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 BACKEND (FastAPI)                                      │
│                                                                                        │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  ┌───────────────────────┐  │
│  │   DOCUMENT INGESTION    │  │     VECTOR INDEXING      │  │  DATABASE PERSISTENCE │  │
│  │ - Text Extraction (PDF) │  │ - SentenceTransformers   │  │ - SQLite Database     │  │
│  │ - Figure/Image Parser   │  │   (bge-small-en-v1.5)    │  │   (rag_history.db)    │  │
│  │ - Caption Association   │  │ - OpenCLIP (ViT-B-32)    │  │ - FAISS Disk Storage  │  │
│  └────────────┬────────────┘  └────────────┬─────────────┘  └───────────┬───────────┘  │
│               │                            │                            │              │
│               └────────────────────────────┼────────────────────────────┘              │
│                                            ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           HYBRID RETRIEVAL & GENERATION                          │  │
│  │  1. Document Query Routing  ───> Filter relevant PDFs/Images                     │  │
│  │  2. Multimodal Vector Search ──> Text Cosine + OpenCLIP Image Cosine             │  │
│  │  3. Reciprocal Rank Fusion   ───> Combine rank lists (RRF k=60)                  │  │
│  │  4. Cross-Encoder Reranking  ───> Precision score rerank & context selection     │  │
│  │  5. LLM Answer Synthesis     ───> Groq Cloud API / Local Ollama / Local Fallback │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 🔄 Detailed Data & Request Overflow

1. **Document & Image Ingestion Overflow**:
   - **User Action**: Files are uploaded via drag & drop, file browser dialog, or pasted directly using `Ctrl+V`.
   - **PDF Processing**: Text chunks are extracted page-by-page. Raster figures are extracted and associated with surrounding caption text.
   - **Image Processing**: PNG, JPG, WEBP, BMP, GIF, and TIFF files are ingested directly into the visual vector space.
   - **Indexing**: Text is embedded via `bge-small-en-v1.5` (SentenceTransformers) into a FAISS index. Images are embedded via `ViT-B-32` (OpenCLIP) into a separate FAISS index.
   - **Persistence**: FAISS vector indices are stored in memory and automatically persisted to disk under `backend/_indices/<session_id>/<doc_name>/`.

2. **Thread & Chat History Overflow**:
   - **Sidebar Navigation**: Next.js Claude-style sidebar talks to FastAPI `/chat/threads` endpoints.
   - **SQLite Storage**: Chat threads, message histories, user queries, assistant answers, and document attachment mappings are saved in `backend/rag_history.db`.
   - **Thread Management**: Supports thread creation, inline thread renaming (`PUT /chat/threads/{id}`), deletion (`DELETE`), and automatic loading of document attachments upon switching threads.

3. **Retrieval & Answer Generation Overflow**:
   - **Query Routing**: The user query is checked against document summaries to filter target document context.
   - **Dual Vector Search**: Runs parallel searches across text FAISS index (bi-encoder text similarity) and image FAISS index (OpenCLIP text-to-image similarity).
   - **Reciprocal Rank Fusion (RRF)**: Merges text and image rank distributions using scale-invariant rank position scoring.
   - **Reranking**: Reranks top text passages with a cross-encoder model and selects generation context.
   - **LLM Synthesis**:
     - *Primary*: Groq Cloud LLM API (`openai/gpt-oss-120b` or `llama-3.3-70b-versatile`).
     - *Local Option 1*: Local Ollama server (`http://localhost:11434` running `llama3.2`, `mistral`, etc.).
     - *Local Option 2*: Local Grounded RAG Synthesizer (100% offline fallback formatting structured answers with citations).
   - **UI Rendering**: Returns grounded markdown text with Apple iOS blue headings, formatted mathematical equations, prominent inline image displays, copy buttons, and I-beam text selection.

---

## ✨ Key Features

- 📄 **Multi-File PDF & Image Ingestion**: Upload multiple PDFs and images at once.
- 📋 **Clipboard Image Paste (`Ctrl+V`)**: Press `Ctrl+V` anywhere to paste images directly from your clipboard.
- 🎨 **Apple HIG & Pages UI Aesthetics**: Clean warm off-white canvas, blue headings (`#007AFF`), bold term highlights, and custom background pattern options.
- 💬 **Claude-Style Sidebar**: Persistent chat thread list with three-dots menu on hover (Rename & Delete).
- 💾 **Dual Persistence Layer**:
  - SQLite Database (`backend/rag_history.db`) for chat threads & messages.
  - FAISS Disk Index Persistence (`backend/_indices/`) for vector store reloads across restarts.
- 🖼️ **Prominent Inline Image References**: Retrieved diagrams and figures render directly inside the answer cards with full-screen lightbox modal expand.
- 📐 **LaTeX Math Equation Formatting**: Mathematical formulas (`\[ ... \]`, `\frac{}{}`, `\text{}`) render cleanly without raw code brackets.
- 📋 **Copy Option & I-Beam Selection**: Copy button on all message blocks and native text selection (`select-text`).
- 🤖 **Flexible LLM Generation**: Supports Groq API, 100% Local Ollama LLM, or 100% Local Offline Grounded Fallback Synthesizer.

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.9+ (Python 3.10/3.11/3.14 recommended)
- Node.js 18+ and npm

### 2. Backend Setup

```bash
# Clone the repository
git clone https://github.com/charugundlamithunkumar/RagFullStack.git
cd RagFullStack/RagProject

# Create virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt -r backend/requirements-web.txt

# (Optional) Set up environment variables
cp .env.example .env
# Edit .env and add your GROQ_API_KEY (optional, free at console.groq.com)
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Run Backend Server

In a second terminal (from `RagProject` root directory):
```bash
# On Windows PowerShell:
$env:OPENBLAS_NUM_THREADS="1"; py -m uvicorn backend.main:app --port 8000

# On Linux/macOS:
OPENBLAS_NUM_THREADS=1 uvicorn backend.main:app --port 8000
```

Open **`http://localhost:3000`** in your browser!

---

## ⚙️ Configuration & API Keys

| Component | Model / Technology | API Key Required? | Status |
| :--- | :--- | :--- | :--- |
| **Text Embeddings** | `bge-small-en-v1.5` (SentenceTransformers) | ❌ **No (100% Local)** | PyTorch local model |
| **Image Embeddings** | `ViT-B-32` (OpenCLIP) | ❌ **No (100% Local)** | PyTorch local model |
| **Vector Store** | `FAISS` | ❌ **No (100% Local)** | Local disk + memory index |
| **Database** | `SQLite3` (`rag_history.db`) | ❌ **No (100% Local)** | Local database file |
| **LLM Generation** | Groq API (`GROQ_API_KEY`) | ⚠️ **Optional** | Pre-configured in `.env` |
| **Local LLM** | Ollama (`http://localhost:11434`) | ❌ **No (100% Local)** | `ollama run llama3.2` |

---

## 📁 Repository Structure

```
RagProject/
├── backend/
│   ├── main.py                  # FastAPI app entry point & static file mounts
│   ├── database.py              # SQLite database (rag_history.db) manager
│   ├── session_store.py         # FAISS vector index store with disk persistence
│   ├── schemas.py               # Pydantic data models
│   └── routes/
│       ├── documents.py         # Upload (PDF/Image) & document management APIs
│       └── chat.py              # Ask endpoint & chat thread CRUD routes
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Next.js main UI (Claude sidebar, Ctrl+V, math, copy)
│   │   └── globals.css          # CSS tokens, Apple HIG styles & markdown styling
│   ├── lib/
│   │   ├── api.ts               # Frontend API client
│   │   ├── session.ts           # Browser session ID helper
│   │   └── types.ts             # TypeScript interfaces
│   └── public/                  # Static assets & background patterns
├── ingestion/                   # PDF text & figure extraction, caption association
├── indexing/                    # Text (SentenceTransformers) & Image (OpenCLIP) FAISS indexing
├── retrieval/                   # Query router, FAISS search, RRF fusion, reranker
├── generation/                  # Answer synthesis (Groq / Ollama / Local Fallback)
└── eval/                        # Retrieval evaluation suite & reference document fixture
```

---

## 🧪 Evaluation Suite

Run retrieval evaluations against fixed benchmark documents:

```bash
python -m eval.generate_fixture   # Builds reference PDF with embedded figures
python -m eval.run_eval           # Evaluates retrieval configurations & writes eval/results.md
```

---

## 📄 License

MIT License. Designed for Multimodal Document Knowledge Intelligence.
