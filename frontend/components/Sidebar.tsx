"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  FileText,
  Trash2,
  Plus,
  Check,
  Sparkles,
  Bot,
  Database,
  Trash
} from "lucide-react";
import type { DocumentInfo } from "@/lib/types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentInfo[];
  selectedDocs: string[];
  onToggleDoc: (docName: string) => void;
  onDeleteDoc: (docName: string, e: React.MouseEvent) => void;
  onOpenUpload: () => void;
  onNewChat: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  documents,
  selectedDocs,
  onToggleDoc,
  onDeleteDoc,
  onOpenUpload,
  onNewChat,
}: SidebarProps) {
  if (!isOpen) return null;

  return (
    <motion.aside
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -280, opacity: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 32 }}
      className="w-72 bg-[#f9f9f8] border-r border-slate-200/80 flex flex-col h-full shrink-0 select-none text-slate-700 text-xs font-sans relative z-20"
    >
      {/* HEADER */}
      <div className="p-4 border-b border-slate-200/70 flex items-center justify-between bg-white/60">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900 tracking-tight block font-display">
              Multimodal RAG
            </span>
            <span className="text-[10px] text-slate-400 font-medium block">
              Knowledge Assistant
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          title="Close sidebar"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* GROUNDING PIPELINE BADGE */}
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/60 p-3.5 space-y-1 shadow-2xs">
          <div className="flex items-center space-x-1.5 text-sky-800 font-bold text-xs">
            <Sparkles className="h-4 w-4 text-sky-600 animate-pulse" />
            <span>RAG Vector Engine</span>
          </div>
          <p className="text-[11px] text-sky-900/80 leading-normal font-medium">
            Ingests PDFs, extracts text & figures, and fuses scores using RRF + Cross-Reranking.
          </p>
        </div>

        {/* WORKSPACE PDF DOCUMENTS LIST */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1">
              <Database className="h-3 w-3" /> Indexed PDFs ({documents.length})
            </span>
            <button
              onClick={onOpenUpload}
              className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add PDF</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {documents.length === 0 ? (
              <div
                onClick={onOpenUpload}
                className="p-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-sky-400 bg-white flex flex-col items-center justify-center text-center cursor-pointer transition"
              >
                <FileText className="h-6 w-6 text-slate-300 mb-1" />
                <span className="text-xs font-bold text-sky-600">
                  + Upload PDF Document
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  PDF text & figure extraction
                </span>
              </div>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedDocs.includes(doc.doc_name);
                return (
                  <div
                    key={doc.doc_name}
                    onClick={() => onToggleDoc(doc.doc_name)}
                    className={`group relative flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? "bg-white border-sky-400 text-slate-900 shadow-2xs"
                        : "bg-white/50 border-slate-200/80 hover:bg-white text-slate-600"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 pr-4">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-sky-600 border-sky-600 text-white"
                            : "border-slate-300 bg-white group-hover:border-slate-400"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <FileText className="h-4 w-4 text-sky-600 shrink-0" />
                      <span className="font-semibold text-xs truncate">
                        {doc.doc_name}
                      </span>
                    </div>

                    <button
                      onClick={(e) => onDeleteDoc(doc.doc_name, e)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="p-3 border-t border-slate-200/80 bg-white flex items-center justify-between">
        <button
          onClick={onNewChat}
          className="flex items-center space-x-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
        >
          <Trash className="h-3.5 w-3.5 text-slate-400" />
          <span>Clear Chat</span>
        </button>

        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold text-emerald-700">ONLINE</span>
        </div>
      </div>
    </motion.aside>
  );
}
