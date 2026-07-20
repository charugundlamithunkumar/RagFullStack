"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Search,
  FileText,
  Trash2,
  Plus,
  Bot,
  Users,
  Pause,
  Edit3,
  Check,
  Sparkles,
  BookOpen,
  HelpCircle,
  BarChart2,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import type { DocumentInfo } from "@/lib/types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentInfo[];
  selectedDocs: string[];
  onToggleDoc: (docName: string) => void;
  onDeleteDoc: (docName: string, e: React.MouseEvent) => void;
  onOpenUpload: () => void;
  onOpenCommandK: () => void;
  onNewChat: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  documents,
  selectedDocs,
  onToggleDoc,
  onDeleteDoc,
  onOpenUpload,
  onOpenCommandK,
  onNewChat,
}: SidebarProps) {
  if (!isOpen) return null;

  const agents = [
    { name: "Task routing agent", icon: Bot, bg: "bg-purple-100 text-purple-700" },
    { name: "Q&A agent", icon: HelpCircle, bg: "bg-red-100 text-red-700" },
    { name: "Reporting agent", icon: BarChart2, bg: "bg-amber-100 text-amber-700" },
    { name: "IT help desk", icon: ShieldCheck, bg: "bg-pink-100 text-pink-700" },
    { name: "Onboarding buddy", icon: UserCheck, bg: "bg-blue-100 text-blue-700" },
  ];

  return (
    <motion.aside
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -280, opacity: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 32 }}
      className="w-72 bg-[#f7f7f5] border-r border-[#e8e8e5] flex flex-col h-full shrink-0 select-none text-slate-700 text-xs font-sans relative z-20"
    >
      {/* TOP WORKSPACE HEADER & SEARCH */}
      <div className="p-3 border-b border-[#ecece9] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer hover:bg-slate-200/50 p-1.5 rounded-lg transition">
            <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs font-mono">
              🌙
            </div>
            <span className="font-bold text-sm text-slate-800 tracking-tight font-display">
              Ramp HQ
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              title="Close sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* SEARCH COMMAND BUTTON */}
        <button
          onClick={onOpenCommandK}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/70 border border-[#e3e3df] text-slate-500 hover:text-slate-900 hover:bg-white transition cursor-pointer text-xs shadow-2xs"
        >
          <div className="flex items-center space-x-2">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium">Search & AI...</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            ⌘K
          </span>
        </button>
      </div>

      {/* SCROLLABLE SIDEBAR BODY */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* UPCOMING EVENTS */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1 font-mono">
            Upcoming events
          </span>
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-slate-200/50 transition cursor-pointer text-slate-600">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-sm bg-blue-500"></span>
                <span className="font-medium">Design Weekly</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">10–11AM</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-slate-200/50 transition cursor-pointer text-slate-600">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-sm bg-blue-500"></span>
                <span className="font-medium">Eng Kickoff</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">12–1PM</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-slate-200/50 transition cursor-pointer text-slate-600">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-sm bg-blue-500"></span>
                <span className="font-medium">Product Updates</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">4–5PM</span>
            </div>
          </div>
        </div>

        {/* AGENTS SECTION */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1 font-mono">
            Agents
          </span>
          <div className="space-y-0.5">
            {agents.map((ag, idx) => {
              const Icon = ag.icon;
              return (
                <div
                  key={idx}
                  onClick={onNewChat}
                  className="flex items-center space-x-2 px-2 py-1 rounded-md hover:bg-slate-200/50 transition cursor-pointer text-slate-700 group"
                >
                  <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center ${ag.bg}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <span className="font-medium text-xs group-hover:text-slate-900">
                    {ag.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* WORKSPACE PDF KNOWLEDGE DOCUMENTS */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              Knowledge PDFs ({documents.length})
            </span>
            <button
              onClick={onOpenUpload}
              className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-50 transition cursor-pointer"
              title="Add PDF Document"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            </button>
          </div>

          <div className="space-y-1">
            {documents.length === 0 ? (
              <div
                onClick={onOpenUpload}
                className="p-3 rounded-xl border border-dashed border-slate-300 hover:border-indigo-400 bg-white/50 flex flex-col items-center justify-center text-center cursor-pointer transition"
              >
                <FileText className="h-5 w-5 text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-indigo-600">
                  + Add Knowledge PDF
                </span>
              </div>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedDocs.includes(doc.doc_name);
                return (
                  <div
                    key={doc.doc_name}
                    onClick={() => onToggleDoc(doc.doc_name)}
                    className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                      isSelected
                        ? "bg-white border-indigo-300 text-slate-900 shadow-2xs"
                        : "border-transparent hover:bg-slate-200/50 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 pr-4">
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-slate-300 bg-white group-hover:border-slate-400"
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                      <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <span className="font-medium text-xs truncate">
                        {doc.doc_name}
                      </span>
                    </div>

                    <button
                      onClick={(e) => onDeleteDoc(doc.doc_name, e)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      title="Remove PDF"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TEAMSPACES */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1 font-mono">
            Teamspaces
          </span>
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2 px-2 py-1 rounded-md hover:bg-slate-200/50 transition cursor-pointer text-slate-600">
              <Users className="h-3.5 w-3.5 text-rose-500" />
              <span className="font-medium">Company HQ</span>
            </div>
            <div className="flex items-center space-x-2 px-2 py-1 rounded-md hover:bg-slate-200/50 transition cursor-pointer text-slate-600">
              <BookOpen className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-medium">Product</span>
            </div>
            <div className="flex items-center space-x-2 px-2 py-1 rounded-md hover:bg-slate-200/50 transition cursor-pointer text-slate-600">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              <span className="font-medium">Engineering</span>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING BOTTOM NEW CHAT PILL */}
      <div className="p-3 border-t border-[#ecece9] bg-[#f7f7f5] flex items-center justify-between">
        <button
          onClick={onNewChat}
          className="flex items-center space-x-2 bg-white hover:bg-slate-100 border border-[#e0e0dc] rounded-full px-3 py-1.5 shadow-2xs transition cursor-pointer text-xs font-semibold text-slate-700"
        >
          <Pause className="h-3.5 w-3.5 text-slate-500" />
          <span>New chat</span>
          <span className="font-mono text-[10px] text-slate-400">⌘K</span>
        </button>
        <button
          onClick={onOpenUpload}
          className="p-2 bg-white hover:bg-slate-100 border border-[#e0e0dc] rounded-full shadow-2xs transition cursor-pointer text-slate-600"
          title="Create / Upload Page"
        >
          <Edit3 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.aside>
  );
}
