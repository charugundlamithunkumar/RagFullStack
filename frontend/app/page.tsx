"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  Paperclip,
  ArrowUp,
  FileText,
  Trash2,
  Plus,
  X,
  Database,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  FileUp,
  Info,
  Loader2
} from "lucide-react";
import { getSessionId } from "@/lib/session";
import { listDocuments, uploadDocument, deleteDocument, askQuestion } from "@/lib/api";
import type { DocumentInfo, ChatMessage } from "@/lib/types";
import FigureGallery from "@/components/FigureGallery";
import DebugPanel from "@/components/DebugPanel";

export default function Page() {
  const [sessionId, setSessionId] = useState<string>("");
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize session and default demonstration chat
  useEffect(() => {
    const id = getSessionId();
    setSessionId(id);
    initializeDefaultChat();
  }, []);

  // Refresh document list on session ready
  useEffect(() => {
    if (sessionId) {
      refreshDocuments();
    }
  }, [sessionId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const refreshDocuments = async () => {
    if (!sessionId) return;
    try {
      const docs = await listDocuments(sessionId);
      setDocuments(docs);
      // Select all uploaded documents by default
      setSelectedDocs(docs.map((d) => d.doc_name));
    } catch (err) {
      console.error("Failed to fetch document list:", err);
    }
  };

  const initializeDefaultChat = () => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages([
      {
        id: "msg-welcome-1",
        sender: "user",
        text: "What are the core features of this Multimodal RAG system?",
        timestamp: time
      },
      {
        id: "msg-welcome-2",
        sender: "assistant",
        text: `Welcome to the **Knowledge Workspace** powered by Multimodal RAG!

Here is how your second brain operates:
1. **Document Ingestion & Indexing**: PDF text is chunked and indexed with FAISS; figures are extracted & embedded with OpenAI CLIP.
2. **Agentic Router**: Query router determines which documents are relevant to keep context tight.
3. **Hybrid Search & RRF Fusion**: Text & figure vectors are searched in parallel and fused with Reciprocal Rank Fusion (RRF).
4. **Cross-Modality Reranking**: Context is sorted and reranked to pass the top grounded chunks to Groq generation.`,
        timestamp: time
      }
    ]);
  };

  const toggleDocSelection = (docName: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docName) ? prev.filter((d) => d !== docName) : [...prev, docName]
    );
  };

  const handleDeleteDocument = async (docName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDocument(sessionId, docName);
      await refreshDocuments();
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file || !sessionId) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only .pdf files are supported for multimodal ingestion.");
      setIsUploadModalOpen(true);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(sessionId, file);
      await refreshDocuments();
      setIsUploadModalOpen(false);
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to process and index PDF.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userQuery = inputText.trim();
    setInputText("");

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: userQuery,
      timestamp: time
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await askQuestion(sessionId, userQuery, selectedDocs);
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        response: res
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "assistant",
          text: `⚠️ **API Error**: ${err.message || "Failed to reach backend server."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const renderFormattedMarkdown = (text: string) => {
    return text.split("\n\n").map((block, bIdx) => {
      const trimmed = block.trim();
      if (/^\d+\.\s/.test(trimmed)) {
        const lines = block.split("\n");
        return (
          <ol key={bIdx} className="list-decimal pl-5 space-y-1.5 my-2 text-slate-700">
            {lines.map((line, lIdx) => (
              <li key={lIdx} className="text-sm leading-relaxed">
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
              <li key={lIdx} className="text-sm leading-relaxed">
                {renderInlineFormatting(line.replace(/^[-*]\s+/, ""))}
              </li>
            ))}
          </ul>
        );
      }
      return (
        <p key={bIdx} className="text-sm leading-relaxed my-2">
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
    <div
      className="relative flex flex-col h-screen w-full overflow-hidden bg-[#fafaf9] text-[#1a1a1a] font-sans antialiased"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {/* MESH BACKGROUND */}
      <div className="absolute inset-0 mesh-bg z-0 pointer-events-none"></div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".pdf"
        className="hidden"
      />

      {/* DRAG AND DROP OVERLAY */}
      <AnimatePresence>
        {dragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md text-slate-800 pointer-events-none"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-indigo-50 border border-indigo-100 p-6 animate-bounce shadow-xs">
                <FileUp className="h-12 w-12 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                Drop your PDF file to index it
              </h3>
              <p className="text-slate-500 text-sm">
                Extracts text, associates figure captions, and builds FAISS/CLIP indexes
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP NAVIGATION / NAVBAR */}
      <header className="h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center space-x-3">
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-lg p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Show Knowledge Base"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center font-bold text-base text-white shadow-sm font-mono">
              N
            </div>
            <span className="text-base md:text-lg font-semibold tracking-tight text-slate-800">
              Knowledge <span className="font-light text-slate-500 italic">Workspace</span>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Clear History
            </button>
          )}
          <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
            MM
          </div>
        </div>
      </header>

      {/* CORE WORKSPACE LAYOUT */}
      <div className="flex-1 flex p-4 md:p-6 gap-4 md:gap-6 z-10 overflow-hidden relative">
        {/* LEFT SIDEBAR: KNOWLEDGE BASE MANAGEMENT */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative flex flex-col h-full shrink-0 overflow-hidden z-10"
            >
              <div className="bg-[#f7f7f5]/90 border border-[#e9e9e6] p-5 rounded-2xl flex flex-col gap-4 h-full overflow-hidden shadow-xs backdrop-blur-md">
                {/* Sidebar Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/50">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4.5 w-4.5 text-indigo-600" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-700">
                      Knowledge Base
                    </span>
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="rounded-lg p-1 hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                    title="Hide sidebar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Grounding Info Status Block */}
                <div className="rounded-xl border border-indigo-100/80 bg-indigo-50/40 p-3.5 flex items-start space-x-2.5 shadow-xs">
                  <Sparkles className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-indigo-900">Multimodal RAG Active</h3>
                    <p className="text-[11px] text-indigo-800 leading-normal">
                      Queries are grounded against active document chunks using RRF vector retrieval & figure extraction.
                    </p>
                  </div>
                </div>

                {/* Document List Header */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                    Workspace Documents ({documents.length})
                  </span>
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add PDF</span>
                  </button>
                </div>

                {/* List of Documents */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center bg-white/40 rounded-xl border border-dashed border-slate-200">
                      <FileText className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-xs text-slate-500 font-medium">No documents uploaded yet</p>
                      <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        + Upload a PDF file
                      </button>
                    </div>
                  ) : (
                    documents.map((doc) => {
                      const isSelected = selectedDocs.includes(doc.doc_name);
                      return (
                        <div
                          key={doc.doc_name}
                          onClick={() => toggleDocSelection(doc.doc_name)}
                          className={`group relative flex items-start p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-white border-indigo-400 shadow-sm active-indicator"
                              : "bg-white/40 border-slate-200/60 hover:bg-white hover:border-slate-300 hover:shadow-xs"
                          }`}
                        >
                          <div className="flex items-center h-5 mr-3 mt-0.5">
                            <div
                              className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                                isSelected
                                  ? "border-indigo-500 bg-indigo-500 text-white"
                                  : "border-slate-300 bg-white group-hover:border-slate-400"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 pr-6">
                            <p className="font-semibold text-slate-800 text-[13px] truncate leading-tight">
                              {doc.doc_name}
                            </p>
                            <div className="flex items-center space-x-1.5 mt-1">
                              <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                                PDF
                              </span>
                              {doc.scanned_warning && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                                  Scanned Warning
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleDeleteDocument(doc.doc_name, e)}
                            className="absolute right-2 top-2.5 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Delete document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer System Status */}
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                  <span>FastAPI + Next.js</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-semibold text-emerald-600">PIPELINE ONLINE</span>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* RIGHT SECTION: CHAT PANELS & INPUT */}
        <section className="flex-1 flex flex-col gap-4 md:gap-6 h-full overflow-hidden z-10">
          {/* Header Hero Feature Banner */}
          <div className="bg-white border border-slate-200/85 rounded-3xl p-6 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs shrink-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/40 rounded-full blur-3xl pointer-events-none"></div>
            <div className="z-10">
              <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] uppercase tracking-wider font-semibold text-indigo-600">
                🚀 Multimodal RAG Engine
              </span>
              <h2 className="text-xl md:text-2xl font-light tracking-tight mt-2 text-slate-900">
                Think, write, & <span className="font-semibold text-indigo-600">synthesize</span>
              </h2>
              <p className="text-xs text-slate-500 max-w-lg mt-1 leading-relaxed">
                Ground your queries across active PDF document text & figures. Select files in the sidebar and ask detailed questions.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-bold text-emerald-600 tracking-wider">
                ACTIVE PIPELINE
              </span>
            </div>
          </div>

          {/* CHAT CHRONICLE FEED AREA */}
          <div className="flex-1 bg-white border border-slate-200/80 rounded-3xl p-4 md:p-6 flex flex-col overflow-y-auto space-y-6 shadow-xs">
            <div className="max-w-3xl mx-auto w-full space-y-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="rounded-2xl bg-indigo-50 border border-indigo-100/50 p-4 mb-4 shadow-sm active-indicator">
                    <Sparkles className="h-8 w-8 text-indigo-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    What do you want to analyze?
                  </h3>
                  <p className="text-slate-500 text-sm max-w-sm mt-1 leading-normal">
                    Select uploaded PDF files from the knowledge list and ask questions grounded in text & figures.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                    <button
                      onClick={() => setInputText("What are the key findings of this paper?")}
                      className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 px-3.5 rounded-full transition cursor-pointer"
                    >
                      "Key findings?"
                    </button>
                    <button
                      onClick={() => setInputText("Explain the figures and diagrams in the document.")}
                      className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 px-3.5 rounded-full transition cursor-pointer"
                    >
                      "Explain figures & diagrams"
                    </button>
                    <button
                      onClick={() => setIsUploadModalOpen(true)}
                      className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 font-semibold py-2 px-3.5 rounded-full transition cursor-pointer"
                    >
                      + Add PDF Document
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl p-4 shadow-xs ${
                        msg.sender === "user"
                          ? "bg-slate-900 text-white rounded-tr-none border border-slate-950"
                          : "bg-slate-50 text-slate-800 rounded-tl-none border border-slate-200/80"
                      }`}
                    >
                      {msg.sender === "user" ? (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {renderFormattedMarkdown(msg.text)}

                          {/* Figure Gallery */}
                          {msg.response?.figure_urls && msg.response.figure_urls.length > 0 && (
                            <FigureGallery figureUrls={msg.response.figure_urls} />
                          )}

                          {/* Debug Inspector Panel */}
                          {msg.response?.debug_chunks && (
                            <DebugPanel
                              routedDocs={msg.response.routed_docs || []}
                              debugChunks={msg.response.debug_chunks || []}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 font-medium mt-1 mx-1.5 flex items-center space-x-1">
                      <Clock className="h-2.5 w-2.5 text-slate-300" />
                      <span>{msg.timestamp}</span>
                    </span>
                  </div>
                ))
              )}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex flex-col items-start">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl rounded-tl-none p-4 shadow-xs">
                    <div className="flex items-center space-x-2 text-xs text-slate-600">
                      <Sparkles className="h-4 w-4 text-indigo-500 animate-spin" />
                      <span>Retrieving multimodal context & synthesizing response...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>
          </div>

          {/* INPUT CONTROLS BOTTOM PANEL */}
          <div className="bg-white border border-slate-200/85 rounded-3xl p-4 shrink-0 shadow-xs">
            <div className="max-w-3xl mx-auto space-y-2">
              {/* Attached Context Badges */}
              <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
                {selectedDocs.length > 0 ? (
                  <>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">
                      Attached context ({selectedDocs.length}):
                    </span>
                    {selectedDocs.map((doc) => (
                      <div
                        key={doc}
                        className="inline-flex items-center space-x-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg px-2.5 py-1 text-xs text-slate-700 transition"
                      >
                        <FileText className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="font-semibold truncate max-w-[180px]">{doc}</span>
                        <button
                          onClick={() => toggleDocSelection(doc)}
                          className="text-slate-400 hover:text-slate-600 ml-1 p-0.5 rounded hover:bg-slate-200 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400 flex items-center italic">
                    <Info className="h-3.5 w-3.5 mr-1 text-slate-400" /> No document context attached. Select files in the sidebar.
                  </span>
                )}
              </div>

              {/* Input Form Pill */}
              <form onSubmit={handleSendMessage} className="relative flex items-center">
                <div className="relative flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-full shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition pr-2 pl-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 -ml-1 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-slate-100 transition cursor-pointer shrink-0"
                    title="Upload PDF document"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Ask a question across selected documents..."
                    disabled={isLoading}
                    className="flex-1 bg-transparent py-3.5 px-3 border-none outline-none focus:ring-0 text-slate-800 text-sm placeholder:text-slate-400 min-w-0"
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim() || isLoading}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition ${
                      inputText.trim() && !isLoading
                        ? "bg-indigo-600 hover:bg-indigo-500 hover:scale-105 cursor-pointer shadow-xs"
                        : "bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200"
                    }`}
                  >
                    <ArrowUp className="h-5 w-5 stroke-[2.5]" />
                  </button>
                </div>
              </form>
              <p className="text-[10px] text-slate-400 font-medium text-center">
                Grounded responses derived strictly from active PDF documents using RRF & Re-ranking.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* UPLOAD DOCUMENT MODAL DIALOG */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Index PDF Document</h3>
                    <p className="text-xs text-slate-500">
                      Upload a PDF to extract text chunks & figures.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {uploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50/20 transition group"
                >
                  <div className="p-4 bg-indigo-50 rounded-full text-indigo-600 group-hover:scale-110 transition-transform mb-3">
                    <FileUp className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Click to select PDF or drag & drop
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Supports PDF files up to 100 pages</p>
                </div>

                {isUploading && (
                  <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-indigo-600 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Ingesting text, figures, and building FAISS indexes...</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
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
