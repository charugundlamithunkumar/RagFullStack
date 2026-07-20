# RagProject — FastAPI + Next.js Migration Plan

## Context (read this first — no prior conversation assumed)

`RagProject` is currently a single Streamlit app (`app/streamlit_app.py`)
wrapping a multimodal RAG pipeline: PDF ingestion (`ingestion/`), FAISS
indexing (`indexing/`), agentic multi-doc retrieval (`retrieval/`), and
Groq-based generation (`generation/`). The pipeline logic is solid and
already fixed for its two known scaling bugs (crowding-out, chunk
overlap) plus has an agentic query router. What's changing is *only* the
UI layer: Streamlit is being replaced by a FastAPI backend + Next.js
frontend. **No pipeline module changes its function signatures.** The
migration's job is to call the same functions from HTTP routes instead
of from a Streamlit script, and to replace `st.session_state` with an
explicit server-side session store.

Two known bugs in the pipeline (pin-loss in `select_generation_context`,
one-figure-per-doc cap in `generate_answer`) should be fixed **as part
of this migration**, in the same files, since you'll have them open
anyway — see Section 6.

Work through sections in order. Each has: what to build, exact code,
and a verification step.

---

## 0. Prerequisites

```bash
# from repo root
pip install fastapi uvicorn[standard] python-multipart --break-system-packages
cd frontend 2>/dev/null || npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir
```

Confirm your existing modules still import cleanly standalone (they
should — nothing here touches them):

```bash
python -c "from ingestion.extract_text import extract_text_from_pdf; from retrieval.search import search_multi_doc; from generation.answer import generate_answer; print('ok')"
```

---

## 1. Backend skeleton

### New folder, alongside the existing modules (do NOT nest inside `app/`)

```
backend/
├── __init__.py
├── main.py              # FastAPI app, CORS, route registration
├── session_store.py     # in-memory session_id -> documents{} store
├── schemas.py            # Pydantic request/response models
└── routes/
    ├── __init__.py
    ├── documents.py      # POST /documents/upload, GET /documents, DELETE /documents/{name}
    └── chat.py           # POST /chat/ask
```

### `backend/main.py`

```python
"""FastAPI entrypoint. Run with: uvicorn backend.main:app --reload --port 8000"""
from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routes import documents, chat

app = FastAPI(title="RagProject API")

# Next.js dev server origin. Add your deployed frontend origin too
# once you have one -- CORS origins are not wildcard-able alongside
# credentials, so list them explicitly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Figures written by ingestion/extract_figures.py to disk need a URL,
# not a filesystem path, for the frontend to render them.
app.mount("/figures", StaticFiles(directory="eval/fixtures/_extracted_figures"), name="figures")
# ^ point this at wherever your figure extraction actually writes to --
# confirm against ingestion/extract_figures.py's output_dir convention
# before wiring this in; it wasn't directly inspected as part of this
# plan.

app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])


@app.get("/health")
def health():
    return {"status": "ok"}
```

### Verify

```bash
uvicorn backend.main:app --reload --port 8000
curl http://localhost:8000/health
```
Must return `{"status": "ok"}`.

---

## 2. Session store

### What it replaces

`st.session_state.documents` currently holds, per browser tab:
`{doc_name: {"text_index": ..., "text_meta": ..., "image_index": ...,
"image_meta": ...}}`. A stateless REST API has no browser-tab
equivalent, so the frontend generates a `session_id` (UUID) once per
browser session and sends it on every request; the backend keys an
in-memory dict by that ID.

### `backend/session_store.py`

```python
"""Server-side replacement for st.session_state. In-memory only --
restarting the backend process loses all sessions, same tradeoff
Streamlit already had (a page refresh also lost everything there).
Move to Redis only if you need persistence across backend restarts;
not needed for a single-instance dev/demo deployment.
"""
from __future__ import annotations
import threading

_lock = threading.Lock()
_sessions: dict[str, dict[str, dict]] = {}


def get_session(session_id: str) -> dict[str, dict]:
    """Returns the documents dict for a session, creating it if new."""
    with _lock:
        return _sessions.setdefault(session_id, {})


def add_document(session_id: str, doc_name: str, doc_data: dict) -> None:
    with _lock:
        _sessions.setdefault(session_id, {})[doc_name] = doc_data


def remove_document(session_id: str, doc_name: str) -> bool:
    with _lock:
        docs = _sessions.get(session_id, {})
        if doc_name in docs:
            del docs[doc_name]
            return True
        return False


def list_documents(session_id: str) -> list[str]:
    with _lock:
        return list(_sessions.get(session_id, {}).keys())
```

The `threading.Lock` matters: `uvicorn --reload` and multiple concurrent
requests from the same browser (e.g. two tabs racing an upload) can hit
this dict from different threads. Cheap insurance, not a bottleneck at
this scale.

