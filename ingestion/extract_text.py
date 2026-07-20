"""Extract text chunks from a PDF, page-aware, ~200-300 words per chunk."""
from __future__ import annotations
import re
import pdfplumber


def _clean_page_text(text: str) -> str:
    """
    Cleanup pass before chunking. De-hyphenates words split across a
    line break and collapses irregular whitespace/newlines pdfplumber
    leaves in place. Both distort word counts and embedding input
    without adding information -- e.g. "docu-\\nment" naively becomes
    two junk tokens ("docu-", "ment") instead of one real word.
    """
    text = re.sub(r"-\n(\w)", r"\1", text)   # de-hyphenate across line breaks
    text = re.sub(r"\s+", " ", text)          # collapse all whitespace/newlines
    return text.strip()


def extract_text_from_pdf(
    pdf_path: str,
    words_per_chunk: int = 250,
    overlap_words: int = 40,
    max_pages: int = 100,
) -> list[dict]:
    """
    Extract text from a PDF and split it into word-count-bounded chunks,
    with a small word-overlap carried between consecutive chunks WITHIN
    a page. Overlap is NOT carried across page boundaries -- a
    page-boundary flush always resets cleanly, because the existing
    page-boundary-flush logic exists specifically to keep page_number
    attribution correct for downstream figure/caption association
    (ingestion/associate.py groups chunks by page_number). Carrying
    overlap across a page boundary would put words attributed to the
    wrong page.

    Each chunk dict has:
        - "chunk_id": str, unique within this document
        - "text": str
        - "page_number": int (1-indexed, page the chunk STARTS on)

    Returns [] (not an error) if the PDF has no extractable text at all
    (e.g. a scanned document) -- callers should check for this and warn
    the user, see app/streamlit_app.py.
    """
    chunks: list[dict] = []
    buffer_words: list[str] = []
    buffer_start_page: int | None = None
    chunk_counter = 0

    def flush(carry_overlap: bool = False):
        nonlocal buffer_words, buffer_start_page, chunk_counter
        if not buffer_words:
            return
        chunk_counter += 1
        chunks.append(
            {
                "chunk_id": f"chunk_{chunk_counter}",
                "text": " ".join(buffer_words),
                "page_number": buffer_start_page,
            }
        )
        if carry_overlap and overlap_words > 0:
            buffer_words = buffer_words[-overlap_words:]
        else:
            buffer_words = []
            buffer_start_page = None

    with pdfplumber.open(pdf_path) as pdf:
        pages = pdf.pages[:max_pages]
        for page in pages:
            page_text = _clean_page_text(page.extract_text() or "")
            if not page_text.strip():
                continue
            words = page_text.split()

            # Flush at every page boundary, even if we haven't hit
            # words_per_chunk yet, and WITHOUT carrying overlap.
            # Without this, a short page's leftover words silently
            # merge into the next page's chunk and get mis-attributed
            # to the wrong page_number -- which breaks figure/caption
            # association (associate.py groups chunks by page_number)
            # and citation accuracy downstream.
            if buffer_words and buffer_start_page != page.page_number:
                flush(carry_overlap=False)

            if buffer_start_page is None:
                buffer_start_page = page.page_number

            for w in words:
                buffer_words.append(w)
                if len(buffer_words) >= words_per_chunk:
                    flush(carry_overlap=True)   # mid-page: carry overlap forward
                    buffer_start_page = page.page_number
    flush(carry_overlap=False)
    return chunks


def total_extracted_char_count(pdf_path: str, max_pages: int = 100) -> int:
    """
    Quick helper to detect scanned/image-only PDFs: sums extracted text
    length across the first `max_pages` pages without building chunks.
    """
    total = 0
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[:max_pages]:
            total += len((page.extract_text() or "").strip())
    return total