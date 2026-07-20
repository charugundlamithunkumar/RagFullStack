import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knowledge Workspace — Multimodal RAG",
  description: "Upload PDFs, analyze documents, and ask questions grounded in text and figures with AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen w-full overflow-hidden bg-[#fafaf9] text-[#1a1a1a] antialiased">
        {children}
      </body>
    </html>
  );
}
