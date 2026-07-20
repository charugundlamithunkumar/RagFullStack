"use client";

import { useState } from "react";
import { figureUrl } from "@/lib/api";
import { Image as ImageIcon, X, Maximize2 } from "lucide-react";

interface FigureGalleryProps {
  figureUrls: string[];
}

export default function FigureGallery({ figureUrls }: FigureGalleryProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);

  if (!figureUrls || figureUrls.length === 0) return null;

  return (
    <div className="mt-4 pt-3.5 border-t border-slate-200/80 space-y-2.5">
      <div className="flex items-center space-x-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-widest">
        <ImageIcon className="h-3.5 w-3.5" />
        <span>Extracted Figures & Diagrams ({figureUrls.length})</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
        {figureUrls.map((url, idx) => {
          const fullUrl = figureUrl(url);
          return (
            <div
              key={idx}
              onClick={() => setActiveImage(fullUrl)}
              className="group relative bg-white hover:bg-slate-50 transition-all rounded-xl p-2.5 flex flex-col border border-slate-200/80 shadow-xs cursor-pointer overflow-hidden"
            >
              <div className="relative aspect-video w-full rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200/50">
                <img
                  src={fullUrl}
                  alt={`Extracted Figure ${idx + 1}`}
                  className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-all flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-xs p-2 rounded-full shadow-md text-slate-800">
                    <Maximize2 className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-[11px] font-semibold text-slate-700">
                  Figure #{idx + 1}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Click to expand
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* LIGHTBOX MODAL */}
      {activeImage && (
        <div
          onClick={() => setActiveImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md cursor-pointer animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white p-3 rounded-2xl max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-700"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-indigo-600" />
                Expanded Figure Diagram View
              </span>
              <button
                onClick={() => setActiveImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-50 rounded-xl p-4 min-h-[300px]">
              <img
                src={activeImage}
                alt="Expanded figure"
                className="max-h-[75vh] max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
