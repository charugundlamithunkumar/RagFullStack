"use client";

import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Paperclip,
  ArrowUp,
  Clock,
  FileText,
  X,
  Info,
} from "lucide-react";
import type { ChatMessage, DocumentInfo } from "@/lib/types";
import FigureGallery from "./FigureGallery";
import DebugPanel from "./DebugPanel";

interface AiChatProps {
  messages: ChatMessage[];
  isLoading: boolean;
  inputText: string;
  setInputText: (text: string) => void;
  onSendMessage: (e?: React.FormEvent) => void;
  selectedDocs: string[];
  documents: DocumentInfo[];
  onToggleDoc: (docName: string) => void;
  onOpenUpload: () => void;
}

export default function AiChat({
  messages,
  isLoading,
  inputText,
  setInputText,
  onSendMessage,
  selectedDocs,
  documents,
  onToggleDoc,
  onOpenUpload,
}: AiChatProps) {
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const renderFormattedMarkdown = (text: string) => {
    return text.split("\n\n").map((block, bIdx) => {
      const trimmed = block.trim();
      if (/^\d+\.\s/.test(trimmed)) {
        const lines = block.split("\n");
        return (
          <ol key={bIdx} className="list-decimal pl-5 space-y-1.5 my-2 text-slate-700">
            {lines.map((line, lIdx) => (
              <li key={lIdx} className="text-xs sm:text-sm leading-relaxed">
                {renderInlineFormatting(line.replace(/^\d+\.\s+/, ""))}
              </li>
            ))}
          </ol>
        );
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const lines = block.split("\n");
        return (
          <ul key={bIdx} className="list-disc pl-5 space-y-1.5 my-2 text-slate-700">
            {lines.map((line, lIdx) => (
              <li key={lIdx} className="text-xs sm:text-sm leading-relaxed">
                {renderInlineFormatting(line.replace(/^[-*]\s+/, ""))}
              </li>
            ))}
          </ul>
        );
      }
      return (
        <p key={bIdx} className="text-xs sm:text-sm leading-relaxed my-2">
          {renderInlineFormatting(block)}
        </p>
      );
    });
  };

  const renderInlineFormatting = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-bold text-indigo-600">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-sans relative">
      {/* SCROLLABLE CHAT CHRONICLE AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* AI CARDS PROMPT LANDING WHEN EMPTY */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 pt-4"
            >
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-display">
                  AI where your team works.
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                  Search across workspace PDF documents, synthesize knowledge, and extract visual figures instantly.
                </p>
              </div>

              {/* DUAL CARDS GRID FROM IMAGE 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CARD 1: CAPTURE KNOWLEDGE */}
                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-sky-50 border border-sky-200/80 rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between shadow-2xs group"
                >
                  <div className="space-y-1 mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 font-mono">
                      Capture knowledge
                    </span>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      Bring everything into one system of record.
                    </h3>
                  </div>

                  {/* MINI MEETING BOARD PREVIEW */}
                  <div className="bg-white rounded-2xl p-3 border border-sky-200/60 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span className="flex items-center gap-1">🎙️ Meetings</span>
                      <span className="text-[10px] text-slate-400 font-mono">4 notes</span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-slate-800 truncate">Technical Design Review</span>
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-bold">Infra</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg">
                        <span className="font-semibold text-slate-800 truncate">Engineering Standup</span>
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">Mobile</span>
                      </div>
                    </div>
                    {/* AUDIO PLAYER PILL */}
                    <div className="bg-slate-900 text-white rounded-full px-3 py-1.5 flex items-center justify-between text-[10px] shadow-sm">
                      <span className="font-medium truncate">Technical Design Review</span>
                      <span className="font-mono text-emerald-400">||||||||| ⏸ 🔴</span>
                    </div>
                  </div>
                </motion.div>

                {/* CARD 2: FIND ANSWERS */}
                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-rose-50 border border-rose-200/80 rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between shadow-2xs group"
                >
                  <div className="space-y-1 mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 font-mono">
                      Find answers
                    </span>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      Get answers, instantly—with citations.
                    </h3>
                  </div>

                  {/* DASHBOARD PREVIEW WITH FLOATING PROMPT PILL */}
                  <div className="bg-white rounded-2xl p-3 border border-rose-200/60 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span className="flex items-center gap-1">🏆 H2 Deal Flow Dashboard</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">Syncing</span>
                    </div>
                    <div className="h-16 bg-slate-50 rounded-xl flex items-end justify-around p-2 border border-slate-100">
                      <div className="w-3 bg-amber-400 h-8 rounded-t"></div>
                      <div className="w-3 bg-blue-500 h-12 rounded-t"></div>
                      <div className="w-3 bg-emerald-500 h-10 rounded-t"></div>
                      <div className="w-3 bg-rose-500 h-14 rounded-t"></div>
                    </div>
                    {/* FLOATING PROMPT PILL */}
                    <div
                      onClick={() => setInputText("What are our biggest opportunities in H2?")}
                      className="bg-white border border-slate-200 hover:border-indigo-400 rounded-full px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-700 shadow-2xs cursor-pointer transition"
                    >
                      <span className="truncate">What are our biggest opportunities in H2?</span>
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <ArrowUp className="h-3 w-3 stroke-[3]" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* MESSAGES CHRONICLE TURNS */}
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex flex-col ${
                  msg.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl p-4 shadow-2xs ${
                    msg.sender === "user"
                      ? "bg-slate-900 text-white rounded-tr-none border border-slate-950"
                      : "bg-white text-slate-800 rounded-tl-none border border-slate-200/80"
                  }`}
                >
                  {msg.sender === "user" ? (
                    <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {renderFormattedMarkdown(msg.text)}

                      {/* Figure Gallery */}
                      {msg.response?.figure_urls && msg.response.figure_urls.length > 0 && (
                        <FigureGallery figureUrls={msg.response.figure_urls} />
                      )}

                      {/* Grounding & Debug Inspector */}
                      {msg.response?.debug_chunks && (
                        <DebugPanel
                          routedDocs={msg.response.routed_docs || []}
                          debugChunks={msg.response.debug_chunks || []}
                        />
                      )}
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 font-medium mt-1 mx-1.5 flex items-center space-x-1 font-mono">
                  <Clock className="h-2.5 w-2.5 text-slate-300" />
                  <span>{msg.timestamp}</span>
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* LOADING SPINNER */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-2 text-xs text-slate-600 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs w-fit"
            >
              <Sparkles className="h-4 w-4 text-indigo-600 animate-spin" />
              <span className="font-medium">Synthesizing grounded answer with citations...</span>
            </motion.div>
          )}

          <div ref={chatBottomRef} />
        </div>
      </div>

      {/* FLOATING INPUT BAR */}
      <div className="p-4 bg-white/80 backdrop-blur-md border-t border-[#e8e8e5] shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* ATTACHED CONTEXT BADGES */}
          <div className="flex flex-wrap gap-1.5 min-h-[26px] items-center">
            {selectedDocs.length > 0 ? (
              <>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mr-1">
                  Attached context ({selectedDocs.length}):
                </span>
                {selectedDocs.map((doc) => (
                  <div
                    key={doc}
                    className="inline-flex items-center space-x-1.5 bg-slate-100 border border-slate-200/80 rounded-lg px-2 py-0.5 text-[11px] text-slate-700"
                  >
                    <FileText className="h-3 w-3 text-indigo-500" />
                    <span className="font-semibold truncate max-w-[160px]">{doc}</span>
                    <button
                      onClick={() => onToggleDoc(doc)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <span className="text-[11px] text-slate-400 flex items-center italic">
                <Info className="h-3.5 w-3.5 mr-1" /> No PDF context attached. Select files in sidebar or upload.
              </span>
            )}
          </div>

          {/* INPUT BAR FORM */}
          <form onSubmit={onSendMessage} className="relative flex items-center">
            <div className="relative flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-full shadow-2xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition pr-2 pl-4">
              <button
                type="button"
                onClick={onOpenUpload}
                className="p-2 -ml-1 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-slate-100 transition cursor-pointer shrink-0"
                title="Upload PDF document"
              >
                <Paperclip className="h-4.5 w-4.5" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask a question or search with AI..."
                disabled={isLoading}
                className="flex-1 bg-transparent py-3 px-3 border-none outline-none focus:ring-0 text-slate-800 text-xs sm:text-sm placeholder:text-slate-400 min-w-0 font-sans"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition ${
                  inputText.trim() && !isLoading
                    ? "bg-indigo-600 hover:bg-indigo-500 hover:scale-105 cursor-pointer shadow-2xs"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                }`}
              >
                <ArrowUp className="h-4.5 w-4.5 stroke-[2.5]" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
