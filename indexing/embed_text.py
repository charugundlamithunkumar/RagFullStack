"""Embed text chunks with a sentence-transformer and build an in-memory
FAISS index. Nothing is written to disk -- the index and metadata are
meant to be held in st.session_state for the lifetime of one uploaded
document (see plan section 5's "importable function" requirement)."""
from __future__ import annotations
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# Change back to:
TEXT_MODEL_NAME = "all-MiniLM-L6-v2"
TEXT_EMBED_DIM = 384

_text_model_cache: dict[str, SentenceTransformer] = {}


def get_text_model() -> SentenceTransformer:
    """Cached loader so we don't reload the model on every call."""
    if TEXT_MODEL_NAME not in _text_model_cache:
        _text_model_cache[TEXT_MODEL_NAME] = SentenceTransformer(TEXT_MODEL_NAME)
    return _text_model_cache[TEXT_MODEL_NAME]


def embed_and_index_text(chunks: list[dict]) -> tuple[faiss.Index | None, list[dict]]:
    """
    Embed each chunk's text and build a FAISS IndexFlatIP over
    L2-normalized vectors (so inner product == cosine similarity).

    Returns (index, metadata_list). metadata_list[i] corresponds to the
    vector at row i of the index, and is the original chunk dict, so
    downstream code can go straight from a FAISS row id back to the
    chunk's text/page_number/chunk_id.

    Returns (None, []) if chunks is empty -- callers must handle this
    (e.g. a PDF with only figures and no body text, an edge case worth
    supporting cleanly rather than crashing on).
    """
    if not chunks:
        return None, []

    model = get_text_model()
    texts = [c["text"] for c in chunks]
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    embeddings = embeddings.astype("float32")
    faiss.normalize_L2(embeddings)

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    return index, chunks


def embed_text_query(query: str) -> np.ndarray:
    """Embed a single query string with the same model used for indexing,
    L2-normalized so it's directly comparable via inner product."""
    model = get_text_model()
    vec = model.encode([query], convert_to_numpy=True, show_progress_bar=False)
    vec = vec.astype("float32")
    faiss.normalize_L2(vec)
    return vec
