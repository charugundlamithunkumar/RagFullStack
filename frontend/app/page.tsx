"use client";

import { useEffect, useState } from "react";
import { deleteDocument, listDocuments } from "@/lib/api";
import { getSessionId } from "@/lib/session";
import type { DocumentInfo } from "@/lib/types";
import DocumentUploader from "@/components/DocumentUploader";
import DocumentChips from "@/components/DocumentChips";
import ChatThread from "@/components/ChatThread";

export default function Page() {
  const [sessionId, setSessionId] = useState<string>("");
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  async function refreshDocuments() {
    if (!sessionId) return;
    const docs = await listDocuments(sessionId);
    setDocuments(docs);
    setSelected(docs.map((d) => d.doc_name)); // default: all selected, like the Streamlit app
  }

  useEffect(() => {
    if (sessionId) refreshDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function toggleDoc(docName: string) {
    setSelected((sel) =>
      sel.includes(docName) ? sel.filter((d) => d !== docName) : [...sel, docName]
    );
  }

  async function handleRemove(docName: string) {
    await deleteDocument(sessionId, docName);
    await refreshDocuments();
  }

  return (
    <main>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">
        MM-RAG — Multimodal Document Q&A
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        Upload one or more PDFs. Ask questions across any of them. Answers are grounded in
        retrieved text and figures, fused and reranked before generation.
      </p>

      <DocumentUploader sessionId={sessionId} onUploaded={refreshDocuments} />

      {documents.length > 0 && (
        <div className="mt-8 space-y-6">
          <DocumentChips
            documents={documents}
            selected={selected}
            onToggle={toggleDoc}
            onRemove={handleRemove}
          />
          <ChatThread sessionId={sessionId} selectedDocs={selected} />
        </div>
      )}

      {documents.length === 0 && (
        <p className="text-gray-400 text-sm mt-8">Upload one or more PDFs to get started.</p>
      )}
    </main>
  );
}
