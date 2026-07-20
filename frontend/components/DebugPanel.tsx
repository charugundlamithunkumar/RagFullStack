"use client";

import { useState } from "react";
import type { DebugChunk } from "@/lib/types";
import { ChevronDown, ChevronUp, Layers, Pin, FileText, Image as ImageIcon } from "lucide-react";

interface DebugPanelProps {
  routedDocs: string[];
  debugChunks: DebugChunk[];
}

export default function DebugPanel({ routedDocs, debugChunks }: DebugPanelProps) {
  const [open, setOpen] = useState(false);

  if (!debugChunks || debugChunks.length === 0) return null;

  return (
    <div className="mt-3 border border-slate-200/70 rounded-xl bg-slate-50/70 overflow-hidden text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 transition cursor-pointer font-medium"
      >
        <span className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider text-indigo-600">
          <Layers className="h-3.5 w-3.5" />
          <span>Retrieval Grounding & Debug Inspector ({debugChunks.length} chunks)</span>
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          {open ? (
            <>
              <span>Hide Details</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              <span>Inspect RAG Details</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="p-3.5 space-y-3 border-t border-slate-200/60 bg-white">
          {routedDocs && routedDocs.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Router Kept Documents:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {routedDocs.map((doc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-2 py-0.5 text-[11px] font-semibold"
                  >
                    <FileText className="h-3 w-3" />
                    {doc}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
              Ranked & Fused Context Chunks:
            </span>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {debugChunks.map((chunk, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-[11px] leading-relaxed transition-all ${
                    chunk.pinned
                      ? "bg-amber-50/60 border-amber-300/80 text-amber-950"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {chunk.modality === "image" ? (
                        <ImageIcon className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      )}
                      <span className="truncate max-w-[180px] sm:max-w-xs">{chunk.doc_name}</span>
                      {chunk.page_number && (
                        <span className="text-slate-400 text-[10px] font-normal">
                          (p. {chunk.page_number})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {chunk.pinned && (
                        <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          <Pin className="h-2.5 w-2.5" /> Pinned
                        </span>
                      )}
                      <span className="font-mono text-[10px] bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                        Score: {chunk.score.toFixed(3)}
                      </span>
                    </div>
                  </div>
                  {chunk.text_preview && (
                    <p className="font-mono text-[10px] text-slate-600 bg-white/80 p-1.5 rounded border border-slate-200/50 mt-1 line-clamp-2">
                      "{chunk.text_preview}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
