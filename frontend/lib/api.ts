import type { AskResponse, DocumentInfo, UploadResponse, ChatMessage } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface ChatThread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export async function fetchThreads(): Promise<ChatThread[]> {
  const res = await fetch(`${API_BASE}/chat/threads`);
  return handle<ChatThread[]>(res);
}

export async function createThread(title: string = "New Chat"): Promise<ChatThread> {
  const res = await fetch(`${API_BASE}/chat/threads?title=${encodeURIComponent(title)}`, {
    method: "POST",
  });
  return handle<ChatThread>(res);
}

export async function fetchThreadMessages(threadId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/chat/threads/${encodeURIComponent(threadId)}/messages`);
  return handle<ChatMessage[]>(res);
}

export async function fetchThreadDocs(threadId: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/chat/threads/${encodeURIComponent(threadId)}/docs`);
  return handle<string[]>(res);
}

export async function deleteThreadApi(threadId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
  });
  await handle<{ deleted: string }>(res);
}

export async function uploadDocuments(sessionId: string, files: File[]): Promise<UploadResponse[]> {
  const form = new FormData();
  form.append("session_id", sessionId);
  for (const f of files) {
    form.append("files", f);
  }
  const res = await fetch(`${API_BASE}/documents/upload`, { method: "POST", body: form });
  return handle<UploadResponse[]>(res);
}

export async function uploadDocument(sessionId: string, file: File): Promise<UploadResponse> {
  const res = await uploadDocuments(sessionId, [file]);
  return res[0];
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
