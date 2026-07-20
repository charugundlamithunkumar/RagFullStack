"""Generate a grounded answer via Groq, from retrieved text + figure
captions only (generation is text-only, per plan section 2 -- the LLM
never sees raw images; the retrieved figure is just displayed in the UI).
"""
from __future__ import annotations
import os
from groq import Groq

GROQ_MODEL = "openai/gpt-oss-120b"

# Default hallucination-guard threshold on the top item's final_score
# (post-rerank, min-max normalized to [0,1]).
#
# THIS IS A PLACEHOLDER until you run the calibration pass described in
# plan section 8f: run ~5 clearly-answerable + ~5 clearly-unanswerable
# questions against your fixed eval document, log the top final_score
# for each, and pick a value that sits between the two clusters. Record
# the chosen value and the reasoning in README.md -- "why this number"
# is a fair interview question. See eval/run_eval.py for a helper that
# logs these scores for you.
NOT_FOUND_SCORE_THRESHOLD = 0.35

NOT_FOUND_MESSAGE = (
    "I couldn't find anything in this document that answers that question."
)

SYSTEM_PROMPT = (
    "You are a document Q&A assistant. Answer the user's question using "
    "ONLY the provided context (text excerpts and figure captions). "
    "Do not use outside knowledge. If the context spans multiple "
    "documents, make clear which document each part of your answer "
    "comes from. If the context doesn't contain the answer, say so "
    "plainly instead of guessing. Cite document names and page numbers "
    "when helpful."
)


def _build_context_block(retrieved_items: list[dict]) -> str:
    parts = []
    for item in retrieved_items:
        page = item.get("page_number", "?")
        doc = item.get("doc_name", "the document")
        if item["modality"] == "text":
            parts.append(f"[Text, {doc}, page {page}]\n{item['text']}")
        else:
            caption = item.get("caption_text", "").strip()
            parts.append(
                f"[Figure, {doc}, page {page}]\n"
                f"Caption/nearby text: {caption if caption else '(none found)'}"
            )
    return "\n\n".join(parts)


def generate_answer(
    query: str,
    retrieved_items: list[dict],
    threshold: float = NOT_FOUND_SCORE_THRESHOLD,
) -> dict:
    """
    retrieved_items: the final merged+reranked list from
    retrieval/rerank.py (each item has "final_score").

    Returns:
        {
            "answer": str,
            "figure_paths": list[str],   # image_path of any retrieved figures
            "guarded": bool,             # True if we returned "not found"
                                          # without calling the LLM at all
            "error": str | None,         # set if the Groq call failed
        }
    """
    if not retrieved_items:
        return {
            "answer": NOT_FOUND_MESSAGE,
            "figure_paths": [],
            "guarded": True,
            "error": None,
        }

    top_score = retrieved_items[0].get("final_score", 0.0)
    if top_score < threshold:
        return {
            "answer": NOT_FOUND_MESSAGE,
            "figure_paths": [],
            "guarded": True,
            "error": None,
        }

    context_block = _build_context_block(retrieved_items)
    image_items = [item for item in retrieved_items if item["modality"] == "image"]

    # Use the RAW CLIP cosine similarity ("score"), not the min-max
    # normalized "final_score" -- with a small figure corpus, min-max
    # normalization always stamps one figure as a "perfect" 1.0 match
    # relative to the others, even when neither is actually relevant
    # to this specific question. Raw cosine similarity is bounded and
    # comparable across queries, so it's a meaningful absolute filter.
    IMAGE_RELEVANCE_MIN_SCORE = 0.25  # placeholder -- calibrate like the
                                       # text threshold, section 8f
    figure_paths = []
    if image_items:
        for item in image_items:
            if item.get("score", 0.0) >= IMAGE_RELEVANCE_MIN_SCORE:
                figure_paths.append(item["image_path"])

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {
            "answer": (
                "Generation is unavailable: GROQ_API_KEY is missing. "
                "Add it to your .env file (see .env.example)."
            ),
            "figure_paths": [],
            "guarded": False,
            "error": "missing_api_key",
        }

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Context:\n{context_block}\n\nQuestion: {query}",
                },
            ],
            temperature=0.2,
        )
        answer_text = completion.choices[0].message.content
    except Exception as e:
        return {
            "answer": "Generation failed, please try again.",
            "figure_paths": [],
            "guarded": False,
            "error": str(e),
        }

    NOT_FOUND_SIGNAL = "does not contain the answer"
    model_declined = NOT_FOUND_SIGNAL in answer_text.lower() or "not mentioned" in answer_text.lower()

    return {
        "answer": answer_text,
        "figure_paths": [] if model_declined else figure_paths,
        "guarded": False,
        "error": None,
    }
