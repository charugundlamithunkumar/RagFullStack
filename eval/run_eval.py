"""Run retrieval-only eval (not generation) against the fixed reference
document in eval/fixtures/, across 4 pipeline configurations, and write
eval/results.md with a real ablation table.

Configurations (plan section 8):
    1. text_only          -- search_text alone
    2. text_image_no_fusion -- search_text + search_images, budget SPLIT
                               fairly up front (not naive concat+truncate,
                               which would silently drop images -- see
                               retrieval/fuse.py::split_budget_no_fusion)
    3. rrf_fusion         -- reciprocal_rank_fusion(text, images)
    4. rrf_rerank         -- rerank_and_merge on top of RRF fusion

Relevance ground truth: an item is judged relevant if its page_number
matches the question's expected_page AND its modality matches
expected_modality (this is more robust than matching against volatile
chunk_id/figure_id, which depend on chunking/extraction order).

Usage:
    python -m eval.run_eval
(run from the project root, so `ingestion`/`indexing`/`retrieval` import
cleanly -- this mirrors the upload flow via a small script, per plan 8e,
rather than going through the Streamlit UI.)
"""
from __future__ import annotations
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ingestion.extract_text import extract_text_from_pdf
from ingestion.extract_figures import extract_figures_from_pdf
from ingestion.associate import associate_captions
from indexing.embed_text import embed_and_index_text
from indexing.embed_images import embed_and_index_images
from retrieval.search import search_text, search_images, pin_first_chunk
from retrieval.fuse import reciprocal_rank_fusion, split_budget_no_fusion
from retrieval.rerank import rerank_and_merge

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE_PDF = os.path.join(HERE, "fixtures", "reference_doc.pdf")
FIGURES_DIR = os.path.join(HERE, "fixtures", "_extracted_figures")
QUESTIONS_PATH = os.path.join(HERE, "questions.jsonl")
RESULTS_PATH = os.path.join(HERE, "results.md")

TOP_K = 10
K_FOR_METRICS = 5
CONFIGS = ["text_only", "text_image_no_fusion", "rrf_fusion", "rrf_rerank"]


def load_questions() -> list[dict]:
    questions = []
    with open(QUESTIONS_PATH) as f:
        for line in f:
            line = line.strip()
            if line:
                questions.append(json.loads(line))
    return questions


def is_relevant(item: dict, q: dict) -> bool:
    return item.get("page_number") == q["expected_page"] and item["modality"] == q["expected_modality"]


def recall_at_k(ranked_items: list[dict], q: dict, k: int) -> float:
    top = ranked_items[:k]
    return 1.0 if any(is_relevant(it, q) for it in top) else 0.0


def reciprocal_rank(ranked_items: list[dict], q: dict) -> float:
    for i, it in enumerate(ranked_items, start=1):
        if is_relevant(it, q):
            return 1.0 / i
    return 0.0


def run_config(config: str, question: str, text_index, text_meta, image_index, image_meta) -> list[dict]:
    text_results = search_text(question, text_index, text_meta, TOP_K)
    text_results = pin_first_chunk(text_results, text_meta)  # add this line
    image_results = search_images(question, image_index, image_meta, TOP_K)

    if config == "text_only":
        return text_results
    if config == "text_image_no_fusion":
        return split_budget_no_fusion(text_results, image_results, TOP_K)
    if config == "rrf_fusion":
        return reciprocal_rank_fusion(text_results, image_results)
    if config == "rrf_rerank":
        fused = reciprocal_rank_fusion(text_results, image_results)
        return rerank_and_merge(question, fused)
    raise ValueError(config)


def main():
    if not os.path.exists(FIXTURE_PDF):
        print(f"Fixture PDF not found at {FIXTURE_PDF}.")
        print("Run: python -m eval.generate_fixture")
        sys.exit(1)

    print("Ingesting + indexing fixture document...")
    chunks = extract_text_from_pdf(FIXTURE_PDF)
    figures = extract_figures_from_pdf(FIXTURE_PDF, FIGURES_DIR)
    figures = associate_captions(chunks, figures)
    text_index, text_meta = embed_and_index_text(chunks)
    image_index, image_meta = embed_and_index_images(figures)
    print(f"  {len(chunks)} text chunks, {len(figures)} figures indexed.")

    questions = load_questions()
    tags = sorted(set(q["tag"] for q in questions))

    # results[config][tag] -> {"recall": [...], "mrr": [...]}
    results: dict[str, dict[str, dict[str, list[float]]]] = {
        c: {t: {"recall": [], "mrr": []} for t in tags} for c in CONFIGS
    }

    for q in questions:
        for config in CONFIGS:
            ranked = run_config(config, q["question"], text_index, text_meta, image_index, image_meta)
            r = recall_at_k(ranked, q, K_FOR_METRICS)
            m = reciprocal_rank(ranked, q)
            results[config][q["tag"]]["recall"].append(r)
            results[config][q["tag"]]["mrr"].append(m)

    lines = []
    lines.append("# MM-RAG Retrieval Ablation Results\n")
    lines.append(f"Fixed reference document: `{os.path.relpath(FIXTURE_PDF)}`\n")
    tag_counts = {t: sum(1 for q in questions if q["tag"] == t) for t in tags}
    tag_counts_str = ", ".join(f"{t}: {c}" for t, c in tag_counts.items())
    lines.append(f"Questions: {len(questions)} total, {len(tags)} tags ({tag_counts_str})\n")
    lines.append(f"Metrics: Recall@{K_FOR_METRICS}, MRR\n")
    lines.append("")
    lines.append("| Config | Tag | Recall@5 | MRR | n |")
    lines.append("|---|---|---|---|---|")

    for config in CONFIGS:
        for tag in tags:
            recalls = results[config][tag]["recall"]
            mrrs = results[config][tag]["mrr"]
            n = len(recalls)
            avg_recall = sum(recalls) / n if n else 0.0
            avg_mrr = sum(mrrs) / n if n else 0.0
            lines.append(f"| {config} | {tag} | {avg_recall:.3f} | {avg_mrr:.3f} | {n} |")

    lines.append("")
    lines.append(
        "Note: n={} per tag meets the >=15/tag floor from the plan -- "
        "smaller eval sets produce clumpy, misleadingly clean scores "
        "(multiples of 1/n) that don't discriminate between "
        "configurations.".format(min(len(v["recall"]) for v in results[CONFIGS[0]].values()))
    )

    with open(RESULTS_PATH, "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"\nWrote {RESULTS_PATH}")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
