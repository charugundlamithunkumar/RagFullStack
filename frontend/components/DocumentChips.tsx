"use client";

import type { DocumentInfo } from "@/lib/types";

export default function DocumentChips({
  documents,
  selected,
  onToggle,
  onRemove,
}: {
  documents: DocumentInfo[];
  selected: string[];
  onToggle: (docName: string) => void;
  onRemove: (docName: string) => void;
}) {
  if (documents.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">Search within</h2>
      <div className="flex flex-wrap gap-2">
        {documents.map((doc) => {
          const isSelected = selected.includes(doc.doc_name);
          return (
            <span
              key={doc.doc_name}
              className="chip cursor-pointer select-none"
              style={{
                opacity: isSelected ? 1 : 0.45,
                backgroundColor: isSelected ? "#EEF0FE" : "#F3F4F6",
              }}
              onClick={() => onToggle(doc.doc_name)}
            >
              {doc.doc_name}
              {doc.scanned_warning && <span title="Scanned/low-text PDF">⚠</span>}
              <button
                aria-label={`Remove ${doc.doc_name}`}
                className="ml-1 text-xs opacity-70 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(doc.doc_name);
                }}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
