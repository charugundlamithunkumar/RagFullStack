"""Server-side replacement for Streamlit's st.session_state.documents.

In-memory only -- restarting the backend process loses all sessions,
the same tradeoff a Streamlit page refresh already had. Move to Redis
only if you need persistence across backend restarts; not needed for
a single-instance dev/demo deployment.
"""
from __future__ import annotations
import threading

_lock = threading.Lock()
_sessions: dict[str, dict[str, dict]] = {}


def get_session(session_id: str) -> dict[str, dict]:
    """Returns the documents dict for a session, creating it if new."""
    with _lock:
        return _sessions.setdefault(session_id, {})


def add_document(session_id: str, doc_name: str, doc_data: dict) -> None:
    with _lock:
        _sessions.setdefault(session_id, {})[doc_name] = doc_data


def remove_document(session_id: str, doc_name: str) -> bool:
    with _lock:
        docs = _sessions.get(session_id, {})
        if doc_name in docs:
            del docs[doc_name]
            return True
        return False


def list_documents(session_id: str) -> list[dict]:
    """Returns [{doc_name, scanned_warning}, ...] for the sidebar/chips."""
    with _lock:
        docs = _sessions.get(session_id, {})
        return [
            {"doc_name": name, "scanned_warning": data.get("scanned_warning", False)}
            for name, data in docs.items()
        ]