### Verify

Import it in a throwaway script, add/list/remove a fake doc, confirm
the dict behaves as expected across calls.

---

## 3. Pydantic schemas

### `backend/schemas.py`

```python
from __future__ import annotations
from pydantic import BaseModel


class UploadResponse(BaseModel):
    doc_name: str
    chunk_count: int
    figure_count: int
    has_text: bool  # False signals a scanned/image-only PDF, per
                     # extract_text_from_pdf's documented [] return


class DocumentListResponse(BaseModel):
    session_id: str
    documents: list[str]


class AskRequest(BaseModel):
    session_id: str
    query: str
    selected_docs: list[str]


class DebugChunk(BaseModel):
    doc_name: str
    page_number: int | None
    modality: str
    score: float
    final_score: float | None = None
    pinned: bool = False
    text_preview: str | None = None


class AskResponse(BaseModel):
    answer: str
    figure_urls: list[str]
    guarded: bool
    error: str | None
    routed_docs: list[str]      # which docs the router actually kept
    debug_chunks: list[DebugChunk]
```

`routed_docs` and `debug_chunks` exist specifically so the frontend's
debug panel can show what the Streamlit app's debug expander already
showed — which documents the router excluded, and what actually got
retrieved with what scores. Don't drop this in the rewrite; it's
useful for demoing the agentic router's behavior, and you already
built the router to be inspectable.

---

## 4. Document upload endpoint

### `backend/routes/documents.py`

```python
"""Upload endpoint: wraps ingestion + indexing, unchanged from what
app/streamlit_app.py already calls -- just behind an HTTP route
instead of a Streamlit widget callback.
"""
from __future__ import annotations
import os
import tempfile

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from ingestion.extract_text import extract_text_from_pdf
from ingestion.extract_figures import extract_figures_from_pdf
from ingestion.associate import associate_captions
from indexing.embed_text import embed_and_index_text
from indexing.embed_images import embed_and_index_images

from backend.session_store import add_document, remove_document, list_documents
from backend.schemas import UploadResponse, DocumentListResponse

router = APIRouter()

FIGURES_ROOT = os.path.join(os.getcwd(), "backend", "_uploaded_figures")


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    session_id: str = Form(...),
    file: UploadFile = File(...),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported.")

    # Ingestion/extract_text_from_pdf takes a filesystem path, so the
    # uploaded bytes need to land on disk first -- a NamedTemporaryFile
    # is deleted automatically once ingestion is done reading it.
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        doc_figures_dir = os.path.join(FIGURES_ROOT, session_id, file.filename)
        os.makedirs(doc_figures_dir, exist_ok=True)

        chunks = extract_text_from_pdf(tmp_path)
        figures = extract_figures_from_pdf(tmp_path, doc_figures_dir)
        figures = associate_captions(chunks, figures)

        text_index, text_meta = embed_and_index_text(chunks) if chunks else (None, [])
        image_index, image_meta = embed_and_index_images(figures) if figures else (None, [])

        for item in text_meta:
            item.setdefault("doc_name", file.filename)
        for item in image_meta:
            item.setdefault("doc_name", file.filename)

        add_document(session_id, file.filename, {
            "text_index": text_index,
            "text_meta": text_meta,
            "image_index": image_index,
            "image_meta": image_meta,
        })

        return UploadResponse(
            doc_name=file.filename,
            chunk_count=len(chunks),
            figure_count=len(figures),
            has_text=len(chunks) > 0,
        )
    finally:
        os.unlink(tmp_path)


@router.get("", response_model=DocumentListResponse)
def get_documents(session_id: str):
    return DocumentListResponse(session_id=session_id, documents=list_documents(session_id))


@router.delete("/{doc_name}")
def delete_document(doc_name: str, session_id: str):
    removed = remove_document(session_id, doc_name)
    if not removed:
        raise HTTPException(404, f"{doc_name} not found in this session.")
    return {"removed": doc_name}
```

**Confirm before wiring in:** the exact keyword args
`extract_text_from_pdf`/`extract_figures_from_pdf`/`associate_captions`
expect for `doc_name` tagging — the snippet above assumes text/image
`meta` dicts need a `doc_name` key added by the caller (matching how
`search_multi_doc` reads `doc.get("text_meta")`/`item.get("doc_name")`
elsewhere), but confirm this against your actual `indexing/embed_text.py`
output before trusting it blindly, since that file wasn't directly
inspected as part of this plan.

### Verify

```bash
curl -F "session_id=test123" -F "file=@some.pdf" http://localhost:8000/documents/upload
curl "http://localhost:8000/documents?session_id=test123"
```
Second call must list the just-uploaded filename.

---

## 5. Chat/ask endpoint — and where the two known bugs get fixed

### `backend/routes/chat.py`

