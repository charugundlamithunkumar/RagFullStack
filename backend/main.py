"""FastAPI entrypoint.

Run from the repo root (so ingestion/indexing/retrieval/generation
import cleanly, same requirement eval/run_eval.py already has):

    uvicorn backend.main:app --reload --port 8000
"""
from __future__ import annotations
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from backend.routes import documents, chat

app = FastAPI(title="RagProject API")

FRONTEND_ORIGINS = [
    "http://localhost:3000",
    os.environ.get("FRONTEND_ORIGIN", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in FRONTEND_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(documents.FIGURES_ROOT, exist_ok=True)
app.mount("/figures", StaticFiles(directory=documents.FIGURES_ROOT), name="figures")

app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])


@app.get("/health")
def health():
    return {"status": "ok"}
