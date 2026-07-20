"""Cross-encoder reranking for text candidates, merged (not concatenated)
with CLIP-scored image candidates into one final ranked list.

Critical pitfall this file exists to avoid (plan section 7, pitfall 2):
doing `reranked_text_items + image_items` and calling it done silently
forces every image below every text result regardless of true relevance,
because it's just two lists stacked, not a genuine merge. Instead we
min-max normalize each modality's scores to [0, 1] independently, then
sort the combined pool together.
"""
from __future__ import annotations
from sentence_transformers import CrossEncoder

RERANKER_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"

_reranker_cache: dict[str, CrossEncoder] = {}


def get_reranker() -> CrossEncoder:
    if RERANKER_MODEL_NAME not in _reranker_cache:
        _reranker_cache[RERANKER_MODEL_NAME] = CrossEncoder(RERANKER_MODEL_NAME)
    return _reranker_cache[RERANKER_MODEL_NAME]


def _min_max_normalize(items: list[dict], score_key: str, out_key: str) -> None:
    """In-place: writes a [0,1]-normalized copy of score_key into out_key.

    A lone candidate (or a tied set) forced to 1.0 by ordinary min-max
    would falsely look like a "perfect" match relative to the other
    modality's genuinely-normalized set, and win ties purely by list
    order rather than merit. So a single-item list uses its raw score
    directly (clipped to [0,1]) instead -- consistent with how
    generation/answer.py already treats this exact edge case for the
    image-display guard.
    """
    if not items:
        return
    if len(items) == 1:
        val = items[0][score_key]
        items[0][out_key] = max(0.0, min(1.0, val))
        return
    values = [it[score_key] for it in items]
    lo, hi = min(values), max(values)
    spread = hi - lo
    for it in items:
        it[out_key] = 1.0 if spread == 0 else (it[score_key] - lo) / spread

def rerank_and_merge(
    query: str,
    fused_candidates: list[dict],
    rerank_top_k: int = 15,
) -> list[dict]:
    """
    fused_candidates: the RRF-fused, mixed-modality list (from fuse.py),
    already sorted best-first by rrf_score.

    We only cross-encoder-rerank the top `rerank_top_k` TEXT candidates
    from that list (cross-encoders are precise but slow, so we don't run
    them over the whole corpus -- and no off-the-shelf cross-encoder
    exists for text-image pairs at this scope, which is a named,
    documented limitation, not something to route around).

    Image candidates keep their original CLIP similarity score.

    Both score sets are then min-max normalized to [0, 1] independently
    and the pool is sorted TOGETHER by that normalized score -- this is
    the merge step, not a concatenation.

    Returns the final merged, sorted list with a "final_score" field.
    """
    text_candidates = [c for c in fused_candidates if c["modality"] == "text"]
    image_candidates = [c for c in fused_candidates if c["modality"] == "image"]

    text_to_rerank = text_candidates[:rerank_top_k]
    if text_to_rerank:
        reranker = get_reranker()
        pairs = [(query, item["text"]) for item in text_to_rerank]
        ce_scores = reranker.predict(pairs)
        for item, s in zip(text_to_rerank, ce_scores):
            item["rerank_score"] = float(s)

    for item in image_candidates:
        item["rerank_score"] = item.get("score", item.get("rrf_score", 0.0))

    _min_max_normalize(text_to_rerank, "rerank_score", "final_score")
    _min_max_normalize(image_candidates, "rerank_score", "final_score")

    merged = text_to_rerank + image_candidates
    merged.sort(key=lambda x: x["final_score"], reverse=True)
    return merged

def select_generation_context(
    reranked: list[dict],
    selected_doc_names: list[str],
    n: int,
    min_per_doc: int = 1,
) -> list[dict]:
    """
    Cut `reranked` down to the `n` items that actually get sent to the
    LLM (GENERATION_TOP_N), while preserving search_multi_doc's
    per-document guarantee.

    rerank_and_merge sorts the entire pool by cross-encoder score with
    no notion of "which document is this from." A plain reranked[:n]
    slice after that resort can zero out a selected document even
    when search_multi_doc protected it upstream -- this reapplies the
    guaranteed/remainder pattern at the boundary that decides what the
    LLM actually sees.
    """
    if len(reranked) <= n:
        return reranked

    text_by_doc: dict[str, list[dict]] = {}
    for item in reranked:
        if item["modality"] == "text":
            text_by_doc.setdefault(item.get("doc_name"), []).append(item)

    guaranteed = []
    for doc_name in selected_doc_names:
        doc_items = text_by_doc.get(doc_name, [])
        pinned_items = [it for it in doc_items if it.get("pinned")][:1]
        scored_items = [it for it in doc_items if not it.get("pinned")]
        remaining = max(min_per_doc - len(pinned_items), 0)
        guaranteed.extend(pinned_items + scored_items[:remaining])

    guaranteed_ids = {
        (g.get("doc_name"), g.get("chunk_id"), g.get("modality")) for g in guaranteed
    }
    remainder = [
        it for it in reranked
        if (it.get("doc_name"), it.get("chunk_id"), it.get("modality")) not in guaranteed_ids
    ]

    remaining_budget = max(0, n - len(guaranteed))
    final = guaranteed + remainder[:remaining_budget]
    final.sort(key=lambda x: x["final_score"], reverse=True)
    return final