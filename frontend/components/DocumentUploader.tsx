"use client";

import { useRef, useState } from "react";
import { uploadDocument } from "@/lib/api";

export default function DocumentUploader({
  sessionId,
  onUploaded,
}: {
  sessionId: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    for (const file of Array.from(files)) {
      try {
        setStatus(`Processing "${file.name}"... this can take 5-30s.`);
        const result = await uploadDocument(sessionId, file);
        setStatus(`Indexed "${result.doc_name}": ${result.chunk_count} chunks, ${result.figure_count} figures.`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      }
    }
    setBusy(false);
    onUploaded();
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <label
        className="flex flex-col items-center justify-center border-2 border-dashed border-[#C7C9F5] rounded-card bg-[#FAFAFB] py-8 cursor-pointer hover:border-accent transition-colors"
      >
        <span className="text-sm text-gray-600">
          {busy ? "Uploading..." : "Click or drop PDF(s) to upload"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          disabled={busy}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {status && !error && <p className="text-sm text-gray-500 mt-2">{status}</p>}
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
    </div>
  );
}
