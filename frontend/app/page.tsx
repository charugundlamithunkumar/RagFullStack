"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, X, AlertCircle, FileUp, Loader2, ArrowUp, Paperclip,
  Trash2, Check, Image as ImageIcon, Maximize2, ChevronDown, ChevronUp,
  Layers, Pin, Info, Sun, Moon, Sparkles,
} from "lucide-react";
import { getSessionId } from "@/lib/session";
import { listDocuments, uploadDocument, deleteDocument, askQuestion, figureUrl } from "@/lib/api";
import type { DocumentInfo, ChatMessage, DebugChunk } from "@/lib/types";

/* ═══════════════════════════════════════════════
   MARKDOWN RENDERER
   ═══════════════════════════════════════════════ */
function RenderMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("#### ")) { elements.push(<h4 key={i}>{inl(line.slice(5))}</h4>); i++; continue; }
    if (line.startsWith("### "))  { elements.push(<h3 key={i}>{inl(line.slice(4))}</h3>); i++; continue; }
    if (line.startsWith("## "))   { elements.push(<h2 key={i}>{inl(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith("# "))    { elements.push(<h1 key={i}>{inl(line.slice(2))}</h1>); i++; continue; }
    if (line.startsWith("```")) {
      const code: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) { code.push(lines[i]); i++; }
      i++; elements.push(<pre key={`c${i}`}><code>{code.join("\n")}</code></pre>); continue;
    }
    if (line.startsWith("> ")) { elements.push(<blockquote key={i}>{inl(line.slice(2))}</blockquote>); i++; continue; }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
      elements.push(<ol key={`ol${i}`}>{items.map((t, j) => <li key={j}>{inl(t)}</li>)}</ol>); continue;
    }
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
      elements.push(<ul key={`ul${i}`}>{items.map((t, j) => <li key={j}>{inl(t)}</li>)}</ul>); continue;
    }
    if (line.trim() === "") { i++; continue; }
    elements.push(<p key={i}>{inl(line)}</p>); i++;
  }
  return <div className="ai-response">{elements}</div>;
}

