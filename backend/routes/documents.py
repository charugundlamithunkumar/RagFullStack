"""Upload endpoint: wraps ingestion + indexing for PDFs and Images (PNG, JPG, WEBP, etc.)
Supports uploading single or multiple files concurrently.
"""
from __future__ import annotations
import os
import shutil
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
MIN_TEXT_CHARS_FOR_VALID_DOC = 200

FIGURES_ROOT = os.path.join(os.getcwd(), "backend", "_figures")
ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tiff"}


def process_single_file(session_id: str, file: UploadFile) -> UploadResponse:
    filename = file.filename or "uploaded_file"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_IMAGE_EXTS and ext != ".pdf":
        raise HTTPException(
            400, f"Unsupported file type '{ext}'. Only PDF and image files (PNG, JPG, WEBP, etc.) are allowed."
        )

    # Make temp dir for raw file
    temp_dir = tempfile.mkdtemp(prefix=f"mmrag_{uuid.uuid4().hex[:8]}_")
    saved_path = os.path.join(temp_dir, filename)

    try:
        # Read file content once
        content = file.file.read()
        with open(saved_path, "wb") as f:
            f.write(content)

        if ext == ".pdf":
            char_count = total_extracted_char_count(saved_path, max_pages=MAX_PAGES)
            scanned_warning = char_count < MIN_TEXT_CHARS_FOR_VALID_DOC

            chunks = extract_text_from_pdf(saved_path, max_pages=MAX_PAGES)
            figures_dir = os.path.join(FIGURES_ROOT, session_id, filename)
            figures = extract_figures_from_pdf(saved_path, figures_dir, max_pages=MAX_PAGES)
            figures = associate_captions(chunks, figures)

            for c in chunks:
                c["doc_name"] = filename
            for fig in figures:
                fig["doc_name"] = filename

            text_index, text_meta = embed_and_index_text(chunks)
            image_index, image_meta = embed_and_index_images(figures)

            add_document(session_id, filename, {
                "text_index": text_index,
                "text_meta": text_meta,
                "image_index": image_index,
                "image_meta": image_meta,
                "scanned_warning": scanned_warning,
            })

            return UploadResponse(
                doc_name=filename,
                chunk_count=len(chunks),
                figure_count=len(figures),
                has_text=len(chunks) > 0,
            )
        else:
            # IMAGE FILE HANDLING (PNG, JPG, WEBP, etc.)
            figures_dir = os.path.join(FIGURES_ROOT, session_id, filename)
            os.makedirs(figures_dir, exist_ok=True)

            target_img_path = os.path.join(figures_dir, filename)
            shutil.copyfile(saved_path, target_img_path)

            # Create text chunk for description search
            text_chunk = {
                "text": f"Uploaded image document: {filename}. Visual content and diagrams.",
                "doc_name": filename,
                "page_number": 1,
                "modality": "text",
            }
            chunks = [text_chunk]

            # Create image figure metadata for CLIP vector search
            figure_item = {
                "image_path": target_img_path,
                "page_number": 1,
                "caption": f"Uploaded Image Document: {filename}",
                "doc_name": filename,
                "modality": "image",
            }
            figures = [figure_item]

            text_index, text_meta = embed_and_index_text(chunks)
            image_index, image_meta = embed_and_index_images(figures)

            add_document(session_id, filename, {
                "text_index": text_index,
                "text_meta": text_meta,
                "image_index": image_index,
                "image_meta": image_meta,
                "scanned_warning": False,
            })

            return UploadResponse(
                doc_name=filename,
                chunk_count=1,
                figure_count=1,
                has_text=True,
            )

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/upload", response_model=list[UploadResponse])
def upload_documents(
    session_id: str = Form(...),
    files: list[UploadFile] = File(...),
):
    if not files:
        raise HTTPException(400, "No files uploaded.")

    results: list[UploadResponse] = []
    for file in files:
        res = process_single_file(session_id, file)
        results.append(res)

    return results


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