```python
"""Ask endpoint: wraps the full retrieval + generation pipeline.
This is also where the pin-loss and one-figure-per-doc bugs (found via
manual testing against att.pdf/ebay.pdf) get fixed, since select_
generation_context and generate_answer are called from here.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException

from retrieval.router import route_documents
from retrieval.search import search_multi_doc
from retrieval.fuse import reciprocal_rank_fusion
from retrieval.rerank import rerank_and_merge, select_generation_context
from generation.answer import generate_answer

from backend.session_store import get_session
from backend.schemas import AskRequest, AskResponse, DebugChunk

router = APIRouter()

RETRIEVAL_TOP_K = 10
GENERATION_TOP_N = 5


@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    documents = get_session(req.session_id)
    if not documents:
        raise HTTPException(400, "No documents uploaded for this session yet.")

    missing = [d for d in req.selected_docs if d not in documents]
    if missing:
        raise HTTPException(400, f"Not found in this session: {missing}")

    routed_docs = route_documents(req.query, documents, req.selected_docs)

    final_text, final_image = search_multi_doc(
        req.query, documents, routed_docs, RETRIEVAL_TOP_K
    )
    fused = reciprocal_rank_fusion(final_text, final_image)
    reranked = rerank_and_merge(req.query, fused)

    generation_context = select_generation_context(
        reranked, routed_docs, GENERATION_TOP_N, min_per_doc=1
    )

    result = generate_answer(req.query, generation_context)

    figure_urls = [f"/figures/{req.session_id}/{p}" for p in result["figure_paths"]]

    debug_chunks = [
        DebugChunk(
            doc_name=item.get("doc_name", "?"),
            page_number=item.get("page_number"),
            modality=item["modality"],
            score=item.get("score", 0.0),
            final_score=item.get("final_score"),
            pinned=item.get("pinned", False),
            text_preview=(item.get("text", "")[:120] if item["modality"] == "text" else None),
        )
        for item in generation_context
    ]

    return AskResponse(
        answer=result["answer"],
        figure_urls=figure_urls,
        guarded=result["guarded"],
        error=result["error"],
        routed_docs=routed_docs,
        debug_chunks=debug_chunks,
    )
```

### Bug fix 1 — pin survives reranking

In `retrieval/rerank.py`, replace `select_generation_context`'s
guaranteed-slot loop:

```python
    guaranteed = []
    for doc_name in selected_doc_names:
        guaranteed.extend(text_by_doc.get(doc_name, [])[:min_per_doc])
```

with a pin-aware version, mirroring `search_multi_doc`'s own pattern:

```python
    guaranteed = []
    for doc_name in selected_doc_names:
        doc_items = text_by_doc.get(doc_name, [])
        pinned_items = [it for it in doc_items if it.get("pinned")][:1]
        scored_items = [it for it in doc_items if not it.get("pinned")]
        remaining = max(min_per_doc - len(pinned_items), 0)
        guaranteed.extend(pinned_items + scored_items[:remaining])
```

Nothing else in the function needs to change — `guaranteed_ids`,
`remainder`, and the final sort all just consume whatever `guaranteed`
contains.

### Bug fix 2 — more than one figure per document

In `generation/answer.py`, replace the `best_per_doc` collapsing block
inside `generate_answer`:

```python
    figure_paths = []
    if image_items:
        best_per_doc: dict[str, dict] = {}
        for item in image_items:
            doc = item.get("doc_name", "unknown")
            if doc not in best_per_doc or item.get("score", 0.0) > best_per_doc[doc].get("score", 0.0):
                best_per_doc[doc] = item
        for item in best_per_doc.values():
            if item.get("score", 0.0) >= IMAGE_RELEVANCE_MIN_SCORE:
                figure_paths.append(item["image_path"])
```

with a plain threshold filter, no per-doc cap:

```python
    figure_paths = []
    if image_items:
        for item in image_items:
            if item.get("score", 0.0) >= IMAGE_RELEVANCE_MIN_SCORE:
                figure_paths.append(item["image_path"])
```

### Verify

