"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  X,
  AlertCircle,
  Sparkles,
  FileUp,
  Loader2,
  ArrowUp,
  Paperclip,
  Trash2,
  Check,
  Image as ImageIcon,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Layers,
  Pin,
  Info,
  Plus,
  RotateCcw,
} from "lucide-react";
import { getSessionId } from "@/lib/session";
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  askQuestion,
  figureUrl,
} from "@/lib/api";
import type { DocumentInfo, ChatMessage, DebugChunk } from "@/lib/types";

/* ════════════════════════════════════════════════════════════
   MARKDOWN RENDERER — High Readability
   Headings & Bold terms in Blue (#007AFF)
   ════════════════════════════════════════════════════════════ */
function RenderMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("#### ")) {
      elements.push(<h4 key={i}>{renderInline(line.slice(5))}</h4>);
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i}>{renderInline(line.slice(4))}</h3>);
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h2 key={i}>{renderInline(line.slice(3))}</h2>);
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(<h1 key={i}>{renderInline(line.slice(2))}</h1>);
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <pre key={`code-${i}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i}>{renderInline(line.slice(2))}</blockquote>
      );
      i++;
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    elements.push(<p key={i}>{renderInline(line)}</p>);
    i++;
  }

  return <div className="ai-response">{elements}</div>;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code key={match.index}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

/* ════════════════════════════════════════════════════════════
   FIGURE GALLERY
   ════════════════════════════════════════════════════════════ */
function FigureGallery({ urls }: { urls: string[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (!urls || urls.length === 0) return null;

  return (
    <div className="mt-4 pt-3.5 border-t border-slate-100">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#007AFF] mb-2.5">
        <ImageIcon className="h-3.5 w-3.5" />
        <span>Extracted Diagrams ({urls.length})</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {urls.map((url, idx) => {
          const full = figureUrl(url);
          return (
            <div
              key={idx}
              onClick={() => setLightbox(full)}
              className="group relative rounded-2xl overflow-hidden border border-black/5 bg-slate-50 cursor-pointer hover:border-[#007AFF]/40 hover:shadow-ios-sm transition-all"
            >
              <div className="aspect-video flex items-center justify-center p-2.5">
                <img
                  src={full}
                  alt={`Extracted Figure ${idx + 1}`}
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-md p-2 rounded-full shadow-md">
                  <Maximize2 className="h-3.5 w-3.5 text-slate-800" />
                </div>
              </div>
              <div className="px-3 pb-2 text-[11px] font-medium text-slate-500 flex justify-between">
                <span>Figure {idx + 1}</span>
                <span className="text-slate-400">Tap to expand</span>
              </div>
            </div>
          );
        })}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white p-3 rounded-3xl max-w-4xl max-h-[90vh] shadow-ios-lg border border-white/20"
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={lightbox}
              alt="Expanded figure"
              className="max-h-[80vh] max-w-full object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DEBUG PANEL
   ════════════════════════════════════════════════════════════ */
function DebugPanel({
  routedDocs,
  debugChunks,
}: {
  routedDocs: string[];
  debugChunks: DebugChunk[];
}) {
  const [open, setOpen] = useState(false);
  if (!debugChunks || debugChunks.length === 0) return null;

  return (
    <div className="mt-4 border border-black/5 rounded-2xl overflow-hidden bg-slate-50/70">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100/60 transition cursor-pointer text-xs"
      >
        <span className="flex items-center gap-2 font-semibold text-[#007AFF]">
          <Layers className="h-3.5 w-3.5" />
          RAG Retrieval Grounding ({debugChunks.length} chunks)
        </span>
        <span className="flex items-center gap-1 text-slate-400 font-medium">
          {open ? (
            <>
              Hide <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Inspect <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-3 bg-white border-t border-black/5">
          {routedDocs.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Routed PDF Documents
              </span>
              <div className="flex flex-wrap gap-1.5">
                {routedDocs.map((doc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-[#007AFF]/10 text-[#007AFF] rounded-lg px-2.5 py-1 text-xs font-semibold"
                  >
                    <FileText className="h-3 w-3" />
                    {doc}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {debugChunks.map((chunk, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-xs leading-relaxed ${
                  chunk.pinned
                    ? "bg-amber-50/80 border-amber-200"
                    : "bg-slate-50 border-slate-200/80"
                }`}
              >
                <div className="flex items-center justify-between font-semibold mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {chunk.modality === "image" ? (
                      <ImageIcon className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
                    )}
                    <span className="truncate max-w-[200px]">{chunk.doc_name}</span>
                    {chunk.page_number && (
                      <span className="text-slate-400 text-[11px] font-normal">
                        p.{chunk.page_number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {chunk.pinned && (
                      <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        <Pin className="h-2.5 w-2.5" /> Pinned
                      </span>
                    )}
                    <span className="font-mono text-[10px] bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      Score: {chunk.score.toFixed(3)}
                    </span>
                  </div>
                </div>
                {chunk.text_preview && (
                  <p className="font-mono text-[11px] text-slate-600 bg-white/90 p-2 rounded-lg border border-slate-200/50 mt-1.5 line-clamp-2">
                    &ldquo;{chunk.text_preview}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE — Tom & Jerry Fullscreen Wallpaper & Cutouts
   ════════════════════════════════════════════════════════════ */
export default function Page() {
  const [sessionId, setSessionId] = useState("");
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDocDrawer, setShowDocDrawer] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    if (sessionId) refreshDocuments();
  }, [sessionId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const refreshDocuments = async () => {
    if (!sessionId) return;
    try {
      const docs = await listDocuments(sessionId);
      setDocuments(docs);
      setSelectedDocs(docs.map((d) => d.doc_name));
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  };

  const toggleDoc = (name: string) => {
    setSelectedDocs((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name]
    );
  };

  const handleDeleteDoc = async (name: string) => {
    try {
      await deleteDocument(sessionId, name);
      await refreshDocuments();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleUpload = async (file: File) => {
    if (!file || !sessionId) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF files are supported.");
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(sessionId, file);
      await refreshDocuments();
      setShowUploadModal(false);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const query = inputText.trim();
    setInputText("");

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: "user", text: query, timestamp: time },
    ]);
    setIsLoading(true);

    try {
      const res = await askQuestion(sessionId, query, selectedDocs);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: "assistant",
          text: res.answer,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          response: res,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          sender: "assistant",
          text: `**Error:** ${err.message || "Failed to reach backend."}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
  };

  const hasMessages = messages.length > 0;

  return (
    <div
      className="flex flex-col h-screen w-full bg-[#f6f5f0] text-[#1c1c1e] overflow-hidden relative select-none"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {/* ─── FULLSCREEN TOM AND JERRY ARTWORK WALLPAPER PATTERN ─── */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-45 tom-jerry-bg-pattern" />

      {/* ─── FLOATING JERRY CHARACTER CUTOUTS IN CORNERS ─── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Bottom Right Jerry Peeking */}
        <img
          src="/jerry.png"
          alt="Jerry character bottom right"
          className="absolute -bottom-4 -right-4 w-72 sm:w-96 max-w-none object-contain z-0 drop-shadow-lg"
        />

        {/* Bottom Left Jerry Peeking */}
        <img
          src="/jerry.png"
          alt="Jerry character bottom left"
          className="absolute -bottom-6 -left-6 w-64 sm:w-80 max-w-none object-contain transform -scale-x-100 z-0 drop-shadow-lg"
        />

        {/* Top Right Jerry Peeking */}
        <img
          src="/jerry.png"
          alt="Jerry character top right"
          className="absolute -top-8 -right-8 w-56 sm:w-72 max-w-none object-contain transform rotate-45 z-0 drop-shadow-md"
        />

        {/* Top Left Jerry Peeking */}
        <img
          src="/jerry.png"
          alt="Jerry character top left"
          className="absolute -top-8 -left-8 w-60 sm:w-72 max-w-none object-contain transform -rotate-45 z-0 drop-shadow-md"
        />
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
        accept=".pdf"
        className="hidden"
      />

      {/* ─── Drag & Drop Overlay ─── */}
      <AnimatePresence>
        {dragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-xl"
          >
            <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white shadow-ios-lg border border-black/5">
              <div className="p-5 bg-[#007AFF]/10 rounded-full animate-bounce">
                <FileUp className="h-10 w-10 text-[#007AFF]" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Drop PDF to Ingest & Index
              </h3>
              <p className="text-sm text-slate-500 font-medium">
                Extracts text, associates figures, and embeds for RAG retrieval
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FLOATING TOP PILL CONTROLS (Top Bar Removed) ─── */}
      <div className="absolute top-4 right-6 z-30 flex items-center gap-2">
        {hasMessages && (
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/95 backdrop-blur-md hover:bg-white text-slate-700 shadow-ios-sm border border-black/10 transition cursor-pointer"
            title="Start New Thread"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>New Thread</span>
          </button>
        )}

        <button
          onClick={() => setShowDocDrawer((d) => !d)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer shadow-ios-sm ${
            showDocDrawer
              ? "bg-[#007AFF] text-white"
              : "bg-white/95 backdrop-blur-md border border-black/10 text-slate-700 hover:bg-white"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Documents ({documents.length})</span>
          <ChevronDown
            className={`h-3 w-3 transition-transform ${
              showDocDrawer ? "rotate-180" : ""
            }`}
          />
        </button>

        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#007AFF] hover:bg-[#0062cc] text-white text-xs font-semibold transition cursor-pointer shadow-ios-sm"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Add PDF</span>
        </button>
      </div>

      {/* ─── DOCUMENT DRAWER SHEET ─── */}
      <AnimatePresence>
        {showDocDrawer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden bg-white/95 backdrop-blur-xl border-b border-black/10 z-20 shrink-0 shadow-ios-md relative"
          >
            <div className="max-w-3xl mx-auto p-5 pt-14 sm:pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Active Document Knowledge Base
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select PDFs to retrieve context from during queries.
                  </p>
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/20 text-xs font-bold transition cursor-pointer"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Upload PDF Document
                </button>
              </div>

              {documents.length === 0 ? (
                <div
                  onClick={() => setShowUploadModal(true)}
                  className="p-8 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#007AFF] flex flex-col items-center gap-2 cursor-pointer transition bg-slate-50/50"
                >
                  <FileUp className="h-8 w-8 text-[#007AFF]" />
                  <span className="text-sm font-semibold text-slate-700">
                    No indexed PDFs in this workspace session
                  </span>
                  <span className="text-xs text-slate-400">
                    Click here to upload your first document
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {documents.map((doc) => {
                    const selected = selectedDocs.includes(doc.doc_name);
                    return (
                      <div
                        key={doc.doc_name}
                        onClick={() => toggleDoc(doc.doc_name)}
                        className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition cursor-pointer ${
                          selected
                            ? "bg-[#007AFF]/5 border-[#007AFF]/40 shadow-ios-sm"
                            : "bg-slate-50 border-slate-200/80 hover:bg-slate-100/60"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div
                            className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                              selected
                                ? "bg-[#007AFF] border-[#007AFF]"
                                : "bg-white border-slate-300"
                            }`}
                          >
                            {selected && (
                              <Check className="h-3 w-3 text-white stroke-[3]" />
                            )}
                          </div>
                          <FileText className="h-4.5 w-4.5 text-[#007AFF] shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-800 truncate block">
                              {doc.doc_name}
                            </span>
                            {doc.scanned_warning && (
                              <span className="text-[10px] text-amber-600 font-medium">
                                Low OCR text warning
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDoc(doc.doc_name);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete PDF"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MAIN CHAT CANVAS ─── */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6 pt-4">
            {/* Landing State (When empty) */}
            {!hasMessages && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center pt-[14vh] pb-8 text-center space-y-6"
              >
                {/* Center Sparkle Badge */}
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#007AFF] to-sky-400 flex items-center justify-center shadow-ios-md">
                  <Sparkles className="h-10 w-10 text-white" />
                </div>

                <div className="space-y-2 max-w-md bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-black/5 shadow-ios-sm">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Multimodal RAG Knowledge Assistant
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                    Search and synthesize information directly from your uploaded PDF documents. Headings and key terms are highlighted cleanly for fast reading.
                  </p>
                </div>

                {/* Prompt Template Pill Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg pt-2">
                  {[
                    "Summarize key conclusions",
                    "List core metrics & findings",
                    "Extract figures and diagrams",
                    "Compare methodologies used",
                  ].map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInputText(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="p-3.5 rounded-2xl bg-white/95 backdrop-blur-md hover:bg-white border border-black/5 hover:border-[#007AFF]/40 text-left text-xs font-semibold text-slate-800 shadow-ios-sm transition cursor-pointer flex items-center justify-between group"
                    >
                      <span>{suggestion}</span>
                      <ArrowUp className="h-3.5 w-3.5 text-[#007AFF] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>

                {documents.length === 0 && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="mt-4 flex items-center gap-2 px-6 py-3 rounded-full bg-[#007AFF] hover:bg-[#0062cc] text-white font-semibold text-xs transition cursor-pointer shadow-ios-md"
                  >
                    <FileUp className="h-4 w-4" />
                    Upload your first PDF
                  </button>
                )}
              </motion.div>
            )}

            {/* Thread Messages */}
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex flex-col ${
                    msg.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {msg.sender === "user" ? (
                    <div className="max-w-[85%] bg-[#007AFF] text-white px-5 py-3 rounded-3xl rounded-br-lg shadow-ios-sm">
                      <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {msg.text}
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-full w-full">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#007AFF] to-sky-400 flex items-center justify-center shadow-xs">
                          <Sparkles className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          RAG Assistant • {msg.timestamp}
                        </span>
                      </div>

                      <div className="ios-card rounded-3xl p-6 border border-black/5 shadow-ios-md">
                        <RenderMarkdown text={msg.text} />

                        {msg.response?.figure_urls &&
                          msg.response.figure_urls.length > 0 && (
                            <FigureGallery urls={msg.response.figure_urls} />
                          )}

                        {msg.response?.debug_chunks && (
                          <DebugPanel
                            routedDocs={msg.response.routed_docs || []}
                            debugChunks={msg.response.debug_chunks}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking Indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#007AFF] to-sky-400 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
                <div className="ios-card rounded-2xl px-5 py-3.5 shadow-ios-sm flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="thinking-dot w-2 h-2 rounded-full bg-[#007AFF]" />
                    <span className="thinking-dot w-2 h-2 rounded-full bg-[#007AFF]" />
                    <span className="thinking-dot w-2 h-2 rounded-full bg-[#007AFF]" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    Retrieving grounded context & synthesizing answer...
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={chatBottomRef} />
          </div>
        </div>

        {/* ─── FLOATING BOTTOM INPUT DOCK ─── */}
        <div className="p-4 shrink-0 bg-transparent relative z-20">
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Attached Docs Badge Bar */}
            {documents.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap px-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Target Context ({selectedDocs.length}):
                </span>
                {selectedDocs.length === 0 ? (
                  <span className="text-[11px] text-amber-600 flex items-center gap-1 font-medium">
                    <Info className="h-3 w-3" /> Select PDFs from Documents drawer
                  </span>
                ) : (
                  selectedDocs.map((doc) => (
                    <span
                      key={doc}
                      className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-black/10 rounded-full px-3 py-1 text-xs text-slate-800 shadow-ios-sm"
                    >
                      <FileText className="h-3 w-3 text-[#007AFF]" />
                      <span className="font-medium truncate max-w-[130px]">{doc}</span>
                      <button
                        onClick={() => toggleDoc(doc)}
                        className="text-slate-400 hover:text-slate-700 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            )}

            {/* Floating Input Capsule Bar */}
            <form onSubmit={handleSend} className="relative flex items-center">
              <div className="flex-1 flex items-center ios-glass border border-black/10 rounded-full shadow-ios-lg focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20 transition-all pl-2 pr-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="p-2.5 text-slate-400 hover:text-[#007AFF] rounded-full hover:bg-slate-100/80 transition cursor-pointer shrink-0"
                  title="Attach PDF Document"
                >
                  <Paperclip className="h-5 w-5" />
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    documents.length === 0
                      ? "Attach a PDF to ask questions..."
                      : "Ask a question about your PDF documents..."
                  }
                  disabled={isLoading}
                  className="flex-1 bg-transparent py-2 px-2 border-none outline-none focus:ring-0 text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 min-w-0 font-sans"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                    inputText.trim() && !isLoading
                      ? "bg-[#007AFF] hover:bg-[#0062cc] text-white cursor-pointer shadow-ios-sm"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <ArrowUp className="h-4.5 w-4.5 stroke-[2.5]" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ─── PDF UPLOAD MODAL ─── */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-ios-lg w-full max-w-md border border-black/10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#007AFF]/10 text-[#007AFF] rounded-2xl">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Upload Knowledge PDF
                    </h3>
                    <p className="text-xs text-slate-400">
                      Extract text chunks & figures for indexing
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadError(null);
                  }}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {uploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-rose-700 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-[#007AFF] rounded-3xl p-10 flex flex-col items-center text-center cursor-pointer hover:bg-[#007AFF]/5 transition group"
                >
                  <div className="p-4 bg-[#007AFF]/10 rounded-full text-[#007AFF] group-hover:scale-110 transition-transform mb-3">
                    <FileUp className="h-8 w-8" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800">
                    Click to browse or drag PDF file here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    PDF files up to 100 pages
                  </p>
                </div>

                {isUploading && (
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#007AFF] py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing text, figures & building FAISS index...</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadError(null);
                    }}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
