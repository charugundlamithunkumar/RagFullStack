"use client";

import { useState } from "react";
import { askQuestion } from "@/lib/api";
import type { QaTurn } from "@/lib/types";
import FigureGallery from "./FigureGallery";
import DebugPanel from "./DebugPanel";

export default function ChatThread({
  sessionId,
  selectedDocs,
}: {
  sessionId: string;
  selectedDocs: string[];
}) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QaTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleAsk() {
    if (!question.trim()) return;
    if (selectedDocs.length === 0) {
      setWarning("Select at least one document to search within.");
      return;
    }
    setWarning(null);
    setBusy(true);
    try {
      const result = await askQuestion(sessionId, question, selectedDocs);
      setHistory((h) => [{ question, result }, ...h]);
      setQuestion("");
    } catch (e) {
      setWarning(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          placeholder="Ask a question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          disabled={busy}
        />
        <button
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-accent hover:text-accent disabled:opacity-50"
          onClick={handleAsk}
          disabled={busy}
        >
          {busy ? "Thinking..." : "Ask"}
        </button>
      </div>
      {warning && <p className="text-sm text-red-700 mt-2">{warning}</p>}

      <div className="mt-6">
        {history.map((qa, i) => (
          <div key={i} className="qa-card">
            <div className="font-semibold text-gray-800 mb-2">Q: {qa.question}</div>
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {qa.result.answer}
            </div>
            {qa.result.error && (
              <div className="text-sm text-red-700 mt-2">Generation error: {qa.result.error}</div>
            )}
            <FigureGallery figureUrls={qa.result.figure_urls} />
            <DebugPanel result={qa.result} />
          </div>
        ))}
      </div>
    </div>
  );
}
