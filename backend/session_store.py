"""Server-side document session store with automatic FAISS index disk persistence.
Saves document indices to backend/_indices/<session_id>/<doc_name>/ so reloading
previous chat threads or restarting the backend server preserves all indexed documents.
"""
from __future__ import annotations
import os
import pickle
import threading
import faiss

_lock = threading.Lock()
_sessions: dict[str, dict[str, dict]] = {}

INDICES_ROOT = os.path.join(os.getcwd(), "backend", "_indices")
os.makedirs(INDICES_ROOT, exist_ok=True)


def _save_doc_to_disk(session_id: str, doc_name: str, doc_data: dict) -> None:
    try:
        doc_dir = os.path.join(INDICES_ROOT, session_id, doc_name)
        os.makedirs(doc_dir, exist_ok=True)

        # Save text FAISS index if present
        if doc_data.get("text_index") is not None:
            faiss.write_index(doc_data["text_index"], os.path.join(doc_dir, "text.index"))
        
        # Save image FAISS index if present
        if doc_data.get("image_index") is not None:
            faiss.write_index(doc_data["image_index"], os.path.join(doc_dir, "image.index"))

        # Save metadata dict
        meta_to_save = {
            "text_meta": doc_data.get("text_meta", []),
            "image_meta": doc_data.get("image_meta", []),
            "scanned_warning": doc_data.get("scanned_warning", False),
        }
        with open(os.path.join(doc_dir, "meta.pkl"), "wb") as f:
            pickle.dump(meta_to_save, f)
    except Exception as e:
        print(f"Failed to persist index to disk for {doc_name}: {e}")


def _load_session_from_disk(session_id: str) -> dict[str, dict]:
    session_dir = os.path.join(INDICES_ROOT, session_id)
    if not os.path.exists(session_dir):
        return {}

    docs_dict: dict[str, dict] = {}
    try:
        for doc_name in os.listdir(session_dir):
            doc_dir = os.path.join(session_dir, doc_name)
            if not os.path.isdir(doc_dir):
                continue

            text_index_path = os.path.join(doc_dir, "text.index")
            image_index_path = os.path.join(doc_dir, "image.index")
            meta_path = os.path.join(doc_dir, "meta.pkl")

            text_index = faiss.read_index(text_index_path) if os.path.exists(text_index_path) else None
            image_index = faiss.read_index(image_index_path) if os.path.exists(image_index_path) else None

            meta = {}
            if os.path.exists(meta_path):
                with open(meta_path, "rb") as f:
                    meta = pickle.load(f)

            docs_dict[doc_name] = {
                "text_index": text_index,
                "text_meta": meta.get("text_meta", []),
                "image_index": image_index,
                "image_meta": meta.get("image_meta", []),
                "scanned_warning": meta.get("scanned_warning", False),
            }
    except Exception as e:
        print(f"Failed to reload indices from disk for session {session_id}: {e}")

    return docs_dict


def get_session(session_id: str) -> dict[str, dict]:
    """Returns the documents dict for a session, checking disk if not in memory."""
    with _lock:
        if session_id not in _sessions or not _sessions[session_id]:
            loaded = _load_session_from_disk(session_id)
            _sessions[session_id] = loaded
        return _sessions[session_id]


def add_document(session_id: str, doc_name: str, doc_data: dict) -> None:
    with _lock:
        _sessions.setdefault(session_id, {})[doc_name] = doc_data
        _save_doc_to_disk(session_id, doc_name, doc_data)


def remove_document(session_id: str, doc_name: str) -> bool:
    with _lock:
        docs = _sessions.get(session_id, {})
        if doc_name in docs:
            del docs[doc_name]

        doc_dir = os.path.join(INDICES_ROOT, session_id, doc_name)
        if os.path.exists(doc_dir):
            import shutil
            shutil.rmtree(doc_dir, ignore_errors=True)

        return True


def list_documents(session_id: str) -> list[dict]:
    """Returns [{doc_name, scanned_warning}, ...] for the sidebar/chips."""
    session_docs = get_session(session_id)
    return [
        {"doc_name": name, "scanned_warning": data.get("scanned_warning", False)}
        for name, data in session_docs.items()
    ]
