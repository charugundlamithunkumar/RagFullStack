"""Ask endpoint & persistent Thread/Message management routes using SQLite database.
"""
from __future__ import annotations
import os
import uuid
import datetime
from fastapi import APIRouter, HTTPException

from retrieval.router import route_documents
from retrieval.search import search_multi_doc
from retrieval.fuse import reciprocal_rank_fusion
from retrieval.rerank import rerank_and_merge, select_generation_context
from generation.answer import generate_answer

from backend.session_store import get_session
from backend.schemas import AskRequest, AskResponse, DebugChunk
from backend import database

router = APIRouter()

RETRIEVAL_TOP_K = 10
GENERATION_TOP_N = 5


@router.get("/threads")
def get_threads():
    return database.list_threads()


@router.post("/threads")
def create_new_thread(title: str = "New Chat"):
    thread_id = str(uuid.uuid4())
    return database.create_thread(thread_id, title)


@router.put("/threads/{thread_id}")
def rename_thread(thread_id: str, title: str):
    success = database.update_thread_title(thread_id, title)
    if not success:
        raise HTTPException(404, "Thread not found")
    return {"id": thread_id, "title": title}


@router.get("/threads/{thread_id}/messages")
def get_messages(thread_id: str):
    return database.get_thread_messages(thread_id)


@router.get("/threads/{thread_id}/docs")
def get_thread_documents(thread_id: str):
    return database.get_thread_docs(thread_id)


@router.delete("/threads/{thread_id}")
def delete_thread(thread_id: str):
    success = database.delete_thread(thread_id)
    if not success:
        raise HTTPException(404, "Thread not found")
    return {"deleted": thread_id}


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

    from backend.routes.documents import FIGURES_ROOT
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

    ask_res = AskResponse(
        answer=result["answer"],
        figure_urls=figure_urls,
        guarded=result["guarded"],
        error=result["error"],
        routed_docs=routed_docs,
        selected_docs=req.selected_docs,
        debug_chunks=debug_chunks,
    )

    # Save to SQLite Database
    timestamp = datetime.datetime.now().strftime("%I:%M %p")

    # Save user message
    user_msg_id = f"user-{uuid.uuid4().hex[:8]}"
    database.save_message(req.session_id, {
        "id": user_msg_id,
        "sender": "user",
        "text": req.query,
        "timestamp": timestamp,
    })

    # Save assistant response
    ai_msg_id = f"ai-{uuid.uuid4().hex[:8]}"
    database.save_message(req.session_id, {
        "id": ai_msg_id,
        "sender": "assistant",
        "text": ask_res.answer,
        "timestamp": timestamp,
        "response": ask_res.dict(),
    })

    # Save attached documents for this thread
    database.save_thread_docs(req.session_id, req.selected_docs)

    return ask_res
