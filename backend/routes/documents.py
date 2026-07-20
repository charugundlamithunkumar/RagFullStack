"""Upload endpoint: wraps ingestion + indexing exactly as
app/streamlit_app.py's process_upload() already does -- same function
calls, same doc_name tagging convention -- just behind an HTTP route
instead of a Streamlit widget callback.
"""
from __future__ import annotations
import os
import tempfile
import uuid

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from ingestion.extract_text import extract_text_from_pdf, total_extracted_char_count
from ingestion.extract_figures import extract_figures_from_pdf
from ingestion.associate import associate_captions
from indexing.embed_text import embed_and_index_text
from indexing.embed_images import embed_and_index_images

from backend.session_store import add_document, remove_document, list_documents
from backend.schemas import UploadResponse, DocumentListResponse, DocumentInfo

router = APIRouter()

MAX_PAGES = 100
MIN_TEXT_CHARS_FOR_VALID_DOC = 200  # below this, treat as scanned/no-text

# Figures need to live somewhere the StaticFiles mount in main.py can
# serve from. Keyed by session_id/doc_name so two sessions uploading
# a same-named file never collide.
FIGURES_ROOT = os.path.join(os.getcwd(), "backend", "_figures")


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    session_id: str = Form(...),
    file: UploadFile = File(...),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported.")

    temp_dir = tempfile.mkdtemp(prefix=f"mmrag_{uuid.uuid4().hex[:8]}_")
    pdf_path = os.path.join(temp_dir, file.filename)
    with open(pdf_path, "wb") as f:
        f.write(await file.read())

    try:
        char_count = total_extracted_char_count(pdf_path, max_pages=MAX_PAGES)
        scanned_warning = char_count < MIN_TEXT_CHARS_FOR_VALID_DOC

        chunks = extract_text_from_pdf(pdf_path, max_pages=MAX_PAGES)

        figures_dir = os.path.join(FIGURES_ROOT, session_id, file.filename)
        figures = extract_figures_from_pdf(pdf_path, figures_dir, max_pages=MAX_PAGES)
        figures = associate_captions(chunks, figures)

        # Tag every chunk/figure with its source document -- same
        # convention streamlit_app.py uses, so downstream retrieval,
        # citations, and the debug view can tell doc A's page 1 apart
        # from doc B's page 1.
        for c in chunks:
            c["doc_name"] = file.filename
        for fig in figures:
            fig["doc_name"] = file.filename

        text_index, text_meta = embed_and_index_text(chunks)
        image_index, image_meta = embed_and_index_images(figures)

        add_document(session_id, file.filename, {
            "text_index": text_index,
            "text_meta": text_meta,
            "image_index": image_index,
            "image_meta": image_meta,
            "scanned_warning": scanned_warning,
        })

        return UploadResponse(
            doc_name=file.filename,
            chunk_count=len(chunks),
            figure_count=len(figures),
            has_text=len(chunks) > 0,
        )
    finally:
        # Ingestion has already read everything it needs off disk by
        # this point (figures were copied into FIGURES_ROOT above), so
        # the raw upload's temp copy of the PDF itself can go.
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.get("", response_model=DocumentListResponse)
def get_documents(session_id: str):
    docs = [DocumentInfo(**d) for d in list_documents(session_id)]
    return DocumentListResponse(session_id=session_id, documents=docs)


@router.delete("/{doc_name}")
def delete_document(doc_name: str, session_id: str):
    removed = remove_document(session_id, doc_name)
    if not removed:
        raise HTTPException(404, f"{doc_name} not found in this session.")
    return {"removed": doc_name}
