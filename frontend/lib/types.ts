export interface DocumentInfo {
  doc_name: string;
  scanned_warning: boolean;
}

export interface UploadResponse {
  doc_name: string;
  chunk_count: number;
  figure_count: number;
  has_text: boolean;
}

export interface DebugChunk {
  doc_name: string;
  page_number: number | null;
  modality: "text" | "image";
  score: number;
  final_score: number | null;
  pinned: boolean;
  text_preview: string | null;
}

export interface AskResponse {
  answer: string;
  figure_urls: string[];
  guarded: boolean;
  error: string | null;
  routed_docs: string[];
  selected_docs: string[];
  debug_chunks: DebugChunk[];
}

export interface QaTurn {
  question: string;
  result: AskResponse;
}
