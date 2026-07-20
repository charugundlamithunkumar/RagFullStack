"use client";

import Image from "next/image";
import { figureUrl } from "@/lib/api";

export default function FigureGallery({ figureUrls }: { figureUrls: string[] }) {
  if (figureUrls.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {figureUrls.map((path) => (
        <Image
          key={path}
          src={figureUrl(path)}
          alt="Retrieved figure"
          width={280}
          height={280}
          className="rounded-lg border border-gray-200 object-contain"
          unoptimized
        />
      ))}
    </div>
  );
}
