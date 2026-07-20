"""Generate a grounded answer via Groq API, Local Ollama LLM (http://localhost:11434),
or Local Grounded Structured Synthesizer fallback.
"""
from __future__ import annotations
import os
import json
import urllib.request
import urllib.error
from groq import Groq

GROQ_MODEL = "openai/gpt-oss-120b"
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/chat")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")

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


def _format_local_structured_answer(query: str, retrieved_items: list[dict]) -> str:
    """Fallback local response generator when offline or without API key.
    Creates a clean, formal markdown response grounded directly in retrieved text/figures.
    """
    lines = [f"### Summary & Grounded Context for: *{query}*", ""]

    doc_groups: dict[str, list[dict]] = {}
    for item in retrieved_items:
        dname = item.get("doc_name", "Document")
        doc_groups.setdefault(dname, []).append(item)

    for doc_name, items in doc_groups.items():
        lines.append(f"#### Document: **{doc_name}**")
        for idx, item in enumerate(items, 1):
            page = item.get("page_number", "?")
            if item["modality"] == "text":
                snippet = item.get("text", "").strip()
                lines.append(f"- **Key Excerpt (Page {page})**: {snippet}")
            else:
                caption = item.get("caption", item.get("caption_text", "")).strip()
                lines.append(f"- **Diagram/Figure (Page {page})**: {caption if caption else 'Visual figure match'}")
        lines.append("")

    lines.append("> **Note**: This response was synthesized locally directly from your uploaded document context.")
    return "\n".join(lines)


def generate_answer(
    query: str,
    retrieved_items: list[dict],
    threshold: float = NOT_FOUND_SCORE_THRESHOLD,
) -> dict:
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

    IMAGE_RELEVANCE_MIN_SCORE = 0.25
    figure_paths = []
    if image_items:
        for item in image_items:
            if item.get("score", 0.0) >= IMAGE_RELEVANCE_MIN_SCORE:
                figure_paths.append(item["image_path"])

    api_key = os.environ.get("GROQ_API_KEY")

    # 1. TRY GROQ API IF KEY IS SET
    if api_key:
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
            return {
                "answer": answer_text,
                "figure_paths": figure_paths,
                "guarded": False,
                "error": None,
            }
        except Exception as e:
            print(f"Groq generation failed, attempting local options: {e}")

    # 2. TRY LOCAL OLLAMA LLM (http://localhost:11434)
    try:
        payload = json.dumps({
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Context:\n{context_block}\n\nQuestion: {query}"},
            ],
            "stream": False,
        }).encode("utf-8")
        req = urllib.request.Request(
            OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            answer_text = data.get("message", {}).get("content", "")
            if answer_text:
                return {
                    "answer": answer_text,
                    "figure_paths": figure_paths,
                    "guarded": False,
                    "error": None,
                }
    except Exception:
        pass

    # 3. LOCAL STRUCTURED SYNTHESIZER (100% Offline / Local Fallback)
    answer_text = _format_local_structured_answer(query, retrieved_items)
    return {
        "answer": answer_text,
        "figure_paths": figure_paths,
        "guarded": False,
        "error": None,
    }