function inl(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const rx = /(\*\*.*?\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={m.index}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) parts.push(<code key={m.index}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("*")) parts.push(<em key={m.index}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ═══════════════════════════════════════════════
   FIGURE GALLERY
   ═══════════════════════════════════════════════ */
function FigureGallery({ urls }: { urls: string[] }) {
  const [lb, setLb] = useState<string | null>(null);
  if (!urls?.length) return null;
  return (
    <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
      <div className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "var(--accent)" }}>
        <ImageIcon className="h-3.5 w-3.5" /><span>Extracted Figures ({urls.length})</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {urls.map((url, i) => {
          const full = figureUrl(url);
          return (
            <div key={i} onClick={() => setLb(full)}
              className="group relative rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02]"
              style={{ border: "1px solid var(--border-default)", background: "var(--bg-secondary)" }}>
              <div className="aspect-video flex items-center justify-center p-2">
                <img src={full} alt={`Figure ${i+1}`} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full shadow-md" style={{ background: "var(--bg-primary)" }}>
                  <Maximize2 className="h-3.5 w-3.5" style={{ color: "var(--text-primary)" }} />
                </div>
              </div>
              <div className="px-2.5 pb-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>Figure {i+1}</div>
            </div>
          );
        })}
      </div>
      {lb && (
        <div onClick={() => setLb(null)} className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm cursor-pointer">
          <div onClick={e => e.stopPropagation()} className="relative p-3 rounded-2xl max-w-4xl max-h-[90vh] shadow-2xl" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-default)" }}>
            <button onClick={() => setLb(null)} className="absolute top-3 right-3 p-1.5 rounded-lg transition" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
              <X className="h-4 w-4" />
            </button>
            <img src={lb} alt="Expanded" className="max-h-[80vh] max-w-full object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DEBUG PANEL
   ═══════════════════════════════════════════════ */
function DebugPanel({ routedDocs, debugChunks }: { routedDocs: string[]; debugChunks: DebugChunk[] }) {
  const [open, setOpen] = useState(false);
  if (!debugChunks?.length) return null;
  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3.5 py-2.5 transition cursor-pointer" style={{ background: "var(--bg-secondary)" }}>
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--accent)" }}>
          <Layers className="h-3.5 w-3.5" />Retrieval Grounding ({debugChunks.length} chunks)
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {open ? <><span>Hide</span><ChevronUp className="h-3.5 w-3.5" /></> : <><span>Inspect</span><ChevronDown className="h-3.5 w-3.5" /></>}
        </span>
      </button>
      {open && (
        <div className="p-3.5 space-y-3" style={{ background: "var(--bg-primary)", borderTop: "1px solid var(--border-default)" }}>
          {routedDocs.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>Routed Documents</span>
              <div className="flex flex-wrap gap-1.5">
                {routedDocs.map((doc, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                    <FileText className="h-3 w-3" />{doc}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {debugChunks.map((chunk, i) => (
              <div key={i} className="p-2.5 rounded-lg text-xs" style={{ background: chunk.pinned ? "rgba(245,158,11,0.1)" : "var(--bg-secondary)", border: `1px solid ${chunk.pinned ? "rgba(245,158,11,0.3)" : "var(--border-default)"}` }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {chunk.modality === "image" ? <ImageIcon className="h-3.5 w-3.5 text-pink-500 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />}
                    <span className="font-medium truncate">{chunk.doc_name}</span>
                    {chunk.page_number && <span style={{ color: "var(--text-muted)" }} className="text-[11px]">p.{chunk.page_number}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {chunk.pinned && <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-semibold"><Pin className="h-2.5 w-2.5" />Pinned</span>}
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>{chunk.score.toFixed(3)}</span>
                  </div>
                </div>
                {chunk.text_preview && <p className="font-mono text-[11px] p-1.5 rounded mt-1 line-clamp-2" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>&ldquo;{chunk.text_preview}&rdquo;</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */
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
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const initial = saved || "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  useEffect(() => { setSessionId(getSessionId()); }, []);
  useEffect(() => { if (sessionId) refreshDocuments(); }, [sessionId]);
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  const refreshDocuments = async () => {
    if (!sessionId) return;
    try {
      const docs = await listDocuments(sessionId);
      setDocuments(docs);
      setSelectedDocs(docs.map(d => d.doc_name));
    } catch (err) { console.error(err); }
  };

  const toggleDoc = (name: string) => setSelectedDocs(prev => prev.includes(name) ? prev.filter(d => d !== name) : [...prev, name]);

  const handleDeleteDoc = async (name: string) => {
    try { await deleteDocument(sessionId, name); await refreshDocuments(); } catch (err) { console.error(err); }
  };

  const handleUpload = async (file: File) => {
    if (!file || !sessionId) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { setUploadError("Only PDF files are supported."); return; }
    setIsUploading(true); setUploadError(null);
    try { await uploadDocument(sessionId, file); await refreshDocuments(); setShowUploadModal(false); }
    catch (err: any) { setUploadError(err.message || "Upload failed."); }
    finally { setIsUploading(false); }
  };

  const handleDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === "dragenter" || e.type === "dragover"); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) handleUpload(f); };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const query = inputText.trim(); setInputText("");
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, sender: "user", text: query, timestamp: time }]);
    setIsLoading(true);
    try {
      const res = await askQuestion(sessionId, query, selectedDocs);
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, sender: "assistant", text: res.answer, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), response: res }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, sender: "assistant", text: `**Error:** ${err.message || "Failed to reach backend."}`, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    } finally { setIsLoading(false); }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden relative"
      style={{ background: "var(--bg-secondary)" }}
      onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}>

      <input type="file" ref={fileInputRef} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} accept=".pdf" className="hidden" />

      {/* ─── DRAG OVERLAY ─── */}
      <AnimatePresence>
        {dragActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md"
            style={{ background: theme === "dark" ? "rgba(25,25,25,0.95)" : "rgba(247,247,245,0.95)" }}>
            <div className="flex flex-col items-center gap-4">
              <img src="/images/tom-jerry-empty.png" alt="Drop" className="w-44 h-44 object-contain animate-bounce drop-shadow-xl" />
              <h3 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Drop your PDF — Tom & Jerry will index it!</h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Text, figures, and captions will be extracted</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── TOP BAR (Notion-style) ─── */}
      <header className="h-12 shrink-0 flex items-center justify-between px-5 z-10 backdrop-blur-md"
        style={{ background: theme === "dark" ? "rgba(25,25,25,0.85)" : "rgba(255,255,255,0.85)", borderBottom: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-3">
          <img src="/images/tom-jerry-search.png" alt="Logo" className="w-8 h-8 rounded-xl object-cover shadow-sm" style={{ border: "1px solid var(--border-default)" }} />
          <span className="font-bold text-sm tracking-tight" style={{ color: "var(--text-primary)" }}>Multimodal RAG</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>AI Powered</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDocDrawer(d => !d)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
            <FileText className="h-3.5 w-3.5" />
            <span>PDFs ({documents.length})</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${showDocDrawer ? "rotate-180" : ""}`} />
          </button>
          {/* THEME TOGGLE */}
          <button onClick={toggleTheme}
            className="p-2 rounded-xl transition cursor-pointer"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* ─── DOCUMENT DRAWER ─── */}
      <AnimatePresence>
        {showDocDrawer && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden z-10 shrink-0" style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border-default)" }}>
            <div className="max-w-2xl mx-auto p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Indexed PDFs — select which to search</span>
                <button onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                  style={{ background: "var(--accent)", color: "var(--text-inverse)" }}>
                  <FileUp className="h-3.5 w-3.5" />Upload PDF
                </button>
              </div>
              {documents.length === 0 ? (
                <div onClick={() => setShowUploadModal(true)}
                  className="p-6 rounded-xl flex flex-col items-center gap-3 cursor-pointer transition"
                  style={{ border: "2px dashed var(--border-strong)" }}>
                  <img src="/images/tom-jerry-empty.png" alt="No docs" className="w-20 h-20 object-contain opacity-70" />
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No documents yet — click to upload</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {documents.map(doc => {
                    const sel = selectedDocs.includes(doc.doc_name);
                    return (
                      <div key={doc.doc_name} onClick={() => toggleDoc(doc.doc_name)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer"
                        style={{ background: sel ? "var(--accent-bg)" : "var(--bg-secondary)", border: `1px solid ${sel ? "var(--accent)" : "var(--border-default)"}`, opacity: sel ? 1 : 0.8 }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: sel ? "var(--accent)" : "var(--bg-primary)", border: `2px solid ${sel ? "var(--accent)" : "var(--border-strong)"}` }}>
                            {sel && <Check className="h-2.5 w-2.5 stroke-[3]" style={{ color: "var(--text-inverse)" }} />}
                          </div>
                          <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
                          <span className="text-sm font-medium truncate">{doc.doc_name}</span>
                          {doc.scanned_warning && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0">Low text</span>}
                        </div>
                        <button onClick={e => { e.stopPropagation(); handleDeleteDoc(doc.doc_name); }}
                          className="p-1 rounded-md transition" style={{ color: "var(--text-muted)" }} title="Delete">
                          <Trash2 className="h-3.5 w-3.5 hover:text-red-500" />
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

      {/* ─── MAIN CHAT AREA ─── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Tom peeking left */}
        <img src="/images/tom-jerry-left.png" alt="" className="absolute left-0 bottom-20 w-28 opacity-20 pointer-events-none float-slow z-0 hidden lg:block" />
        {/* Jerry peeking right */}
        <img src="/images/tom-jerry-right.png" alt="" className="absolute right-0 bottom-32 w-24 opacity-20 pointer-events-none float-slower z-0 hidden lg:block" />
        {/* Pattern in corner */}
        <img src="/images/tom-jerry-pattern.png" alt="" className="absolute top-0 right-0 w-72 opacity-[0.06] pointer-events-none z-0 hidden md:block" />
        <img src="/images/tom-jerry-pattern.png" alt="" className="absolute bottom-0 left-0 w-72 opacity-[0.06] pointer-events-none z-0 rotate-180 hidden md:block" />

        {/* SCROLLABLE MESSAGES */}
        <div className="flex-1 overflow-y-auto relative z-[1]">
          <div className="max-w-2xl mx-auto px-4 py-6">

            {/* ─── LANDING STATE ─── */}
            {!hasMessages && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="flex flex-col items-center justify-center pt-[6vh] pb-8 text-center">
                {/* Hero image */}
                <motion.img
                  src={theme === "dark" ? "/images/tom-jerry-dark-hero.png" : "/images/tom-jerry-hero.png"}
                  alt="Tom & Jerry" className="w-64 h-64 object-contain mb-6 drop-shadow-xl"
                  initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                />
                <h1 className="text-4xl font-black tracking-tight mb-3" style={{ color: "var(--text-primary)" }}>
                  Ask your documents anything
                </h1>
                <p className="text-base max-w-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Upload PDFs, then ask questions. Tom & Jerry&apos;s AI retrieves relevant text and figures to generate grounded, cited answers.
                </p>

                {/* Floating side images */}
                <div className="relative w-full mt-8 flex items-center justify-center">
                  <img src="/images/tom-jerry-left.png" alt="" className="absolute -left-4 top-0 w-20 opacity-30 float-slow hidden md:block" />
                  <img src="/images/tom-jerry-right.png" alt="" className="absolute -right-4 top-0 w-16 opacity-30 float-slower hidden md:block" />
                  <div className="flex flex-wrap justify-center gap-2.5">
                    {["Summarize the key findings", "What are the main conclusions?", "Extract all figures and charts", "Compare the methodologies"].map(s => (
                      <button key={s} onClick={() => { setInputText(s); inputRef.current?.focus(); }}
                        className="px-4 py-2.5 rounded-2xl text-sm font-medium transition cursor-pointer backdrop-blur-sm"
                        style={{ background: theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {documents.length === 0 && (
                  <button onClick={() => setShowUploadModal(true)}
                    className="mt-8 flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition cursor-pointer shadow-lg hover:shadow-xl hover:scale-[1.02]"
                    style={{ background: "var(--accent)", color: "var(--text-inverse)" }}>
                    <FileUp className="h-4.5 w-4.5" />Upload your first PDF
                  </button>
                )}

                {/* Bottom decoration */}
                <img src="/images/tom-jerry-empty.png" alt="" className="w-24 mt-10 opacity-15 float-slower" />
              </motion.div>
            )}

            {/* ─── MESSAGES ─── */}
            <AnimatePresence>
              {messages.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                  className={`mb-6 ${msg.sender === "user" ? "flex justify-end" : ""}`}>
                  {msg.sender === "user" ? (
                    <div className="max-w-[80%] px-5 py-3 rounded-2xl rounded-br-md shadow-sm"
                      style={{ background: "var(--user-bubble)", color: "#ffffff" }}>
                      <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  ) : (
                    <div className="max-w-full">
                      <div className="flex items-center gap-2 mb-2">
                        <img src="/images/tom-jerry-search.png" alt="AI" className="w-6 h-6 rounded-lg object-cover" style={{ border: "1px solid var(--border-default)" }} />
                        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>AI · {msg.timestamp}</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-md px-5 py-4"
                        style={{ background: "var(--ai-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
                        <RenderMarkdown text={msg.text} />
                        {msg.response?.figure_urls && msg.response.figure_urls.length > 0 && <FigureGallery urls={msg.response.figure_urls} />}
                        {msg.response?.debug_chunks && <DebugPanel routedDocs={msg.response.routed_docs || []} debugChunks={msg.response.debug_chunks} />}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading */}
            {isLoading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mb-6">
                <img src="/images/tom-jerry-search.png" alt="AI" className="w-6 h-6 rounded-lg object-cover animate-pulse" style={{ border: "1px solid var(--border-default)" }} />
                <div className="rounded-2xl rounded-tl-md px-5 py-3.5 flex items-center gap-3"
                  style={{ background: "var(--ai-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
                  <div className="flex gap-1">
                    <span className="thinking-dot w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
                    <span className="thinking-dot w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
                    <span className="thinking-dot w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Searching & generating…</span>
                </div>
              </motion.div>
            )}
            <div ref={chatBottomRef} />
          </div>
        </div>

        {/* ─── INPUT BAR ─── */}
        <div className="shrink-0 relative z-[1] backdrop-blur-md" style={{ borderTop: "1px solid var(--border-default)", background: theme === "dark" ? "rgba(25,25,25,0.85)" : "rgba(255,255,255,0.85)" }}>
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
            {documents.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Searching:</span>
                {selectedDocs.length === 0 ? (
                  <span className="text-[11px] text-amber-600 flex items-center gap-1"><Info className="h-3 w-3" />No docs selected</span>
                ) : selectedDocs.map(doc => (
                  <span key={doc} className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                    <FileText className="h-3 w-3" /><span className="truncate max-w-[120px]">{doc}</span>
                    <button onClick={() => toggleDoc(doc)} className="ml-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <form onSubmit={handleSend} className="relative flex items-center">
              <div className="flex-1 flex items-center rounded-2xl transition pl-1 pr-1.5"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-default)" }}>
                <button type="button" onClick={() => setShowUploadModal(true)}
                  className="p-2.5 rounded-xl transition cursor-pointer" style={{ color: "var(--text-muted)" }} title="Upload PDF">
                  <Paperclip className="h-5 w-5" />
                </button>
                <input ref={inputRef} type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                  placeholder={documents.length === 0 ? "Upload a PDF first, then ask…" : "Ask about your documents…"}
                  disabled={isLoading}
                  className="flex-1 bg-transparent py-3 px-2 border-none outline-none focus:ring-0 text-[0.9375rem] min-w-0"
                  style={{ color: "var(--text-primary)" }} />
                <button type="submit" disabled={!inputText.trim() || isLoading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition"
                  style={{ background: inputText.trim() && !isLoading ? "var(--accent)" : "var(--bg-tertiary)", color: inputText.trim() && !isLoading ? "var(--text-inverse)" : "var(--text-muted)", cursor: inputText.trim() && !isLoading ? "pointer" : "not-allowed" }}>
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            </form>
            <p className="text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
              Answers grounded in your documents via Multimodal RAG · Tom & Jerry Edition 🐱🐭
            </p>
          </div>
        </div>
      </div>

      {/* ─── UPLOAD MODAL ─── */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--border-default)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Upload PDF</h3>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Extract text & figures for RAG indexing</p>
                  </div>
                </div>
                <button onClick={() => { setShowUploadModal(false); setUploadError(null); }}
                  className="p-1.5 rounded-lg transition cursor-pointer" style={{ color: "var(--text-muted)" }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {uploadError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{uploadError}</span>
                  </div>
                )}
                <div onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl p-10 flex flex-col items-center text-center cursor-pointer transition group"
                  style={{ border: "2px dashed var(--border-strong)" }}>
                  <img src="/images/tom-jerry-hero.png" alt="Upload" className="w-24 h-24 object-contain mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Click to select or drag & drop</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>PDF files up to 100 pages</p>
                </div>
                {isUploading && (
                  <div className="flex items-center justify-center gap-2 text-sm font-medium py-2" style={{ color: "var(--accent)" }}>
                    <Loader2 className="h-4 w-4 animate-spin" /><span>Extracting text & figures…</span>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={() => { setShowUploadModal(false); setUploadError(null); }}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer"
                    style={{ color: "var(--text-secondary)" }}>Cancel</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