1. **Parity check against the old Streamlit app**: re-run the exact
   failing case from earlier (`att.pdf` + `ebay.pdf` selected, "who are
   the authors of the above paper?") through `POST /chat/ask` and
   confirm the author list now appears in `answer` and `debug_chunks`
   shows an item with `pinned: true` for `att.pdf`.
2. **Multi-figure case**: ask a question that should surface more than
   one diagram from the same document; confirm `figure_urls` contains
   more than one entry for that doc when applicable.
3. **Regression**: re-run the original crowding-out test
   (`ebay.pdf` + `Intuit(1).pdf` + `att.pdf`) through the new endpoint
   to confirm min_per_doc protection still holds end-to-end.
4. `curl` the endpoint directly before touching the frontend at all —
   isolates backend bugs from frontend bugs.

```bash
curl -X POST http://localhost:8000/chat/ask \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test123","query":"who are the authors?","selected_docs":["att.pdf"]}'
```

---

## 6. Frontend skeleton

```
frontend/
├── app/
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   ├── DocumentUploader.tsx
│   ├── DocumentChips.tsx
│   ├── ChatThread.tsx
│   ├── FigureGallery.tsx
│   └── DebugPanel.tsx
└── lib/
    ├── api.ts
    └── session.ts
```

### `lib/session.ts`

```typescript
// One session_id per browser session, persisted in memory only --
// matches the backend's in-memory session_store (both are lost on
// reload/restart, same tradeoff Streamlit already had).
let sessionId: string | null = null;

export function getSessionId(): string {
  if (!sessionId) sessionId = crypto.randomUUID();
  return sessionId;
}
```

### `lib/api.ts`

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function uploadDocument(sessionId: string, file: File) {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("file", file);
  const res = await fetch(`${API_BASE}/documents/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listDocuments(sessionId: string) {
  const res = await fetch(`${API_BASE}/documents?session_id=${sessionId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function askQuestion(sessionId: string, query: string, selectedDocs: string[]) {
  const res = await fetch(`${API_BASE}/chat/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, query, selected_docs: selectedDocs }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### Verify

Point the Next.js dev server (`npm run dev`, port 3000) at the FastAPI
backend (port 8000, already running from Section 1's verify step) and
confirm `npm run dev` boots with no CORS errors in the browser console
on a plain `fetch` from a throwaway button.

---

## 7. Frontend components

Build these in this order — each depends on the previous one working:

1. **`DocumentUploader.tsx`** — file input, calls `uploadDocument`,
   shows a loading state (ingestion + indexing takes 5-30s, same as the
   Streamlit app's spinner). On success, triggers a refetch of
   `listDocuments`.
2. **`DocumentChips.tsx`** — renders selectable/removable chips (your
   `att.pdf ×` / `ebay.pdf ×` pattern from the screenshots), holds
   `selectedDocs` state, passes it up to the page.
3. **`ChatThread.tsx`** — question input + message history, calls
   `askQuestion` on submit, renders `answer` per turn.
4. **`FigureGallery.tsx`** — renders `figure_urls` as `<img>` tags
   under the relevant chat turn. Since Bug 2 is now fixed, this needs
   to handle a list of N images per turn, not just one.
5. **`DebugPanel.tsx`** — collapsible per-turn panel rendering
   `debug_chunks` (doc name, page, score, `pinned` flag) and
   `routed_docs` — this is the direct equivalent of Streamlit's debug
   expander, and worth keeping since it's what let you diagnose both
   bugs in the first place.

### Verify

Full round trip: upload `att.pdf` + `ebay.pdf`, ask "who are the
authors of the above paper?", confirm the answer includes the author
list and the debug panel shows a `pinned: true` chunk for `att.pdf`.

---

## 8. Config & environment

- `backend/.env` (or reuse existing `.env`): `GROQ_API_KEY` unchanged
  from the Streamlit app.
- `frontend/.env.local`: `NEXT_PUBLIC_API_BASE=http://localhost:8000`
  (swap for the deployed backend URL later).
- Update `README.md`'s "Run the app" section once both halves work:
  two terminal commands (`uvicorn backend.main:app --reload` and
  `npm run dev --prefix frontend`) instead of one `streamlit run`.

---

## 9. Migration/parity testing

Before deleting or archiving `app/streamlit_app.py`:

1. Run the same 3-4 test questions (including both bug-triggering
   ones) through both the old Streamlit app and the new API, side by
   side, confirming identical (or better, post-fix) answers.
2. Re-run `python -m eval.run_eval` unchanged — it never went through
   Streamlit or the new backend, so it should be completely unaffected
   by this migration. If it breaks, something in `retrieval/rerank.py`
   or `generation/answer.py` was edited incorrectly during Section 5's
   bug fixes.
3. Only after both pass, remove `app/streamlit_app.py` (or keep it
   around read-only as a reference/fallback for a while — cheap
   insurance during the transition).

---

## 10. Explicitly out of scope for this plan

- **Auth / multi-user persistence** — the session store is in-memory
  and per-process; fine for a demo/portfolio deployment, not for
  production multi-tenant use. Redis-backed sessions would be the next
  step, not part of this plan.
- **Streaming responses** — `POST /chat/ask` returns a complete answer
  in one response, same as the Streamlit app did. Token-by-token
  streaming (SSE or websockets) is a real UX improvement but a
  separate piece of work.
- **Deployment/hosting config** (Docker, Vercel, etc.) — this plan
  covers getting both halves working locally; containerizing and
  deploying is a follow-up.
- **Redesigning the retrieval/generation pipeline itself** — out of
  scope here; this plan only relocates existing, already-tested logic
  behind new routes and fixes the two bugs already found.
