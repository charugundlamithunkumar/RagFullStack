"""Ask endpoint: wraps the full retrieval + generation pipeline, in the
exact same order app/streamlit_app.py already calls it in:
route_documents -> search_multi_doc -> reciprocal_rank_fusion ->
rerank_and_merge -> select_generation_context -> generate_answer.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException

from retrieval.router import route_documents
from retrieval.search import search_multi_doc
from retrieval.fuse import reciprocal_rank_fusion
from retrieval.rerank import rerank_and_merge, select_generation_context
from generation.answer import generate_answer

from backend.session_store import get_session
from backend.schemas import AskRequest, AskResponse, DebugChunk

router = APIRouter()

RETRIEVAL_TOP_K = 10
GENERATION_TOP_N = 5


@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    documents = get_session(req.session_id)
    if not documents:
        raise HTTPException(400, "No documents uploaded for this session yet.")

    missing = [d for d in req.selected_docs if d not in documents]
    if missing:
        raise HTTPException(400, f"Not found in this session: {missing}")

    if not req.selected_docs:
        raise HTTPException(400, "Select at least one document to search within.")

    routed_docs = route_documents(req.query, documents, req.selected_docs)

    final_text, final_image = search_multi_doc(
        req.query, documents, routed_docs, RETRIEVAL_TOP_K
    )
    fused = reciprocal_rank_fusion(final_text, final_image)
    reranked = rerank_and_merge(req.query, fused)

    generation_context = select_generation_context(
        reranked, routed_docs, GENERATION_TOP_N, min_per_doc=1
    )

    result = generate_answer(req.query, generation_context)

    # Figures are written to backend/_figures/<session_id>/<doc_name>/*.png
    # by routes/documents.py; main.py mounts that whole root at /figures,
    # so a saved image_path just needs its FIGURES_ROOT prefix swapped
    # for the URL prefix.
    from backend.routes.documents import FIGURES_ROOT
    import os
    figure_urls = [
        "/figures/" + os.path.relpath(p, FIGURES_ROOT).replace(os.sep, "/")
        for p in result["figure_paths"]
    ]

    debug_chunks = [
        DebugChunk(
            doc_name=item.get("doc_name", "?"),
            page_number=item.get("page_number"),
            modality=item["modality"],
            score=item.get("score", 0.0),
            final_score=item.get("final_score"),
            pinned=item.get("pinned", False),
            text_preview=(item.get("text", "")[:200] if item["modality"] == "text" else None),
        )
        for item in generation_context
    ]

    return AskResponse(
        answer=result["answer"],
        figure_urls=figure_urls,
        guarded=result["guarded"],
        error=result["error"],
        routed_docs=routed_docs,
        selected_docs=req.selected_docs,
        debug_chunks=debug_chunks,
    )
