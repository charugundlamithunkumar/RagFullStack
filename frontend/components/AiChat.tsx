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
  FileUp,
  Plus
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
  onTriggerFileUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  onTriggerFileUpload,
  fileInputRef,
  onFileInputChange,
}: AiChatProps) {
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Formats markdown into clean, readable React elements with light-blue headings & highlighted terms
  const renderFormattedMarkdown = (text: string) => {
    return text.split("\n\n").map((block, bIdx) => {
      const trimmed = block.trim();

      // Heading detection (# ## ### or lines ending with :)
      if (/^#{1,3}\s/.test(trimmed)) {
        const headingText = trimmed.replace(/^#{1,3}\s+/, "");
        return (
          <h3
            key={bIdx}
            className="text-base sm:text-lg font-bold text-sky-600 mt-4 mb-2 tracking-tight flex items-center gap-2 font-display"
          >
            <span className="w-1.5 h-4 bg-sky-500 rounded-full inline-block"></span>
            {renderInlineFormatting(headingText)}
          </h3>
        );
      }

      // Numbered List detection (1. 2. 3.)
      if (/^\d+\.\s/.test(trimmed)) {
        const lines = block.split("\n");
        return (
          <ol key={bIdx} className="list-decimal pl-5 space-y-2 my-2 text-slate-800">
            {lines.map((line, lIdx) => {
              const cleanLine = line.replace(/^\d+\.\s+/, "");
              return (
                <li key={lIdx} className="text-sm sm:text-[15px] leading-relaxed">
                  {renderInlineFormatting(cleanLine)}
                </li>
              );
            })}
          </ol>
        );
      }

      // Unordered List detection (- or *)
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const lines = block.split("\n");
        return (
          <ul key={bIdx} className="list-disc pl-5 space-y-1.5 my-2 text-slate-800">
            {lines.map((line, lIdx) => {
              const cleanLine = line.replace(/^[-*]\s+/, "");
              return (
                <li key={lIdx} className="text-sm sm:text-[15px] leading-relaxed">
                  {renderInlineFormatting(cleanLine)}
                </li>
              );
            })}
          </ul>
        );
      }

      // Regular Paragraph
      return (
        <p key={bIdx} className="text-sm sm:text-[15px] leading-relaxed my-2 text-slate-800">
          {renderInlineFormatting(block)}
        </p>
      );
    });
  };

  // Inline formatting parser: highlights **bold terms** in light blue badge
  const renderInlineFormatting = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const content = part.slice(2, -2);
        return (
          <span
            key={idx}
            className="inline-block bg-sky-50 text-sky-700 font-bold px-1.5 py-0.5 rounded border border-sky-200/80 mx-0.5 text-xs sm:text-sm"
          >
            {content}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-sans relative bg-[#fcfcfb]">
      {/* Hidden File Input mapped directly to paperclip */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileInputChange}
        accept=".pdf"
        className="hidden"
      />

      {/* CHAT MESSAGES SCROLLABLE AREA */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* EMPTY STATE LANDING */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-5"
            >
              <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-center text-sky-600 shadow-xs">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-display">
                  Ask AI anything across your PDFs
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-1.5 leading-relaxed font-medium">
                  Upload PDF documents to index text & figures, attach them to your query, and receive grounded answers with citations.
                </p>
              </div>

              {/* QUICK STARTER PROMPTS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full pt-2">
                <button
                  onClick={() => setInputText("What are the main findings of the uploaded document?")}
                  className="p-3 bg-white hover:bg-sky-50/50 border border-slate-200/80 hover:border-sky-300 rounded-2xl text-left transition shadow-2xs group cursor-pointer"
                >
                  <span className="text-xs font-bold text-sky-700 block">Summarize PDF</span>
                  <span className="text-xs text-slate-500 block truncate">"What are the main findings?"</span>
                </button>

                <button
                  onClick={() => setInputText("Explain the figures and diagrams in the document.")}
                  className="p-3 bg-white hover:bg-sky-50/50 border border-slate-200/80 hover:border-sky-300 rounded-2xl text-left transition shadow-2xs group cursor-pointer"
                >
                  <span className="text-xs font-bold text-sky-700 block">Extract Figures</span>
                  <span className="text-xs text-slate-500 block truncate">"Explain figures & diagrams"</span>
                </button>
              </div>

              {/* DIRECT UPLOAD BUTTON */}
              <button
                onClick={onTriggerFileUpload}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Upload New PDF Document</span>
              </button>
            </motion.div>
          )}

          {/* CHAT MESSAGES CHRONICLE */}
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex flex-col ${
                  msg.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-5 shadow-2xs ${
                    msg.sender === "user"
                      ? "bg-slate-900 text-white rounded-tr-none border border-slate-950"
                      : "bg-white text-slate-800 rounded-tl-none border border-slate-200/90"
                  }`}
                >
                  {msg.sender === "user" ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                      {msg.text}
                    </p>
                  ) : (
                    <div className="space-y-2">
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

                <span className="text-[10px] text-slate-400 font-medium mt-1 mx-2 flex items-center space-x-1 font-mono">
                  <Clock className="h-2.5 w-2.5 text-slate-300" />
                  <span>{msg.timestamp}</span>
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* LOADING SPINNER */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-2 text-xs font-semibold text-slate-700 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs w-fit"
            >
              <Sparkles className="h-4 w-4 text-sky-600 animate-spin" />
              <span>Synthesizing answer from grounded PDF context...</span>
            </motion.div>
          )}

          <div ref={chatBottomRef} />
        </div>
      </div>

      {/* FLOATING PROMPT INPUT BAR AT BOTTOM */}
      <div className="p-4 bg-white/90 backdrop-blur-md border-t border-slate-200/80 shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* ATTACHED CONTEXT BADGES */}
          <div className="flex flex-wrap gap-1.5 min-h-[26px] items-center">
            {selectedDocs.length > 0 ? (
              <>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mr-1">
                  Attached PDFs ({selectedDocs.length}):
                </span>
                {selectedDocs.map((doc) => (
                  <div
                    key={doc}
                    className="inline-flex items-center space-x-1.5 bg-sky-50 border border-sky-200/80 rounded-lg px-2.5 py-1 text-xs text-sky-900 font-medium"
                  >
                    <FileText className="h-3.5 w-3.5 text-sky-600" />
                    <span className="font-semibold truncate max-w-[180px]">{doc}</span>
                    <button
                      onClick={() => onToggleDoc(doc)}
                      className="text-sky-400 hover:text-sky-700 ml-1 p-0.5 rounded hover:bg-sky-100 transition cursor-pointer"
                      title="De-attach document"
                    >
                      <X className="h-3 w-3 stroke-[2.5]" />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <span className="text-[11px] text-amber-700 flex items-center font-medium">
                <Info className="h-3.5 w-3.5 mr-1 text-amber-500" /> No PDF attached. Click paperclip or select PDF in sidebar.
              </span>
            )}
          </div>

          {/* INPUT FORM PILL */}
          <form onSubmit={onSendMessage} className="relative flex items-center">
            <div className="relative flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-2xl shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/15 transition pr-2 pl-3">
              {/* PAPERCLIP DIRECT PDF UPLOAD TRIGGER */}
              <button
                type="button"
                onClick={onTriggerFileUpload}
                className="p-2 text-slate-400 hover:text-sky-600 rounded-xl hover:bg-slate-200/60 transition cursor-pointer shrink-0 flex items-center space-x-1"
                title="Attach & Upload PDF Document"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask a question across selected PDFs..."
                disabled={isLoading}
                className="flex-1 bg-transparent py-3 px-3 border-none outline-none focus:ring-0 text-slate-800 text-sm placeholder:text-slate-400 min-w-0 font-sans"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition ${
                  inputText.trim() && !isLoading
                    ? "bg-sky-600 hover:bg-sky-500 hover:scale-105 cursor-pointer shadow-xs"
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
