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
  LayoutGrid,
} from "lucide-react";
import { getSessionId } from "@/lib/session";
import { listDocuments, uploadDocument, deleteDocument, askQuestion } from "@/lib/api";
import type { DocumentInfo, ChatMessage } from "@/lib/types";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import BoardView from "@/components/BoardView";
import AiChat from "@/components/AiChat";
import CommandKModal from "@/components/CommandKModal";

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
  const [isCommandKOpen, setIsCommandKOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<"board" | "chat">("chat");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = getSessionId();
    setSessionId(id);
    initializeDefaultChat();
  }, []);

  useEffect(() => {
    if (sessionId) {
      refreshDocuments();
    }
  }, [sessionId]);

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

  const initializeDefaultChat = () => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages([
      {
        id: "msg-welcome-1",
        sender: "user",
        text: "What are the key components of a Multimodal RAG system?",
        timestamp: time,
      },
      {
        id: "msg-welcome-2",
        sender: "assistant",
        text: `Welcome to **Ramp HQ AI Workspace**!

A Multimodal RAG (Retrieval-Augmented Generation) system typically includes:
1. **Ingestion & Indexing Pipeline**: Processes documents (PDFs, text, figures) and stores them in a vector database.
2. **Retriever & RRF Fusion**: Finds relevant text & figure chunks based on user query and fuses scores.
3. **Cross-Modality Reranker**: Reranks top candidates to keep grounded context concise.
4. **Generator**: Large Language Model synthesizes the answer, grounding it strictly in retrieved context.`,
        timestamp: time,
      },
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
      timestamp: time,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setActiveView("chat");

    try {
      const res = await askQuestion(sessionId, userQuery, selectedDocs);
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        response: res,
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
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setActiveView("chat");
  };

  const handleAskBoardQuery = (query: string) => {
    setInputText(query);
    setActiveView("chat");
  };

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-[#ffffff] text-[#1a1a1a] font-sans antialiased select-none relative"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
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

      {/* SIDEBAR */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        documents={documents}
        selectedDocs={selectedDocs}
        onToggleDoc={toggleDocSelection}
        onDeleteDoc={handleDeleteDocument}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onOpenCommandK={() => setIsCommandKOpen(true)}
        onNewChat={handleNewChat}
      />

      {/* MAIN WORKSPACE AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {/* TOP HEADER */}
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(true)}
          activeView={activeView}
          onSelectView={setActiveView}
          onOpenCommandK={() => setIsCommandKOpen(true)}
        />

        {/* HERO HEADER */}
        <div className="p-6 pb-2 border-b border-[#ecece9] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-full bg-[#f4f4f2] border border-[#e5e5e2] flex items-center justify-center text-2xl shadow-2xs font-mono">
              🌙
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 font-display">
                Ramp HQ
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                AI Workspace & Multimodal RAG Engine
              </p>
            </div>
          </div>

          {/* VIEW SWITCHER TABS */}
          <div className="flex items-center space-x-1 bg-[#f4f4f2] p-1 rounded-xl border border-[#e5e5e2]">
            <button
              onClick={() => setActiveView("board")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeView === "board"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Company tasks</span>
            </button>

            <button
              onClick={() => setActiveView("chat")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeView === "chat"
                  ? "bg-white text-indigo-600 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              <span>AI Chat</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE VIEW CONTENT */}
        <div className="flex-1 overflow-hidden relative">
          {activeView === "board" ? (
            <BoardView
              documents={documents}
              selectedDocs={selectedDocs}
              onToggleDoc={toggleDocSelection}
              onOpenUpload={() => setIsUploadModalOpen(true)}
              onAskDocQuery={handleAskBoardQuery}
            />
          ) : (
            <AiChat
              messages={messages}
              isLoading={isLoading}
              inputText={inputText}
              setInputText={setInputText}
              onSendMessage={handleSendMessage}
              selectedDocs={selectedDocs}
              documents={documents}
              onToggleDoc={toggleDocSelection}
              onOpenUpload={() => setIsUploadModalOpen(true)}
            />
          )}
        </div>
      </div>

      {/* COMMAND K MODAL */}
      <CommandKModal
        isOpen={isCommandKOpen}
        onClose={() => setIsCommandKOpen(false)}
        documents={documents}
        selectedDocs={selectedDocs}
        onToggleDoc={toggleDocSelection}
        onSelectQuery={handleAskBoardQuery}
        onOpenUpload={() => setIsUploadModalOpen(true)}
      />

      {/* UPLOAD DOCUMENT MODAL */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
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
