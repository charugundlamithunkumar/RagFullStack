"use client";

import { Menu, Bot, FileText, Plus } from "lucide-react";

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  attachedDocCount: number;
  onOpenUpload: () => void;
}

export default function Header({
  isSidebarOpen,
  onToggleSidebar,
  attachedDocCount,
  onOpenUpload,
}: HeaderProps) {
  return (
    <header className="h-14 border-b border-slate-200/80 bg-white/90 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 text-xs font-sans select-none">
      {/* LEFT BRAND & TOGGLE */}
      <div className="flex items-center space-x-3">
        {!isSidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Open Sidebar"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
        )}
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900 tracking-tight block font-display">
              AI Knowledge Assistant
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT ACTIONS */}
      <div className="flex items-center space-x-3">
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-sky-50 border border-sky-200/80 rounded-lg text-[11px] font-semibold text-sky-800">
          <FileText className="h-3.5 w-3.5 text-sky-600" />
          <span>{attachedDocCount} PDF{attachedDocCount === 1 ? "" : "s"} attached</span>
        </div>

        <button
          onClick={onOpenUpload}
          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Upload PDF</span>
        </button>
      </div>
    </header>
  );
}
