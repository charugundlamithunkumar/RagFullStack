from __future__ import annotations
from pydantic import BaseModel


class UploadResponse(BaseModel):
    doc_name: str
    chunk_count: int
    figure_count: int
    has_text: bool  # False signals a scanned/low-text PDF


class DocumentInfo(BaseModel):
    doc_name: str
    scanned_warning: bool


class DocumentListResponse(BaseModel):
    session_id: str
    documents: list[DocumentInfo]


class AskRequest(BaseModel):
    session_id: str
    query: str
    selected_docs: list[str]


class DebugChunk(BaseModel):
    doc_name: str
    page_number: int | None = None
    modality: str
    score: float = 0.0
    final_score: float | None = None
    pinned: bool = False
    text_preview: str | None = None


class AskResponse(BaseModel):
    answer: str
    figure_urls: list[str]
    guarded: bool
    error: str | None
    routed_docs: list[str]
    selected_docs: list[str]
    debug_chunks: list[DebugChunk]
