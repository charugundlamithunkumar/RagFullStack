"use client";

import {
  Menu,
  ChevronRight,
  Share2,
  Star,
  MoreHorizontal,
  Search,
} from "lucide-react";

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeView: "board" | "chat";
  onSelectView: (view: "board" | "chat") => void;
  onOpenCommandK: () => void;
}

export default function Header({
  isSidebarOpen,
  onToggleSidebar,
  activeView,
  onSelectView,
  onOpenCommandK,
}: HeaderProps) {
  return (
    <header className="h-12 border-b border-[#e8e8e5] bg-white/90 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-10 text-xs font-sans select-none">
      {/* LEFT BREADCRUMBS & SIDEBAR TOGGLE */}
      <div className="flex items-center space-x-2">
        {!isSidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Open Sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-center space-x-1.5 text-slate-500 font-medium">
          <span className="cursor-pointer hover:text-slate-800 font-bold text-slate-900 flex items-center gap-1">
            🌙 Ramp HQ
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-slate-700 font-semibold">Workspace Board & Multimodal RAG</span>
        </div>
      </div>

      {/* RIGHT ACTIONS */}
      <div className="flex items-center space-x-3 text-slate-500">
        <button
          onClick={onOpenCommandK}
          className="flex items-center space-x-1 hover:text-slate-800 p-1 rounded hover:bg-slate-100 transition cursor-pointer"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="font-mono text-[10px]">⌘K</span>
        </button>
        <button className="flex items-center space-x-1 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition cursor-pointer font-medium">
          <Share2 className="h-3.5 w-3.5" />
          <span>Share</span>
        </button>
        <button className="p-1 rounded hover:bg-slate-100 hover:text-amber-500 transition cursor-pointer">
          <Star className="h-3.5 w-3.5" />
        </button>
        <button className="p-1 rounded hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
