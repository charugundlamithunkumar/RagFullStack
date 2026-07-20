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
  Sun,
  Moon,
  Zap,
  Smile,
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
    <div className="mt-4 pt-3 border-t border-[var(--border-soft)]">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-blue)] mb-2">
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
              className="group relative rounded-xl overflow-hidden border border-[var(--border-soft)] bg-[var(--bg-warm)] cursor-pointer hover:border-[var(--accent-blue)] transition-all"
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
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-slate-800/90 p-1.5 rounded-full shadow-md">
                  <Maximize2 className="h-3.5 w-3.5 text-[var(--text-primary)]" />
                </div>
              </div>
              <div className="px-2.5 pb-2 text-xs font-medium text-[var(--text-secondary)]">
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
            className="relative bg-[var(--bg-card)] p-3 rounded-2xl max-w-4xl max-h-[90vh] shadow-2xl border border-[var(--border-soft)]"
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-[var(--bg-warm)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
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
    <div className="mt-3 border border-[var(--border-soft)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[var(--bg-warm)] hover:opacity-90 transition cursor-pointer"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-blue)]">
          <Layers className="h-3.5 w-3.5" />
          Retrieval Grounding ({debugChunks.length} chunks)
        </span>
        <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
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
        <div className="p-3.5 space-y-3 bg-[var(--bg-card)] border-t border-[var(--border-soft)]">
          {routedDocs.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Routed Documents
              </span>
              <div className="flex flex-wrap gap-1.5">
                {routedDocs.map((doc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-[var(--accent-blue-light)] text-[var(--accent-blue)] rounded-md px-2 py-0.5 text-xs font-medium"
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
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    : "bg-[var(--bg-warm)] border-[var(--border-soft)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {chunk.modality === "image" ? (
                      <ImageIcon className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-[var(--accent-blue)] shrink-0" />
                    )}
                    <span className="font-medium truncate">{chunk.doc_name}</span>
                    {chunk.page_number && (
                      <span className="text-[var(--text-muted)] text-[11px]">
                        p.{chunk.page_number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {chunk.pinned && (
                      <span className="inline-flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                        <Pin className="h-2.5 w-2.5" /> Pinned
                      </span>
                    )}
                    <span className="font-mono text-[10px] bg-[var(--border-soft)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded">
                      {chunk.score.toFixed(3)}
                    </span>
                  </div>
                </div>
                {chunk.text_preview && (
                  <p className="font-mono text-[11px] text-[var(--text-secondary)] bg-[var(--bg-card)] p-1.5 rounded border border-[var(--border-soft)] mt-1 line-clamp-2">
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
   FLOATING 3D TOM AND JERRY ANIMATED STICKERS & BADGES
   ════════════════════════════════════════════════════════════ */
function TomAndJerry3DBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 tom-jerry-bg-pattern perspective-1000">
      {/* 3D Sticker 1: Jerry with Cheese (Top Left) */}
      <motion.div
        animate={{
          y: [-8, 8, -8],
          rotateX: [-6, 6, -6],
          rotateY: [-10, 10, -10],
          rotateZ: [-3, 3, -3],
        }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.15, rotateZ: 12 }}
        className="absolute top-16 left-6 md:left-12 pointer-events-auto cursor-pointer select-none"
      >
        <div className="bg-[var(--bg-card)]/90 backdrop-blur-md border border-amber-300/60 dark:border-amber-500/40 shadow-lg rounded-2xl p-2.5 flex items-center gap-2 transform transition-all duration-300 hover:shadow-amber-500/20 hover:border-amber-400">
          <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
            🧀
          </div>
          <div className="pr-1">
            <div className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-1">
              <span>Jerry&apos;s Cheese Retrieval</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-300 px-1 py-0.2 rounded font-mono">
                RAG
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">Fast & grounded text chunks</p>
          </div>
        </div>
      </motion.div>

      {/* 3D Sticker 2: Tom Cat Chase (Top Right) */}
      <motion.div
        animate={{
          y: [10, -6, 10],
          rotateX: [8, -8, 8],
          rotateY: [12, -12, 12],
          rotateZ: [4, -4, 4],
        }}
        transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.15, rotateZ: -10 }}
        className="absolute top-20 right-6 md:right-16 pointer-events-auto cursor-pointer select-none"
      >
        <div className="bg-[var(--bg-card)]/90 backdrop-blur-md border border-blue-300/60 dark:border-blue-500/40 shadow-lg rounded-2xl p-2.5 flex items-center gap-2 transform transition-all duration-300 hover:shadow-blue-500/20 hover:border-blue-400">
          <div className="w-9 h-9 rounded-xl bg-blue-400/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">
            🐱
          </div>
          <div className="pr-1">
            <div className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-1">
              <span>Tom&apos;s Visual Indexer</span>
              <span className="text-[9px] bg-blue-500/20 text-blue-600 dark:text-blue-300 px-1 py-0.2 rounded font-mono">
                CLIP
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">Extracts figures & diagrams</p>
          </div>
        </div>
      </motion.div>

      {/* 3D Sticker 3: Mouse Hole / Search Badge (Bottom Left) */}
      <motion.div
        animate={{
          y: [-6, 10, -6],
          rotateX: [-10, 5, -10],
          rotateY: [-8, 8, -8],
        }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.12, rotateZ: 6 }}
        className="absolute bottom-24 left-8 md:left-16 hidden md:block pointer-events-auto cursor-pointer select-none"
      >
        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md border border-[var(--border-soft)] shadow-md rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="text-base">🕳️</span>
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Mouse Hole Deep Reranking
          </span>
        </div>
      </motion.div>

      {/* 3D Sticker 4: Cartoon Trap & Cheese (Bottom Right) */}
      <motion.div
        animate={{
          y: [8, -8, 8],
          rotateX: [6, -6, 6],
          rotateY: [10, -10, 10],
        }}
        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.12, rotateZ: -8 }}
        className="absolute bottom-28 right-8 md:right-20 hidden md:block pointer-events-auto cursor-pointer select-none"
      >
        <div className="bg-[var(--bg-card)]/80 backdrop-blur-md border border-amber-300/50 dark:border-amber-500/30 shadow-md rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="text-base">🐾</span>
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Tom & Jerry Multimodal Fusion
          </span>
        </div>
      </motion.div>
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
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId(getSessionId());
    const savedTheme = localStorage.getItem("app_theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "dark") document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    if (sessionId) refreshDocuments();
  }, [sessionId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("app_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

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
      className="flex flex-col h-screen w-full bg-[var(--bg-warm)] text-[var(--text-primary)] overflow-hidden relative font-sans transition-colors duration-300"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {/* 3D Tom & Jerry Floating Background */}
      <TomAndJerry3DBackground />

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
            className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--bg-card)]/95 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-5 bg-[var(--accent-blue-light)] rounded-full animate-bounce">
                <FileUp className="h-10 w-10 text-[var(--accent-blue)]" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">
                Drop your PDF to index it
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Text, figures, and captions will be extracted and indexed
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SLIM TOP BAR ─── */}
      <header className="h-12 shrink-0 border-b border-[var(--border-soft)] bg-[var(--bg-card)]/80 backdrop-blur-md flex items-center justify-between px-5 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2383e2] to-[#6366f1] flex items-center justify-center shadow-xs">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-[var(--text-primary)] text-sm tracking-tight flex items-center gap-1.5">
            Multimodal RAG <span className="text-xs text-amber-500 font-mono">🐱🧀</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-[var(--bg-warm)] hover:bg-[var(--border-soft)] border border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer flex items-center gap-1 text-xs"
            title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
          >
            {theme === "light" ? (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-500" />
                <span className="hidden sm:inline font-medium">Dark</span>
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline font-medium">Light</span>
              </>
            )}
          </button>

          {/* Document Drawer Toggle */}
          <button
            onClick={() => setShowDocDrawer((d) => !d)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-warm)] hover:bg-[var(--border-soft)] border border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Docs ({documents.length})</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${showDocDrawer ? "rotate-180" : ""}`} />
          </button>
        </div>
      </header>

      {/* ─── DOCUMENT DRAWER (slides down from top bar) ─── */}
      <AnimatePresence>
        {showDocDrawer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-[var(--bg-drawer)] border-b border-[var(--border-soft)] z-20 shrink-0 shadow-md"
          >
            <div className="max-w-2xl mx-auto p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Indexed PDFs — select which to search
                </span>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold transition cursor-pointer"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Upload PDF
                </button>
              </div>

              {documents.length === 0 ? (
                <div
                  onClick={() => setShowUploadModal(true)}
                  className="p-6 rounded-xl border-2 border-dashed border-[var(--border-soft)] hover:border-[var(--accent-blue)] flex flex-col items-center gap-2 cursor-pointer transition"
                >
                  <FileUp className="h-6 w-6 text-[var(--text-muted)]" />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">
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
                            ? "bg-[var(--accent-blue-light)] border-[var(--accent-blue)]/40"
                            : "bg-[var(--bg-warm)] border-[var(--border-soft)] hover:opacity-90"
                        }`}
                        onClick={() => toggleDoc(doc.doc_name)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
                              selected
                                ? "bg-[var(--accent-blue)] border-[var(--accent-blue)]"
                                : "bg-[var(--bg-card)] border-[var(--text-muted)]"
                            }`}
                          >
                            {selected && (
                              <Check className="h-2.5 w-2.5 text-white stroke-[3]" />
                            )}
                          </div>
                          <FileText className="h-4 w-4 text-[var(--accent-blue)] shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {doc.doc_name}
                          </span>
                          {doc.scanned_warning && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium shrink-0">
                              Low text
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDoc(doc.doc_name);
                          }}
                          className="p-1 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition"
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
      <div className="flex-1 flex flex-col overflow-hidden z-10">
        {/* ─── CHAT MESSAGES (scrollable) ─── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            {/* Landing state — shown when no messages */}
            {!hasMessages && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center pt-[10vh] pb-8 text-center"
              >
                {/* 3D Animated Hero Icon */}
                <motion.div
                  animate={{ rotateY: [-10, 10, -10], y: [-4, 4, -4] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2383e2] to-[#6366f1] flex items-center justify-center mb-6 shadow-xl relative group cursor-pointer"
                >
                  <Sparkles className="h-8 w-8 text-white group-hover:rotate-12 transition-transform" />
                  <span className="absolute -top-2 -right-2 text-xl animate-bounce">🧀</span>
                </motion.div>

                <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] mb-2">
                  Ask your documents anything
                </h1>
                <p className="text-base text-[var(--text-secondary)] max-w-md leading-relaxed">
                  Upload PDFs, then ask questions. Tom & Jerry multimodal RAG retrieves relevant text
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
                      className="px-4 py-2 rounded-full border border-[var(--border-soft)] bg-[var(--bg-card)] hover:border-[var(--accent-blue)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer shadow-xs"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {documents.length === 0 && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="mt-8 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-blue)] hover:opacity-90 text-white font-semibold text-sm transition cursor-pointer shadow-md"
                  >
                    <FileUp className="h-4 w-4" />
                    Upload your first PDF
                  </button>
                )}
              </motion.div>
            )}

            {/* Message list */}
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`mb-6 ${
                    msg.sender === "user" ? "flex justify-end" : ""
                  }`}
                >
                  {msg.sender === "user" ? (
                    /* ── USER BUBBLE ── */
                    <div className="max-w-[80%] bg-[var(--accent-blue)] text-white px-5 py-3 rounded-2xl rounded-br-md shadow-sm">
                      <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    </div>
                  ) : (
                    /* ── ASSISTANT RESPONSE ── */
                    <div className="max-w-full">
                      {/* AI label */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#2383e2] to-[#6366f1] flex items-center justify-center">
                          <Sparkles className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1">
                          AI · {msg.timestamp}
                        </span>
                      </div>

                      {/* Response card */}
                      <div className="bg-[var(--bg-card)] rounded-2xl rounded-tl-md border border-[var(--border-soft)] px-5 py-4 shadow-sm">
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
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#2383e2] to-[#6366f1] flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
                <div className="bg-[var(--bg-card)] rounded-2xl rounded-tl-md border border-[var(--border-soft)] px-5 py-3.5 shadow-sm flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="thinking-dot w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
                    <span className="thinking-dot w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
                    <span className="thinking-dot w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
                  </div>
                  <span className="text-sm text-[var(--text-secondary)] font-medium">
                    Searching documents & generating answer…
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={chatBottomRef} />
          </div>
        </div>

        {/* ─── INPUT BAR (always visible at bottom) ─── */}
        <div className="shrink-0 border-t border-[var(--border-soft)] bg-[var(--bg-card)]/80 backdrop-blur-md">
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
            {/* Attached doc badges */}
            {documents.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                  Searching:
                </span>
                {selectedDocs.length === 0 ? (
                  <span className="text-[11px] text-amber-500 flex items-center gap-1">
                    <Info className="h-3 w-3" /> No docs selected
                  </span>
                ) : (
                  selectedDocs.map((doc) => (
                    <span
                      key={doc}
                      className="inline-flex items-center gap-1 bg-[var(--accent-blue-light)] text-[var(--accent-blue)] rounded-md px-2 py-0.5 text-[11px] font-medium"
                    >
                      <FileText className="h-3 w-3" />
                      <span className="truncate max-w-[120px]">{doc}</span>
                      <button
                        onClick={() => toggleDoc(doc)}
                        className="opacity-70 hover:opacity-100 ml-0.5"
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
              <div className="flex-1 flex items-center bg-[var(--input-bg)] border border-[var(--border-soft)] rounded-2xl focus-within:border-[var(--accent-blue)] focus-within:ring-2 focus-within:ring-[var(--accent-blue)]/15 transition pl-1 pr-1.5">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="p-2.5 text-[var(--text-muted)] hover:text-[var(--accent-blue)] rounded-xl hover:bg-[var(--accent-blue-light)] transition cursor-pointer"
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
                  className="flex-1 bg-transparent py-3 px-2 border-none outline-none focus:ring-0 text-[var(--text-primary)] text-[0.9375rem] placeholder:text-[var(--text-muted)] min-w-0"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                    inputText.trim() && !isLoading
                      ? "bg-[var(--accent-blue)] hover:opacity-90 text-white cursor-pointer shadow-sm"
                      : "bg-[var(--border-soft)] text-[var(--text-muted)] cursor-not-allowed"
                  }`}
                >
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            </form>

            <p className="text-center text-[11px] text-[var(--text-muted)]">
              Answers are grounded in your uploaded documents using Multimodal RAG
            </p>
          </div>
        </div>
      </div>

      {/* ─── UPLOAD MODAL ─── */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--bg-card)] rounded-2xl shadow-xl w-full max-w-md border border-[var(--border-soft)] overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between p-5 border-b border-[var(--border-soft)]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[var(--accent-blue-light)] text-[var(--accent-blue)] rounded-xl">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)]">Upload PDF</h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Extract text & figures for RAG indexing
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadError(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-warm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-5 space-y-4">
                {uploadError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border-soft)] hover:border-[var(--accent-blue)] rounded-2xl p-10 flex flex-col items-center text-center cursor-pointer hover:bg-[var(--accent-blue-light)]/20 transition group"
                >
                  <div className="p-4 bg-[var(--accent-blue-light)] rounded-full text-[var(--accent-blue)] group-hover:scale-110 transition-transform mb-3">
                    <FileUp className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Click to select or drag & drop
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    PDF files up to 100 pages
                  </p>
                </div>

                {isUploading && (
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-[var(--accent-blue)] py-2">
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
                    className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-warm)] transition cursor-pointer"
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
