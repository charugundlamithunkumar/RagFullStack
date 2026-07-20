"""Agentic query router: decide which selected documents are actually
relevant to a query before running retrieval against all of them.

Motivation: search_multi_doc's min_per_doc reservation guarantees every
selected document gets at least min_per_doc slots in the final context,
regardless of relevance. That's the right tradeoff when 2-3 documents
are selected (silently dropping a relevant doc is worse than diluting
with a mildly-less-relevant chunk) but breaks down as doc count grows
-- with 5 selected docs and top_k=10, min_per_doc=2 guarantees ALL 10
slots before any score-based competition, injecting noise from
irrelevant docs on every query. This router narrows the candidate set
BEFORE search_multi_doc runs, so min_per_doc only reserves slots among
docs that are actually plausible matches for the query.
"""
from __future__ import annotations
import json
import os
from groq import Groq

ROUTER_MODEL = "openai/gpt-oss-120b"

ROUTER_SYSTEM_PROMPT = (
    "You are a routing component in a document Q&A system. Given a "
    "user question and a list of available documents (name + short "
    "preview of their first chunk), return ONLY a JSON array of the "
    "document names that could plausibly contain the answer. "
    "If the question is general or comparative and could involve any "
    "of them (e.g. 'compare these documents', 'what projects are "
    "listed in these'), include all of them. When in doubt, include "
    "the document rather than exclude it -- a false positive costs a "
    "wasted retrieval slot, a false negative silently drops a document "
    "the same way the crowding-out bug did. Return ONLY the JSON "
    "array, nothing else."
)


def route_documents(
    query: str,
    documents: dict[str, dict],
    selected_doc_names: list[str],
    preview_chars: int = 300,
) -> list[str]:
    """
    Returns the subset of selected_doc_names the router judges relevant
    to `query`. Falls back to returning ALL selected_doc_names --
    unfiltered -- on any failure (missing API key, malformed response,
    API error), so a router bug degrades to today's "search everything"
    behavior rather than silently dropping a document. This mirrors the
    same fail-open principle as min_per_doc: an unnecessary retrieval is
    cheap, a silently dropped document is the exact bug this project
    already spent a plan fixing once.
    """
    if len(selected_doc_names) <= 1:
        return selected_doc_names  # nothing to route

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return selected_doc_names

    previews = []
    for name in selected_doc_names:
        doc = documents.get(name)
        if not doc:
            continue
        first_chunk_text = ""
        if doc.get("text_meta"):
            first_chunk_text = doc["text_meta"][0].get("text", "")[:preview_chars]
        previews.append(f'- "{name}": {first_chunk_text}')

    user_prompt = (
        f"Question: {query}\n\nAvailable documents:\n" + "\n".join(previews)
    )

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=ROUTER_MODEL,
            messages=[
                {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
        )
        raw = completion.choices[0].message.content.strip()
        # Strip markdown code fences the model sometimes wraps JSON in.
        if raw.startswith("```"):
            raw = raw.strip("`")
            raw = raw.split("\n", 1)[-1] if "\n" in raw else raw
        routed = json.loads(raw)
        if not isinstance(routed, list) or not routed:
            return selected_doc_names
        # Only trust names that were actually selected -- never let the
        # router introduce a document the user didn't pick.
        routed = [d for d in routed if d in selected_doc_names]
        return routed if routed else selected_doc_names
    except Exception:
        return selected_doc_names