import type { AskResponse, DocumentInfo, UploadResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function uploadDocument(sessionId: string, file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("file", file);
  const res = await fetch(`${API_BASE}/documents/upload`, { method: "POST", body: form });
  return handle<UploadResponse>(res);
}

export async function listDocuments(sessionId: string): Promise<DocumentInfo[]> {
  const res = await fetch(`${API_BASE}/documents?session_id=${encodeURIComponent(sessionId)}`);
  const data = await handle<{ session_id: string; documents: DocumentInfo[] }>(res);
  return data.documents;
}

export async function deleteDocument(sessionId: string, docName: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/documents/${encodeURIComponent(docName)}?session_id=${encodeURIComponent(sessionId)}`,
    { method: "DELETE" }
  );
  await handle<{ removed: string }>(res);
}

export async function askQuestion(
  sessionId: string,
  query: string,
  selectedDocs: string[]
): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/chat/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, query, selected_docs: selectedDocs }),
  });
  return handle<AskResponse>(res);
}

export function figureUrl(path: string): string {
  return `${API_BASE}${path}`;
}
