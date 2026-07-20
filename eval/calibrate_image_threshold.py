"""Calibrate IMAGE_RELEVANCE_MIN_SCORE in generation/answer.py against
the fixed eval fixture. Run a few clearly figure-relevant and clearly
figure-irrelevant questions, log the top raw CLIP score for each, and
suggest a threshold sitting between the two clusters.

Usage: python -m eval.calibrate_image_threshold
"""
from __future__ import annotations
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ingestion.extract_text import extract_text_from_pdf
from ingestion.extract_figures import extract_figures_from_pdf
from ingestion.associate import associate_captions
from indexing.embed_text import embed_and_index_text
from indexing.embed_images import embed_and_index_images
from retrieval.search import search_images

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE_PDF = os.path.join(HERE, "fixtures", "reference_doc.pdf")
FIGURES_DIR = os.path.join(HERE, "fixtures", "_extracted_figures")

# Edit these to match your actual fixture doc's content.
RELEVANT_QUESTIONS = [
    "what does the pipeline diagram show?",
    "show me the architecture figure",
    "what does the bar chart illustrate?",
]
IRRELEVANT_QUESTIONS = [
    "who are the authors of this paper?",
    "what year was this published?",
    "what is the conclusion of the paper?",
]

def main():
    chunks = extract_text_from_pdf(FIXTURE_PDF)
    figures = extract_figures_from_pdf(FIXTURE_PDF, FIGURES_DIR)
    figures = associate_captions(chunks, figures)
    _, image_meta = embed_and_index_images(figures)
    image_index, image_meta = embed_and_index_images(figures)

    def top_score(q):
        results = search_images(q, image_index, image_meta, top_k=5)
        return results[0]["score"] if results else 0.0

    print("Relevant questions:")
    rel_scores = []
    for q in RELEVANT_QUESTIONS:
        s = top_score(q)
        rel_scores.append(s)
        print(f"  {s:.3f}  {q}")

    print("Irrelevant questions:")
    irr_scores = []
    for q in IRRELEVANT_QUESTIONS:
        s = top_score(q)
        irr_scores.append(s)
        print(f"  {s:.3f}  {q}")

    if rel_scores and irr_scores:
        suggested = (min(rel_scores) + max(irr_scores)) / 2
        print(f"\nSuggested IMAGE_RELEVANCE_MIN_SCORE: {suggested:.3f}")
        print("Update this constant in generation/answer.py.")

if __name__ == "__main__":
    main()