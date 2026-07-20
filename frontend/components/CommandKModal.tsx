"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, Sparkles, X, ArrowRight, CornerDownLeft } from "lucide-react";
import type { DocumentInfo } from "@/lib/types";

interface CommandKModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentInfo[];
  selectedDocs: string[];
  onToggleDoc: (docName: string) => void;
  onSelectQuery: (query: string) => void;
  onOpenUpload: () => void;
}

export default function CommandKModal({
  isOpen,
  onClose,
  documents,
  selectedDocs,
  onToggleDoc,
  onSelectQuery,
  onOpenUpload,
}: CommandKModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setSearchQuery("");
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredDocs = documents.filter((d) =>
    d.doc_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sampleQueries = [
    "What are the main findings across all documents?",
    "Summarize key metrics and financial performance.",
    "Explain all extracted diagrams and figures.",
    "Compare the selected documents side-by-side.",
  ].filter((q) => q.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/30 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200/90 text-slate-800"
        >
          {/* SEARCH INPUT BAR */}
          <div className="flex items-center px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <Search className="h-5 w-5 text-slate-400 mr-3 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents, ask AI, or jump to page... (ESC to exit)"
              className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400 font-sans"
            />
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* RESULTS CONTENT */}
          <div className="max-h-96 overflow-y-auto p-3 space-y-4">
            {/* Quick Actions */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1.5 font-mono">
                Suggested AI Actions
              </span>
              <div className="space-y-1">
                {sampleQueries.map((q, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      onSelectQuery(q);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50/60 text-xs text-slate-700 hover:text-indigo-900 transition cursor-pointer group"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span className="font-medium">{q}</span>
                    </div>
                    <CornerDownLeft className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-600 transition" />
                  </div>
                ))}
              </div>
            </div>

            {/* Document Filtering */}
            <div>
              <div className="flex items-center justify-between px-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Indexed Knowledge Documents ({filteredDocs.length})
                </span>
                <button
                  onClick={() => {
                    onOpenUpload();
                    onClose();
                  }}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                >
                  + Upload New PDF
                </button>
              </div>
              <div className="space-y-1">
                {filteredDocs.length === 0 ? (
                  <p className="text-xs text-slate-400 px-2 py-3 italic">
                    No documents found matching "{searchQuery}".
                  </p>
                ) : (
                  filteredDocs.map((doc) => {
                    const isSelected = selectedDocs.includes(doc.doc_name);
                    return (
                      <div
                        key={doc.doc_name}
                        onClick={() => onToggleDoc(doc.doc_name)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50/80 border-indigo-200 text-indigo-950 font-semibold"
                            : "bg-slate-50/50 border-slate-100 hover:bg-slate-100/80 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                          <span className="text-xs truncate">{doc.doc_name}</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                          {isSelected ? "Attached" : "Attach"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-[10px] text-slate-400">
            <span>Tip: Use <kbd className="font-mono bg-white px-1 rounded border border-slate-200">⌘K</kbd> to open anytime</span>
            <span>Notion AI Search Engine</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
