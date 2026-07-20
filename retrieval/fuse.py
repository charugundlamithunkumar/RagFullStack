"""Reciprocal Rank Fusion (RRF) across the text and image ranked lists.

RRF is rank-based rather than raw-score-based, which sidesteps the
problem of CLIP cosine similarity and sentence-transformer cosine
similarity living on different scales -- they aren't directly comparable
as numbers, but rank position is."""
from __future__ import annotations

RRF_K = 60  # standard default


def _item_key(item: dict) -> str:
    """A stable identity for a result item, used to merge the same
    underlying chunk/figure if it somehow appears in both lists (it
    shouldn't in practice, since text and image indices hold disjoint
    item types, but this keeps the fusion logic correct regardless)."""
    if item["modality"] == "text":
        return f"text::{item['chunk_id']}"
    return f"image::{item['figure_id']}"


def reciprocal_rank_fusion(
    text_results: list[dict],
    image_results: list[dict],
    k: int = RRF_K,
) -> list[dict]:
    """
    Merge two ranked lists into one, scored by:
        score(doc) = sum over lists L containing doc of 1 / (k + rank_in_L)

    Returns a single list of item dicts (original metadata preserved,
    plus "rrf_score"), sorted best-first. Each item also keeps its
    original per-modality "score" and "rank" for debugging/display.
    """
    scores: dict[str, float] = {}
    items: dict[str, dict] = {}

    for result_list in (text_results, image_results):
        for item in result_list:
            key = _item_key(item)
            scores.setdefault(key, 0.0)
            scores[key] += 1.0 / (k + item["rank"])
            items[key] = item  # last write wins; fine since key implies same item

    fused = []
    for key, rrf_score in scores.items():
        item = dict(items[key])
        item["rrf_score"] = rrf_score
        fused.append(item)

    fused.sort(key=lambda x: x["rrf_score"], reverse=True)
    return fused


def split_budget_no_fusion(
    text_results: list[dict],
    image_results: list[dict],
    k: int,
) -> list[dict]:
    """
    Baseline for the ablation table's "text+image, no fusion" configuration.

    Pitfall to avoid (plan section 8, "no fusion" baseline): naively doing
    `search_text(top_k=k) + search_images(top_k=k)` and truncating to
    `[:k]` silently discards all image results whenever the text results
    alone already fill k. Instead, split the k budget evenly across
    modalities UP FRONT, so each gets a fair floor(k/2)/ceil(k/2) share
    regardless of how many results the other modality has.

    Within each modality's slice, order is preserved by original rank
    (i.e. NOT resorted by cross-modality score, since scores aren't
    comparable without fusion -- that's the whole point of this being
    the "no fusion" baseline).
    """
    half = k // 2
    other_half = k - half
    text_slice = text_results[:half]
    image_slice = image_results[:other_half]
    return text_slice + image_slice
