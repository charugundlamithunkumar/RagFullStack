"""Generate a small synthetic reference PDF for eval/fixtures/, used by
run_eval.py so the ablation table is reproducible against a fixed,
known document (plan section 8e) -- NOT whatever a live demo user
happens to upload.

Per plan pitfall 1: diagrams are rendered as actual raster PNGs (via
matplotlib) and embedded into the PDF, so PyMuPDF's get_images() can
actually find them. Vector-drawn shapes (e.g. reportlab's c.rect())
would NOT be extractable and would silently break figure retrieval.
"""
from __future__ import annotations
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES_DIR = os.path.join(HERE, "fixtures")
OUTPUT_PDF = os.path.join(FIXTURES_DIR, "reference_doc.pdf")


def make_bar_chart(path: str):
    fig, ax = plt.subplots(figsize=(4, 3))
    ax.bar(["A", "B", "C", "D"], [12, 19, 7, 15], color="#4C72B0")
    ax.set_title("Quarterly Widget Output")
    ax.set_ylabel("Units (thousands)")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def make_pipeline_diagram(path: str):
    fig, ax = plt.subplots(figsize=(5, 2.5))
    ax.axis("off")
    stages = ["Ingest", "Index", "Retrieve", "Fuse", "Rerank", "Generate"]
    for i, s in enumerate(stages):
        ax.add_patch(plt.Rectangle((i * 1.6, 0), 1.4, 1, fill=True, color="#55A868"))
        ax.text(i * 1.6 + 0.7, 0.5, s, ha="center", va="center", color="white", fontsize=9)
        if i < len(stages) - 1:
            ax.annotate("", xy=(i * 1.6 + 1.55, 0.5), xytext=(i * 1.6 + 1.4, 0.5),
                        arrowprops=dict(arrowstyle="->"))
    ax.set_xlim(-0.2, len(stages) * 1.6)
    ax.set_ylim(-0.3, 1.3)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def build_pdf():
    os.makedirs(FIXTURES_DIR, exist_ok=True)
    bar_path = os.path.join(FIXTURES_DIR, "_bar_chart.png")
    pipeline_path = os.path.join(FIXTURES_DIR, "_pipeline_diagram.png")
    make_bar_chart(bar_path)
    make_pipeline_diagram(pipeline_path)

    c = canvas.Canvas(OUTPUT_PDF, pagesize=letter)
    width, height = letter

    # Page 1: text + bar chart figure
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, height - 72, "MM-RAG Reference Document")
    c.setFont("Helvetica", 11)
    text_lines_p1 = [
        "This is a synthetic reference document used for evaluating the",
        "MM-RAG retrieval pipeline. It contains both plain text and",
        "embedded raster figures, so retrieval quality can be measured",
        "for both text-only and figure-required questions.",
        "",
        "The manufacturing team tracks quarterly widget output across",
        "four product lines, labeled A through D. Line B produced the",
        "most units this quarter, while Line C lagged behind the others.",
        "Figure 1 shows the full breakdown of quarterly widget output.",
    ]
    y = height - 110
    for line in text_lines_p1:
        c.drawString(72, y, line)
        y -= 16

    c.drawImage(bar_path, 72, y - 220, width=280, height=200)
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(72, y - 232, "Figure 1: Quarterly widget output by product line.")
    c.showPage()

    # Page 2: text + pipeline diagram figure
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, height - 72, "System Architecture")
    c.setFont("Helvetica", 11)
    text_lines_p2 = [
        "The retrieval pipeline processes an uploaded document in six",
        "stages: ingestion, indexing, retrieval, fusion, reranking, and",
        "generation. Each stage is implemented as an importable Python",
        "function so it can run inline during a live upload, rather than",
        "as a batch script tied to a fixed folder on disk.",
        "",
        "Figure 2 below shows this pipeline as a sequence of stages.",
        "Fusion combines the text and image ranked lists using",
        "Reciprocal Rank Fusion with a constant k of 60. Reranking then",
        "applies a cross-encoder to the text candidates only, since no",
        "off-the-shelf cross-encoder exists for text-image pairs at",
        "this scope.",
    ]
    y = height - 110
    for line in text_lines_p2:
        c.drawString(72, y, line)
        y -= 16

    c.drawImage(pipeline_path, 72, y - 150, width=380, height=150)
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(72, y - 162, "Figure 2: The six-stage MM-RAG pipeline.")
    c.showPage()

    c.save()
    print(f"Wrote {OUTPUT_PDF}")


if __name__ == "__main__":
    build_pdf()
