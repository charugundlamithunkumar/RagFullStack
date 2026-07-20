"""SQLite database module for persistent chat history, threads, and document attachments.
Stored in backend/rag_history.db
"""
from __future__ import annotations
import os
import json
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "rag_history.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS threads (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL,
                sender TEXT NOT NULL,
                text TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                response_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS thread_documents (
                thread_id TEXT NOT NULL,
                doc_name TEXT NOT NULL,
                PRIMARY KEY (thread_id, doc_name),
                FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
            )
        """)
        conn.commit()


# Initialize database on module load
init_db()


def list_threads() -> list[dict]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, created_at, updated_at FROM threads ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def create_thread(thread_id: str, title: str = "New Chat") -> dict:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO threads (id, title, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
            (thread_id, title),
        )
        conn.commit()
        return {"id": thread_id, "title": title}


def update_thread_title(thread_id: str, title: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE threads SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (title, thread_id),
        )
        conn.commit()
        return cursor.rowcount > 0


def get_thread_messages(thread_id: str) -> list[dict]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, sender, text, timestamp, response_json FROM messages WHERE thread_id = ? ORDER BY created_at ASC",
            (thread_id,),
        )
        rows = cursor.fetchall()
        results = []
        for r in rows:
            msg = {
                "id": r["id"],
                "sender": r["sender"],
                "text": r["text"],
                "timestamp": r["timestamp"],
            }
            if r["response_json"]:
                try:
                    msg["response"] = json.loads(r["response_json"])
                except Exception:
                    pass
            results.append(msg)
        return results


def save_message(thread_id: str, msg: dict) -> None:
    with get_db() as conn:
        cursor = conn.cursor()

        # Ensure thread exists
        cursor.execute("SELECT id, title FROM threads WHERE id = ?", (thread_id,))
        row = cursor.fetchone()
        if not row:
            # Auto-title based on first message
            title = msg["text"][:35] + ("..." if len(msg["text"]) > 35 else "")
            cursor.execute(
                "INSERT INTO threads (id, title, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                (thread_id, title),
            )
        else:
            # Update thread title if default or empty and user message
            if msg["sender"] == "user" and (row["title"] == "New Chat" or not row["title"]):
                new_title = msg["text"][:35] + ("..." if len(msg["text"]) > 35 else "")
                cursor.execute(
                    "UPDATE threads SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (new_title, thread_id),
                )
            else:
                cursor.execute("UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (thread_id,))

        resp_json = json.dumps(msg["response"]) if msg.get("response") else None
        cursor.execute(
            "INSERT OR REPLACE INTO messages (id, thread_id, sender, text, timestamp, response_json) VALUES (?, ?, ?, ?, ?, ?)",
            (
                msg["id"],
                thread_id,
                msg["sender"],
                msg["text"],
                msg["timestamp"],
                resp_json,
            ),
        )
        conn.commit()


def save_thread_docs(thread_id: str, doc_names: list[str]) -> None:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM thread_documents WHERE thread_id = ?", (thread_id,))
        for name in doc_names:
            cursor.execute(
                "INSERT OR IGNORE INTO thread_documents (thread_id, doc_name) VALUES (?, ?)",
                (thread_id, name),
            )
        conn.commit()


def get_thread_docs(thread_id: str) -> list[str]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT doc_name FROM thread_documents WHERE thread_id = ?", (thread_id,))
        return [row["doc_name"] for row in cursor.fetchall()]


def delete_thread(thread_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM threads WHERE id = ?", (thread_id,))
        conn.commit()
        return cursor.rowcount > 0
