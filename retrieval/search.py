"""Query both the text and image FAISS indices for a given question."""
from __future__ import annotations
import faiss
from indexing.embed_text import embed_text_query
from indexing.embed_images import embed_image_query


def search_text(query: str, index: faiss.Index | None, meta: list[dict], top_k: int) -> list[dict]:
    """
    Search the text FAISS index. Returns a list of result dicts, each the
    original chunk metadata plus a "score" (cosine similarity, since the
    index holds L2-normalized vectors and uses inner product) and "rank"
    (1-indexed), ordered best-first.

    Returns [] cleanly if index is None (e.g. a figures-only PDF, or a
    document with zero extractable text).
    """
    if index is None or index.ntotal == 0:
        return []

    query_vec = embed_text_query(query)
    k = min(top_k, index.ntotal)
    scores, ids = index.search(query_vec, k)

    results = []
    for rank, (score, idx) in enumerate(zip(scores[0], ids[0]), start=1):
        if idx == -1:
            continue
        item = dict(meta[idx])
        item["score"] = float(score)
        item["rank"] = rank
        item["modality"] = "text"
        results.append(item)
    return results


def search_images(query: str, index: faiss.Index | None, meta: list[dict], top_k: int) -> list[dict]:
    """
    Search the image FAISS index using CLIP's text encoder on `query`.
    Same return contract as search_text. Returns [] cleanly if index is
    None -- a PDF with zero extractable figures is a normal, expected
    path (plan section 8c), not an error.
    """
    if index is None or index.ntotal == 0:
        return []

    query_vec = embed_image_query(query)
    k = min(top_k, index.ntotal)
    scores, ids = index.search(query_vec, k)

    results = []
    for rank, (score, idx) in enumerate(zip(scores[0], ids[0]), start=1):
        if idx == -1:
            continue
        item = dict(meta[idx])
        item["score"] = float(score)
        item["rank"] = rank
        item["modality"] = "image"
        results.append(item)
    return results

def pin_first_chunk(results: list[dict], meta: list[dict]) -> list[dict]:
    if not meta:
        return results
    first_chunk = meta[0]
    already_present = any(r.get("chunk_id") == first_chunk.get("chunk_id") for r in results)
    if already_present:
        return results
    pinned = dict(first_chunk)
    # No real embedding score exists for a forced-in pin. Use the
    # lowest score currently in results (or 0.0 if results is empty)
    # rather than None, so downstream code that sorts/compares scores
    # across documents (search_multi_doc) doesn't break. This score is
    # deliberately artificial and low -- search_multi_doc must NOT treat
    # it as a real competitive score when deciding guaranteed slots (see
    # that function's docstring for why a naive score-sort defeats the
    # pin entirely).
    pinned["score"] = min((r["score"] for r in results), default=0.0)
    pinned["rank"] = len(results) + 1
    pinned["modality"] = "text"
    pinned["pinned"] = True
    return results + [pinned]

def search_multi_doc(
    query: str,
    documents: dict[str, dict],
    selected_doc_names: list[str],
    top_k: int,
) -> tuple[list[dict], list[dict]]:
    """
    Run search_text/search_images independently against each selected
    document, then merge into two globally re-ranked lists.

    Cross-document score comparability isn't guaranteed -- one document's
    chunks can generically score higher than another's even when the
    query is explicitly about the lower-scoring document (e.g. a query
    that literally names the file). To prevent a dominant document from
    crowding a selected-but-quieter document out entirely, each selected
    document is guaranteed a minimum number of slots before the
    remainder is filled by global score.

    min_per_doc uses max(2, ...) rather than max(1, ...): with a single
    guaranteed slot, that slot would need to double as both the pin's
    guaranteed slot AND a real scored chunk, which isn't possible.
    max(2, ...) gives room for both: one slot for the pin (if present),
    one for a real scored chunk.

    Guaranteed-slot selection deliberately does NOT sort pinned and
    scored items together by score before taking the top min_per_doc.
    pin_first_chunk gives its forced-in chunk the lowest score in the
    document's own results on purpose (so sorting doesn't crash on a
    None) -- but that means a plain score-sort makes the pin lose the
    competition for its own document's guaranteed slots whenever the
    document has more than min_per_doc real chunks, which silently
    defeats the entire point of pinning it (confirmed live: an
    "authors of this paper" question against a paper whose author list
    only lives in chunk 1 came back "not found" because the pin never
    survived this cut). So the pin is carved out and guaranteed its own
    slot unconditionally, independent of its score, before the
    remaining min_per_doc-1 slots are filled by real score.
    """
    all_text, all_image = [], []
    per_doc_text: dict[str, list[dict]] = {}

    for doc_name in selected_doc_names:
        doc = documents.get(doc_name)
        if doc is None:
            continue
        t = search_text(query, doc["text_index"], doc["text_meta"], top_k)
        t = pin_first_chunk(t, doc["text_meta"])
        i = search_images(query, doc["image_index"], doc["image_meta"], top_k)
        per_doc_text[doc_name] = t
        all_text.extend(t)
        all_image.extend(i)

    n_docs = max(len(selected_doc_names), 1)
    # Reserve enough per-doc slots that a list-style question ("what
    # are the projects in these?") can pull more than one chunk per
    # document, not just enough to prove the document exists.
    min_per_doc = max(2, top_k // n_docs)

    guaranteed = []
    for doc_name, items in per_doc_text.items():
        pinned_items = [it for it in items if it.get("pinned")]
        scored_items = sorted(
            (it for it in items if not it.get("pinned")),
            key=lambda x: x["score"],
            reverse=True,
        )
        # Pin always gets a slot, independent of its (deliberately low)
        # score -- see docstring above.
        doc_guaranteed = pinned_items[:1]
        remaining = max(min_per_doc - len(doc_guaranteed), 0)
        doc_guaranteed += scored_items[:remaining]
        guaranteed.extend(doc_guaranteed)

    guaranteed_ids = {(g.get("doc_name"), g.get("chunk_id")) for g in guaranteed}
    remainder = [
        it for it in all_text
        if (it.get("doc_name"), it.get("chunk_id")) not in guaranteed_ids
    ]
    remainder.sort(key=lambda x: x["score"], reverse=True)

    final_text = guaranteed + remainder
    final_text = final_text[:top_k]
    for rank, item in enumerate(final_text, start=1):
        item["rank"] = rank

    all_image.sort(key=lambda x: x["score"], reverse=True)
    final_image = all_image[:top_k]
    for rank, item in enumerate(final_image, start=1):
        item["rank"] = rank

    return final_text, final_image