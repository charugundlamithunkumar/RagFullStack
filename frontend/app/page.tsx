"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
   MARKDOWN RENDERER — renders AI text with highlighted headings
   and bold terms in blue, with proper readable font sizes.
   ════════════════════════════════════════════════════════════ */
function RenderMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
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

    // Code blocks
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={`code-${i}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i}>{renderInline(line.slice(2))}</blockquote>
      );
      i++;
      continue;
    }

    // Ordered list: collect consecutive numbered lines
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

    // Unordered list
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

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(<p key={i}>{renderInline(line)}</p>);
    i++;
  }

  return <div className="ai-response">{elements}</div>;
}

/** Inline formatting: **bold**, `code`, *italic* */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Process bold, code, italic with regex split
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
   FIGURE GALLERY — inline in assistant messages
   ════════════════════════════════════════════════════════════ */
function FigureGallery({ urls }: { urls: string[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (!urls || urls.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-[#e8e8e5]">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2383e2] mb-2">
        <ImageIcon className="h-3.5 w-3.5" />
        <span>Extracted Figures ({urls.length})</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {urls.map((url, idx) => {
          const full = figureUrl(url);
          return (
            <div
              key={idx}
              onClick={() => setLightbox(full)}
              className="group relative rounded-xl overflow-hidden border border-[#e8e8e5] bg-[#f7f7f5] cursor-pointer hover:border-[#2383e2] transition-all"
            >
              <div className="aspect-video flex items-center justify-center p-2">
                <img
                  src={full}
                  alt={`Figure ${idx + 1}`}
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-1.5 rounded-full shadow-md">
                  <Maximize2 className="h-3.5 w-3.5 text-[#37352f]" />
                </div>
              </div>
              <div className="px-2.5 pb-2 text-xs font-medium text-[#6b6b60]">
                Figure {idx + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white p-3 rounded-2xl max-w-4xl max-h-[90vh] shadow-2xl border border-[#e8e8e5]"
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-[#f7f7f5] hover:bg-[#e8e8e5] text-[#6b6b60] hover:text-[#37352f] transition"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={lightbox}
              alt="Expanded figure"
              className="max-h-[80vh] max-w-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DEBUG PANEL — collapsible retrieval grounding inspector
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
    <div className="mt-3 border border-[#e8e8e5] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#f7f7f5] hover:bg-[#f0f0ed] transition cursor-pointer"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#2383e2]">
          <Layers className="h-3.5 w-3.5" />
          Retrieval Grounding ({debugChunks.length} chunks)
        </span>
        <span className="flex items-center gap-1 text-xs text-[#9b9b93]">
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
        <div className="p-3.5 space-y-3 bg-white border-t border-[#e8e8e5]">
          {routedDocs.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-[#9b9b93] uppercase tracking-wider block mb-1">
                Routed Documents
              </span>
              <div className="flex flex-wrap gap-1.5">
                {routedDocs.map((doc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-[#e8f0fe] text-[#2383e2] rounded-md px-2 py-0.5 text-xs font-medium"
                  >
                    <FileText className="h-3 w-3" />
                    {doc}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {debugChunks.map((chunk, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border text-xs ${
                  chunk.pinned
                    ? "bg-amber-50 border-amber-200"
                    : "bg-[#f7f7f5] border-[#e8e8e5]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {chunk.modality === "image" ? (
                      <ImageIcon className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-[#2383e2] shrink-0" />
                    )}
                    <span className="font-medium truncate">{chunk.doc_name}</span>
                    {chunk.page_number && (
                      <span className="text-[#9b9b93] text-[11px]">
                        p.{chunk.page_number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {chunk.pinned && (
                      <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                        <Pin className="h-2.5 w-2.5" /> Pinned
                      </span>
                    )}
                    <span className="font-mono text-[10px] bg-[#e8e8e5] text-[#6b6b60] px-1.5 py-0.5 rounded">
                      {chunk.score.toFixed(3)}
                    </span>
                  </div>
                </div>
                {chunk.text_preview && (
                  <p className="font-mono text-[11px] text-[#6b6b60] bg-white/80 p-1.5 rounded border border-[#e8e8e5] mt-1 line-clamp-2">
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
   MAIN PAGE
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

  const hasMessages = messages.length > 0;

  return (
    <div
      className="flex flex-col h-screen w-full bg-[#f7f7f5] text-[#37352f] overflow-hidden relative"
      style={{ backgroundImage: "url('/images/tom-jerry-pattern.png')", backgroundSize: '400px', backgroundRepeat: 'repeat', backgroundBlendMode: 'soft-light', backgroundPosition: 'center' }}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
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

      {/* ─── DRAG OVERLAY ─── */}
      <AnimatePresence>
        {dragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[#f7f7f5]/95 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-4">
              <img
                src="/images/tom-jerry-empty.png"
                alt="Tom & Jerry"
                className="w-40 h-40 object-contain animate-bounce drop-shadow-lg"
              />
              <h3 className="text-xl font-bold text-[#37352f]">
                Drop your PDF — Tom & Jerry will index it!
              </h3>
              <p className="text-sm text-[#6b6b60]">
                Text, figures, and captions will be extracted and indexed
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SLIM TOP BAR ─── */}
      <header className="h-12 shrink-0 border-b border-[#e8e8e5] bg-white/80 backdrop-blur-md flex items-center justify-between px-5 z-10">
        <div className="flex items-center gap-2.5">
          <img
            src="/images/tom-jerry-search.png"
            alt="Logo"
            className="w-8 h-8 rounded-lg object-cover border border-[#e8e8e5] shadow-sm"
          />
          <span className="font-bold text-[#37352f] text-sm tracking-tight">
            Multimodal RAG
          </span>
        </div>

        <button
          onClick={() => setShowDocDrawer((d) => !d)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f7f7f5] hover:bg-[#e8e8e5] border border-[#e8e8e5] text-[#6b6b60] hover:text-[#37352f] transition cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Documents ({documents.length})</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${showDocDrawer ? "rotate-180" : ""}`} />
        </button>
      </header>

      {/* ─── DOCUMENT DRAWER (slides down from top bar) ─── */}
      <AnimatePresence>
        {showDocDrawer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-white border-b border-[#e8e8e5] z-10 shrink-0"
          >
            <div className="max-w-2xl mx-auto p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#9b9b93] uppercase tracking-wider">
                  Indexed PDFs — select which to search
                </span>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2383e2] hover:bg-[#1b6ec2] text-white text-xs font-semibold transition cursor-pointer"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Upload PDF
                </button>
              </div>

              {documents.length === 0 ? (
                <div
                  onClick={() => setShowUploadModal(true)}
                  className="p-6 rounded-xl border-2 border-dashed border-[#e8e8e5] hover:border-[#2383e2] flex flex-col items-center gap-2 cursor-pointer transition"
                >
                  <img
                    src="/images/tom-jerry-empty.png"
                    alt="No documents"
                    className="w-20 h-20 object-contain opacity-80"
                  />
                  <span className="text-sm font-medium text-[#6b6b60]">
                    No documents yet — click to upload a PDF
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {documents.map((doc) => {
                    const selected = selectedDocs.includes(doc.doc_name);
                    return (
                      <div
                        key={doc.doc_name}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border transition cursor-pointer ${
                          selected
                            ? "bg-[#e8f0fe] border-[#2383e2]/30"
                            : "bg-[#f7f7f5] border-[#e8e8e5] hover:bg-[#f0f0ed]"
                        }`}
                        onClick={() => toggleDoc(doc.doc_name)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
                              selected
                                ? "bg-[#2383e2] border-[#2383e2]"
                                : "bg-white border-[#d3d3d0]"
                            }`}
                          >
                            {selected && (
                              <Check className="h-2.5 w-2.5 text-white stroke-[3]" />
                            )}
                          </div>
                          <FileText className="h-4 w-4 text-[#2383e2] shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {doc.doc_name}
                          </span>
                          {doc.scanned_warning && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                              Low text
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDoc(doc.doc_name);
                          }}
                          className="p-1 rounded-md text-[#9b9b93] hover:text-red-500 hover:bg-red-50 transition"
                          title="Delete document"
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

      {/* ─── MAIN CONTENT AREA ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ─── CHAT MESSAGES (scrollable) ─── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            {/* Landing state — shown when no messages */}
            {!hasMessages && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center pt-[8vh] pb-8 text-center"
              >
                <motion.img
                  src="/images/tom-jerry-hero.png"
                  alt="Tom & Jerry AI Assistant"
                  className="w-56 h-56 object-contain mb-6 drop-shadow-lg"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                />
                <h1 className="text-3xl font-extrabold tracking-tight text-[#37352f] mb-2">
                  Ask your documents anything
                </h1>
                <p className="text-base text-[#6b6b60] max-w-md leading-relaxed">
                  Upload PDFs, then ask questions. The AI retrieves relevant text
                  and figures from your documents to generate grounded answers.
                </p>

                {/* Suggestion chips */}
                <div className="flex flex-wrap justify-center gap-2 mt-8">
                  {[
                    "Summarize the key findings",
                    "What are the main conclusions?",
                    "Extract all figures and charts",
                    "Compare the methodologies used",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInputText(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="px-4 py-2 rounded-full border border-[#e8e8e5] bg-white/80 backdrop-blur-sm hover:bg-white hover:border-[#d3d3d0] text-sm text-[#6b6b60] hover:text-[#37352f] transition cursor-pointer shadow-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {documents.length === 0 && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="mt-8 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2383e2] hover:bg-[#1b6ec2] text-white font-semibold text-sm transition cursor-pointer shadow-md"
                  >
                    <FileUp className="h-4 w-4" />
                    Upload your first PDF
                  </button>
                )}
              </motion.div>
            )}

            {/* Message list */}
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.03 }}
                  className={`mb-6 ${
                    msg.sender === "user" ? "flex justify-end" : ""
                  }`}
                >
                  {msg.sender === "user" ? (
                    /* ── USER BUBBLE ── */
                    <div className="max-w-[80%] bg-[#2383e2] text-white px-5 py-3 rounded-2xl rounded-br-md shadow-sm">
                      <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    </div>
                  ) : (
                    /* ── ASSISTANT RESPONSE ── */
                    <div className="max-w-full">
                      {/* AI label */}
                      <div className="flex items-center gap-2 mb-2">
                        <img
                          src="/images/tom-jerry-search.png"
                          alt="AI"
                          className="w-6 h-6 rounded-lg object-cover border border-[#e8e8e5]"
                        />
                        <span className="text-xs font-semibold text-[#9b9b93]">
                          AI · {msg.timestamp}
                        </span>
                      </div>

                      {/* Response card */}
                      <div className="bg-white rounded-2xl rounded-tl-md border border-[#e8e8e5] px-5 py-4 shadow-sm">
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

            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 mb-6"
              >
                <img
                  src="/images/tom-jerry-search.png"
                  alt="AI thinking"
                  className="w-6 h-6 rounded-lg object-cover border border-[#e8e8e5] animate-pulse"
                />
                <div className="bg-white rounded-2xl rounded-tl-md border border-[#e8e8e5] px-5 py-3.5 shadow-sm flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="thinking-dot w-2 h-2 rounded-full bg-[#2383e2]" />
                    <span className="thinking-dot w-2 h-2 rounded-full bg-[#2383e2]" />
                    <span className="thinking-dot w-2 h-2 rounded-full bg-[#2383e2]" />
                  </div>
                  <span className="text-sm text-[#6b6b60] font-medium">
                    Searching documents & generating answer…
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={chatBottomRef} />
          </div>
        </div>

        {/* ─── INPUT BAR (always visible at bottom) ─── */}
        <div className="shrink-0 border-t border-[#e8e8e5] bg-white/80 backdrop-blur-md">
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
            {/* Attached doc badges */}
            {documents.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-[#9b9b93]">
                  Searching:
                </span>
                {selectedDocs.length === 0 ? (
                  <span className="text-[11px] text-amber-600 flex items-center gap-1">
                    <Info className="h-3 w-3" /> No docs selected
                  </span>
                ) : (
                  selectedDocs.map((doc) => (
                    <span
                      key={doc}
                      className="inline-flex items-center gap-1 bg-[#e8f0fe] text-[#2383e2] rounded-md px-2 py-0.5 text-[11px] font-medium"
                    >
                      <FileText className="h-3 w-3" />
                      <span className="truncate max-w-[120px]">{doc}</span>
                      <button
                        onClick={() => toggleDoc(doc)}
                        className="text-[#2383e2]/60 hover:text-[#2383e2] ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            )}

            {/* Input form */}
            <form onSubmit={handleSend} className="relative flex items-center">
              <div className="flex-1 flex items-center bg-[#f7f7f5] border border-[#e8e8e5] rounded-2xl focus-within:border-[#2383e2] focus-within:ring-2 focus-within:ring-[#2383e2]/15 transition pl-1 pr-1.5">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="p-2.5 text-[#9b9b93] hover:text-[#2383e2] rounded-xl hover:bg-[#e8f0fe] transition cursor-pointer"
                  title="Upload PDF"
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
                      ? "Upload a PDF first, then ask a question…"
                      : "Ask a question about your documents…"
                  }
                  disabled={isLoading}
                  className="flex-1 bg-transparent py-3 px-2 border-none outline-none focus:ring-0 text-[#37352f] text-[0.9375rem] placeholder:text-[#9b9b93] min-w-0"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                    inputText.trim() && !isLoading
                      ? "bg-[#2383e2] hover:bg-[#1b6ec2] text-white cursor-pointer shadow-sm"
                      : "bg-[#e8e8e5] text-[#9b9b93] cursor-not-allowed"
                  }`}
                >
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            </form>

            <p className="text-center text-[11px] text-[#9b9b93]">
              Answers are grounded in your uploaded documents using Multimodal RAG
            </p>
          </div>
        </div>
      </div>

      {/* ─── UPLOAD MODAL ─── */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#e8e8e5] overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between p-5 border-b border-[#e8e8e5]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#e8f0fe] text-[#2383e2] rounded-xl">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#37352f]">Upload PDF</h3>
                    <p className="text-xs text-[#9b9b93]">
                      Extract text & figures for RAG indexing
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadError(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#f7f7f5] text-[#9b9b93] hover:text-[#37352f] transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-5 space-y-4">
                {uploadError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#e8e8e5] hover:border-[#2383e2] rounded-2xl p-10 flex flex-col items-center text-center cursor-pointer hover:bg-[#e8f0fe]/20 transition group"
                >
                  <div className="p-4 bg-[#e8f0fe] rounded-full text-[#2383e2] group-hover:scale-110 transition-transform mb-3">
                    <FileUp className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-semibold text-[#37352f]">
                    Click to select or drag & drop
                  </p>
                  <p className="text-xs text-[#9b9b93] mt-1">
                    PDF files up to 100 pages
                  </p>
                </div>

                {isUploading && (
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-[#2383e2] py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Extracting text & figures, building indexes…</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadError(null);
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-[#6b6b60] hover:text-[#37352f] hover:bg-[#f7f7f5] transition cursor-pointer"
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
