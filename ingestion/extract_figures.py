"""Extract embedded raster figures from a PDF using PyMuPDF.

Known limitation (see plan section 7, pitfall 1): this only finds
EMBEDDED RASTER images via page.get_images(). Vector-drawn diagrams
(shapes drawn directly on the PDF canvas, e.g. ReportLab's c.rect()/
c.line()) are invisible to this extraction. That's a documented,
explainable limitation, not a bug to silently work around with a
full-page-render fallback (which would just index whole text pages as
"figures" and defeat the point of multimodal retrieval).
"""
from __future__ import annotations
import io
import os
import fitz  # PyMuPDF
from PIL import Image

MIN_DIMENSION_PX = 100


def extract_figures_from_pdf(
    pdf_path: str,
    output_dir: str,
    max_pages: int = 100,
) -> list[dict]:
    """
    Extract embedded raster images from a PDF, skipping tiny images
    (icons/bullets/logos) below MIN_DIMENSION_PX in either dimension.

    Writes each kept figure to output_dir as a PNG and returns a list of:
        - "figure_id": str, unique within this document
        - "image_path": str, path to the saved PNG
        - "page_number": int (1-indexed)
        - "width_px", "height_px": int
    """
    os.makedirs(output_dir, exist_ok=True)
    figures: list[dict] = []
    figure_counter = 0

    doc = fitz.open(pdf_path)
    n_pages = min(len(doc), max_pages)

    for page_index in range(n_pages):
        page = doc[page_index]
        page_number = page_index + 1
        image_list = page.get_images(full=True)

        for img in image_list:
            xref = img[0]
            try:
                base_image = doc.extract_image(xref)
            except Exception:
                continue
            image_bytes = base_image.get("image")
            if not image_bytes:
                continue

            try:
                pil_img = Image.open(io.BytesIO(image_bytes))
                width, height = pil_img.size
            except Exception:
                continue

            if width < MIN_DIMENSION_PX or height < MIN_DIMENSION_PX:
                continue  # skip icons/bullets

            figure_counter += 1
            figure_id = f"figure_{figure_counter}"
            out_path = os.path.join(output_dir, f"{figure_id}.png")
            try:
                pil_img.convert("RGB").save(out_path, "PNG")
            except Exception:
                continue

            figures.append(
                {
                    "figure_id": figure_id,
                    "image_path": out_path,
                    "page_number": page_number,
                    "width_px": width,
                    "height_px": height,
                }
            )

    doc.close()
    return figures
