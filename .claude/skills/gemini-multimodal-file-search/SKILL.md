---
name: gemini-multimodal-file-search
description: Build a Gemini API File Search store that indexes and
             retrieves images (charts, product photos, diagrams) natively
             alongside text, using the gemini-embedding-2 model, instead of
             OCR-based text extraction. Reach for this when building RAG
             over documents that mix text and meaningful images.
---

# Multimodal RAG with Gemini File Search + gemini-embedding-2

The Gemini API's File Search tool now supports multimodal retrieval: with
`models/gemini-embedding-2`, images are embedded directly (not OCR'd) into
the same vector space as text, so a single store can retrieve relevant text
chunks and relevant images for the same query, including cross-modal matches
(a text query returning an image, or vice versa).

## When to reach for this

- RAG over documents where images carry meaning OCR would lose — charts,
  diagrams, product photos, screenshots — not just decorative images.
- You want one retrieval store instead of separate text and image pipelines.

## Steps

1. **Create the File Search store with the multimodal embedding model** —
   pass `models/gemini-embedding-2` as the embedding model when creating the
   store (not the default text-only embedding model). This applies to both
   text and image content added to that store.
2. **Upload text and image files into the same store.** The API handles
   chunking, embedding, and indexing for both; for text-based content it
   supports PDF, DOCX, TXT, JSON, and code files, and it accepts image files
   directly for multimodal content — don't pre-run OCR on images yourself,
   it defeats the point.
3. **Query with the `file_search` tool** attached to a normal
   `generateContent` call, same as text-only File Search — the model
   automatically retrieves relevant chunks (text and/or image) and grounds
   its answer in them.
4. **Read grounding metadata for visual citations.** Retrieved image results
   carry a `media_id` (plus page number where applicable) in the grounding
   metadata — use it to cite or display the exact source image, not just a
   filename.
5. **Don't mix embedding models within one store.** If a store was created
   with the older text-only embedding model, adding images to it won't make
   them multimodally searchable — create a new store with
   `gemini-embedding-2` and re-index instead of appending to the old one.

## Sources

- https://ai.google.dev/gemini-api/docs/file-search — Google, seen 2026-09-08
- https://ai.google.dev/gemini-api/docs/interactions/file-search — Google, seen 2026-09-08 (multimodal / gemini-embedding-2 support, media_id grounding, ~August 2026)
