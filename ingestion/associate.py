"""Associate extracted figures with nearby caption/body text.

For each figure, we look at text chunks on the same page. We prefer
chunks that explicitly mention "figure"/"fig."/"table" (likely to be
the caption or a direct reference to it), and fall back to any same-page
text if no such mention exists. This associated text is what the LLM
sees for that figure at generation time (generation is text-only, per
plan section 2 -- we never send raw images to the LLM).
"""
from __future__ import annotations
import re

CAPTION_PATTERN = re.compile(r"\b(figure|fig\.?|table)\b", re.IGNORECASE)


def associate_captions(chunks: list[dict], figures: list[dict]) -> list[dict]:
    """
    Mutates and returns `figures`, adding a "caption_text" field to each
    figure dict: text pulled from same-page chunks, priority given to
    chunks that mention "figure"/"fig."/"table".

    If a figure's page has no chunks at all (rare -- e.g. a page that's
    pure image with no extractable text), caption_text is set to "".
    """
    chunks_by_page: dict[int, list[dict]] = {}
    for c in chunks:
        chunks_by_page.setdefault(c["page_number"], []).append(c)

    for fig in figures:
        page = fig["page_number"]
        same_page_chunks = chunks_by_page.get(page, [])

        if not same_page_chunks:
            fig["caption_text"] = ""
            continue

        caption_hits = [
            c["text"] for c in same_page_chunks if CAPTION_PATTERN.search(c["text"])
        ]

        if caption_hits:
            fig["caption_text"] = " ".join(caption_hits)
        else:
            fig["caption_text"] = " ".join(c["text"] for c in same_page_chunks)

    return figures
