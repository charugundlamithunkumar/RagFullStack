"""Embed figure images with CLIP (open_clip) and build an in-memory FAISS
index. CLIP's image and text encoders share an embedding space, which is
what lets a plain text query retrieve relevant images -- see
retrieval/search.py, which embeds the query with CLIP's TEXT encoder to
search this index."""
from __future__ import annotations
import numpy as np
import faiss
import torch
import open_clip
from PIL import Image

CLIP_MODEL_NAME = "ViT-B-32"
CLIP_PRETRAINED = "openai"

_clip_cache: dict[str, tuple] = {}


def get_clip_model():
    """Cached loader for the CLIP model, preprocess transform, and tokenizer."""
    key = f"{CLIP_MODEL_NAME}::{CLIP_PRETRAINED}"
    if key not in _clip_cache:
        model, _, preprocess = open_clip.create_model_and_transforms(
            CLIP_MODEL_NAME, pretrained=CLIP_PRETRAINED
        )
        tokenizer = open_clip.get_tokenizer(CLIP_MODEL_NAME)
        model.eval()
        _clip_cache[key] = (model, preprocess, tokenizer)
    return _clip_cache[key]


def embed_and_index_images(figures: list[dict]) -> tuple[faiss.Index | None, list[dict]]:
    """
    Embed each figure's raster image with CLIP's image encoder and build
    a FAISS IndexFlatIP over L2-normalized vectors.

    Returns (index, metadata_list) mirroring embed_and_index_text's
    contract. Returns (None, []) for a PDF with zero extracted figures --
    this is an expected, normal path (plan section 8c), not an error.
    """
    if not figures:
        return None, []

    model, preprocess, _ = get_clip_model()

    tensors = []
    kept_figures = []
    for fig in figures:
        try:
            img = Image.open(fig["image_path"]).convert("RGB")
            tensors.append(preprocess(img))
            kept_figures.append(fig)
        except Exception:
            # Corrupt/unreadable image extracted from the PDF -- skip it
            # rather than failing the whole ingestion.
            continue

    if not tensors:
        return None, []

    batch = torch.stack(tensors)
    with torch.no_grad():
        embeddings = model.encode_image(batch)
        embeddings = embeddings.cpu().numpy().astype("float32")

    faiss.normalize_L2(embeddings)

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    return index, kept_figures


def embed_image_query(query: str) -> np.ndarray:
    """
    Embed a text query with CLIP's TEXT encoder (not image encoder).
    This is what makes cross-modal search work: the text query lands in
    the same space as the image embeddings above.
    """
    model, _, tokenizer = get_clip_model()
    tokens = tokenizer([query])
    with torch.no_grad():
        vec = model.encode_text(tokens)
        vec = vec.cpu().numpy().astype("float32")
    faiss.normalize_L2(vec)
    return vec
