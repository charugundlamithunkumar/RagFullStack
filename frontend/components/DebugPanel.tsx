"use client";

import { useState } from "react";
import type { AskResponse } from "@/lib/types";

export default function DebugPanel({ result }: { result: AskResponse }) {
  const [open, setOpen] = useState(false);
  const excluded = result.selected_docs.filter((d) => !result.routed_docs.includes(d));

  return (
    <div className="mt-3 border border-gray-200 rounded-lg">
      <button
        className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "▾" : "▸"} Debug: retrieved chunks/figures and scores
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {excluded.length > 0 && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 inline-block">
              Router excluded: {excluded.join(", ")}
            </p>
          )}
          {result.debug_chunks.map((item, i) => (
            <div key={i} className="text-xs text-gray-600 font-mono">
              [{item.modality}] <span className="font-semibold">{item.doc_name}</span> · page{" "}
              {item.page_number ?? "?"} · score={item.score.toFixed(3)}
              {item.final_score != null && ` · final=${item.final_score.toFixed(3)}`}
              {item.pinned && " · pinned"}
              {item.text_preview && <> · {item.text_preview}...</>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
