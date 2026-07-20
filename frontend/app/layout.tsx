import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MM-RAG — Multimodal Document Q&A",
  description: "Upload PDFs, ask questions, get answers grounded in text and figures.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="max-w-4xl mx-auto px-6 py-10">{children}</body>
    </html>
  );
}
