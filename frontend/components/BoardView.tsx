"use client";

import React from "react";
import { motion } from "framer-motion";
import { Plus, FileText } from "lucide-react";
import type { DocumentInfo } from "@/lib/types";

interface BoardViewProps {
  documents: DocumentInfo[];
  selectedDocs: string[];
  onToggleDoc: (docName: string) => void;
  onOpenUpload: () => void;
  onAskDocQuery: (query: string) => void;
}

export default function BoardView({
  documents,
  selectedDocs,
  onToggleDoc,
  onOpenUpload,
  onAskDocQuery,
}: BoardViewProps) {
  const todoCards = [
    { id: "t1", title: "Review performance metrics", sticker: "⏰" },
    { id: "t2", title: "Respond to beta test questions" },
    { id: "t3", title: "Plan upcoming sprint goals", sticker: "💡" },
    { id: "t4", title: "Update help center and office documentation" },
    { id: "t5", title: "Review campaign assets" },
  ];

  const inProgressCards = [
    { id: "p1", title: "Sales demo sync" },
    { id: "p2", title: "Launch demo video" },
    { id: "p3", title: "Headcount planning", sticker: "💡" },
    { id: "p4", title: "Engineering sync" },
  ];

  const inReviewCards = [
    { id: "r1", title: "Weekly sales status report" },
    { id: "r2", title: "Marketing campaign designs" },
    { id: "r3", title: "Latest features customer emails" },
    { id: "r4", title: "New features documentation" },
  ];

  return (
    <div className="flex-1 overflow-x-auto p-6 flex gap-4 items-start select-none font-sans">
      {/* COLUMN 1: TO-DO */}
      <div className="w-72 bg-[#f9f9f8] rounded-2xl p-3 border border-[#ecece9] flex flex-col gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md text-xs font-bold font-mono">
              ● To-do
            </span>
            <span className="text-xs font-semibold text-slate-400 font-mono">
              {todoCards.length + documents.length}
            </span>
          </div>
          <button
            onClick={onOpenUpload}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Uploaded PDF Cards */}
        {documents.map((doc) => {
          const isSelected = selectedDocs.includes(doc.doc_name);
          return (
            <motion.div
              key={doc.doc_name}
              whileHover={{ y: -2 }}
              onClick={() => onToggleDoc(doc.doc_name)}
              className={`p-3 rounded-xl border bg-white shadow-2xs transition cursor-pointer relative ${
                isSelected ? "border-indigo-400 ring-2 ring-indigo-500/10" : "border-slate-200/80"
              }`}
            >
              <div className="flex items-start space-x-2.5">
                <FileText className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 leading-tight">
                    {doc.doc_name}
                  </h4>
                  <span className="inline-block mt-1 text-[10px] text-slate-400 font-mono">
                    PDF Document • {isSelected ? "Attached to AI" : "Click to attach"}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}

        {todoCards.map((c) => (
          <motion.div
            key={c.id}
            whileHover={{ y: -2 }}
            onClick={() => onAskDocQuery(`Tell me about: ${c.title}`)}
            className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs transition cursor-pointer relative"
          >
            <span className="text-xs font-medium text-slate-700 leading-normal block">
              {c.title}
            </span>
            {c.sticker && (
              <span className="absolute -left-2 top-2 w-6 h-6 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-xs shadow-xs animate-bounce">
                {c.sticker}
              </span>
            )}
          </motion.div>
        ))}

        <button
          onClick={onOpenUpload}
          className="flex items-center space-x-1.5 p-2 text-xs font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>+ Upload PDF page</span>
        </button>
      </div>

      {/* COLUMN 2: IN PROGRESS */}
      <div className="w-72 bg-[#f9f9f8] rounded-2xl p-3 border border-[#ecece9] flex flex-col gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-xs font-bold font-mono">
              ● In progress
            </span>
            <span className="text-xs font-semibold text-slate-400 font-mono">
              {inProgressCards.length}
            </span>
          </div>
          <button className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded transition cursor-pointer">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {inProgressCards.map((c) => (
          <motion.div
            key={c.id}
            whileHover={{ y: -2 }}
            onClick={() => onAskDocQuery(`Give an update on: ${c.title}`)}
            className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs transition cursor-pointer relative"
          >
            <span className="text-xs font-medium text-slate-700 leading-normal block">
              {c.title}
            </span>
            {c.sticker && (
              <span className="absolute -right-2 -bottom-2 w-7 h-7 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-xs shadow-xs">
                {c.sticker}
              </span>
            )}
          </motion.div>
        ))}

        <button
          onClick={() => onAskDocQuery("What tasks are currently in progress?")}
          className="flex items-center space-x-1.5 p-2 text-xs font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>+ New task</span>
        </button>
      </div>

      {/* COLUMN 3: IN REVIEW */}
      <div className="w-72 bg-[#f9f9f8] rounded-2xl p-3 border border-[#ecece9] flex flex-col gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-xs font-bold font-mono">
              ● In review
            </span>
            <span className="text-xs font-semibold text-slate-400 font-mono">
              {inReviewCards.length}
            </span>
          </div>
          <button className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded transition cursor-pointer">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {inReviewCards.map((c) => (
          <motion.div
            key={c.id}
            whileHover={{ y: -2 }}
            onClick={() => onAskDocQuery(`Review details for: ${c.title}`)}
            className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs transition cursor-pointer"
          >
            <span className="text-xs font-medium text-slate-700 leading-normal block">
              {c.title}
            </span>
          </motion.div>
        ))}

        <button
          onClick={() => onAskDocQuery("Summarize items currently in review.")}
          className="flex items-center space-x-1.5 p-2 text-xs font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>+ New page</span>
        </button>
      </div>

      {/* COLUMN 4: COMPLETE */}
      <div className="w-72 bg-[#f9f9f8] rounded-2xl p-3 border border-[#ecece9] flex flex-col gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-xs font-bold font-mono">
              ● Complete
            </span>
            <span className="text-xs font-semibold text-slate-400 font-mono">34</span>
          </div>
        </div>

        <motion.div
          whileHover={{ y: -2 }}
          className="p-3 rounded-xl border border-slate-200/80 bg-white shadow-2xs"
        >
          <span className="text-xs font-medium text-slate-700 block">Project onboarding</span>
        </motion.div>
        <motion.div
          whileHover={{ y: -2 }}
          className="p-3 rounded-xl border border-slate-200/80 bg-white shadow-2xs"
        >
          <span className="text-xs font-medium text-slate-700 block">Finalize launch timeline</span>
        </motion.div>
        <motion.div
          whileHover={{ y: -2 }}
          className="p-3 rounded-xl border border-slate-200/80 bg-white shadow-2xs"
        >
          <span className="text-xs font-medium text-slate-700 block">Report daily performance summaries</span>
        </motion.div>
      </div>
    </div>
  );
}
