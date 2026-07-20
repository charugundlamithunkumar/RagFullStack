# MM-RAG — Multimodal RAG over live-uploaded PDFs

Upload a PDF, ask questions about it, get an answer grounded in **both**
the document's text and its figures — retrieved, fused, and reranked
before generation. Most document-Q&A tools (ChatGPT file upload,
NotebookLM-style tools) only retrieve text; lecture slides and papers
carry real information in diagrams too, and this system retrieves that
modality as well.

## Setup

```bash
python -m venv venv
source venv/bin/activate        # or venv\Scripts\activate on Windows
pip install -r requirements.txt

cp .env.example .env
# edit .env and add your own GROQ_API_KEY (free key at console.groq.com)
```

## Run the app

The app is a FastAPI backend + Next.js frontend, run as two processes.
The original `app/streamlit_app.py` still works standalone (same
pipeline modules, nothing shared with the web app below) and is kept
around as a reference/fallback during the transition.

**Backend** (from the repo root):
```bash
pip install -r requirements.txt -r backend/requirements-web.txt
cp .env.example .env   # add your GROQ_API_KEY
uvicorn backend.main:app --reload --port 8000
```

**Frontend** (in a second terminal):
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`, upload a PDF, wait for indexing (5-30s
depending on size), then ask questions. A collapsible debug panel
under each answer shows exactly which chunks/figures were retrieved,
their scores, and which documents the query router excluded.

**Streamlit (legacy, still functional):**
```bash
streamlit run app/streamlit_app.py
```

## Run the eval

```bash
python -m eval.generate_fixture   # builds a fixed reference PDF with
                                   # real embedded raster figures
python -m eval.run_eval           # runs retrieval-only eval across
                                   # 4 configs, writes eval/results.md
```

Eval intentionally runs against a **fixed** reference document, not
whatever a live demo user happens to upload — otherwise the ablation
table wouldn't be reproducible. `eval/questions.jsonl` has 15 hand-written
questions per tag (`text_only`, `figure_required`); expand this set if
you swap in your own reference document.

## Project structure

```
mm-rag/
├── ingestion/     PDF -> text chunks + embedded figure images
├── indexing/      text/image embeddings -> in-memory FAISS indices
├── retrieval/     search, RRF fusion, cross-encoder reranking
├── generation/    Groq call, grounded on retrieved context only
├── eval/          fixed reference doc, questions, ablation runner
├── app/           legacy Streamlit UI (still functional, unused by the web app)
├── backend/       FastAPI: session store + routes wrapping the pipeline above
└── frontend/      Next.js UI, talks to backend/ over HTTP
```

Every ingestion/indexing function is a plain importable function (not a
`__main__`-only script reading a fixed folder) — the whole point is
calling them on demand when a user uploads a file. Pipeline results are
kept in memory only: `st.session_state` in the Streamlit app, or
`backend/session_store.py`'s in-memory dict (keyed by a per-browser-
session UUID) in the FastAPI + Next.js app — never written to a
persistent `data/` folder either way.

## Design decisions (interview prep)

**Why CLIP for images instead of caption-then-embed?**
Captioning a figure with a vision-language model and then embedding the
caption text throws away everything in the image that the captioner
didn't think to mention — chart shapes, layout, spatial relationships.
CLIP embeds the pixels directly into a space it shares with text
embeddings, so a query like "show me the architecture diagram" can match
an image's actual visual content, not a lossy text proxy for it. The
cost is that CLIP doesn't "understand" the figure the way an LLM does —
we compensate by still surfacing the figure's nearby caption text at
generation time, so the LLM gets whatever textual grounding exists
without needing a captioning step in the critical path.

**Why Reciprocal Rank Fusion over a learned fusion weight?**
CLIP cosine similarity and sentence-transformer cosine similarity live
on different, incomparable scales — there's no principled way to say
"a text score of 0.62 equals an image score of 0.71." A learned weight
would need training data (pairs of queries with known correct
modality/ranking) that this project doesn't have, and would risk
overfitting to one document's score distribution. RRF sidesteps the
whole problem by working on rank position instead of raw score, with one
well-established default constant (k=60) and no training required — the
right tradeoff for a system that indexes a fresh, unseen document on
every upload.

**Why does cross-encoder reranking only apply to text?**
Cross-encoders score a (query, document) pair jointly by feeding both
through the same transformer, which is what makes them more precise
than bi-encoder cosine similarity. That requires a model trained on
(text, text) pairs. No comparably mature, off-the-shelf cross-encoder
exists for (text query, image) pairs at this project's scope — building
or fine-tuning one would violate the "no training" scope decision. So
images keep their CLIP similarity score, and the merge step (not
concatenation — see `retrieval/rerank.py`) min-max normalizes both score
sets to [0,1] independently before sorting the combined pool together,
so images can still legitimately outrank text when they're the better
match.

**What could be improved with more time?**
- Vision-capable generation: send the actual figure image to the LLM
  instead of just its caption text, so the model can reason about what's
  visually in the figure, not just what a nearby text mention says.
- A learned fusion weight (or a small held-out validation set) instead
  of RRF's fixed rank-based scheme, once there's enough labeled query
  data to justify it.
- Handling vector-drawn diagrams: PyMuPDF's `get_images()` only finds
  embedded raster images, so diagrams drawn as vector shapes directly on
  the PDF canvas are invisible to this pipeline. A page-region-render
  fallback (rasterizing detected vector-drawing regions only, not whole
  pages) could recover these without falling back to indexing entire
  text pages as "figures."
- OCR for scanned/image-only PDFs, currently out of scope and surfaced
  to the user as a named limitation instead.

## Known limitations (by design, not oversights)

- No chat history is persisted — each question is answered independently
  within the session.
- No model training or fine-tuning anywhere — every model is pretrained
  and used off the shelf.
- Generation never sees raw images, only retrieved text + figure
  captions — the figure itself is just displayed in the UI.
- Vector-drawn PDF diagrams are not extracted as figures (see above).
- The "not found in document" guard threshold (`NOT_FOUND_SCORE_THRESHOLD`
  in `generation/answer.py`) is currently a placeholder — calibrate it
  by running ~5 clearly-answerable and ~5 clearly-unanswerable questions
  against the fixed eval document, logging the top `final_score` for
  each, and picking a value between the two clusters.
