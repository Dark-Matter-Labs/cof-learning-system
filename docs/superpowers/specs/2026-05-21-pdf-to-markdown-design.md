# PDF → Markdown before LLM processing

**Date:** 2026-05-21
**Status:** Approved

## Goal

Reduce token cost and latency when processing PDF captures by extracting the
PDF's text (as markdown) in the Node runtime and sending that text to the LLM,
instead of sending the raw PDF as base64. This mirrors the existing `mammoth`
DOCX→text path.

Motivation: cost/speed. Claude already reads PDFs natively today, but base64
PDF input is token-heavy. Markdown text is far cheaper and gives the LLM clean
structure (headings, lists).

## Library

`@opendocsg/pdf2md` (v0.2.x) — pure-JS, built on pdf.js, serverless-friendly,
no native deps, no Python. Outputs markdown.

## Components

### `src/lib/files/pdfToMarkdown.ts` (new)

```
async function pdfToMarkdown(buffer: Buffer): Promise<string>
```

- Returns trimmed markdown text.
- Returns `''` when the PDF has no extractable text layer (scanned/image PDFs).
- Throws are caught by the caller and treated as "no text".
- Single purpose, independently testable.

### `src/app/api/capture/process/route.ts` (modified)

In the `application/pdf` branch (currently sets `{ type: 'pdf', base64 }`):

1. Try `pdfToMarkdown(buffer)`.
2. Non-empty result → `attachmentContent = { type: 'text', textContent }`.
3. Empty result or thrown error → fall back to `{ type: 'pdf', base64 }`
   (current behavior), so scanned/image PDFs still work via Claude's vision.

No changes to `extraction.ts`: its `type: 'text'` path already exists and is
exercised by DOCX today. Long markdown routes through the existing
`hasLongContent` / document-extraction logic unchanged.

## Data flow

```
upload PDF → storage → process route downloads buffer
  → pdfToMarkdown(buffer)
      ├─ text found → { type: 'text', textContent } → runExtraction (cheap)
      └─ no text    → { type: 'pdf', base64 }       → runExtraction (Claude vision)
                                                        → PDF_UNREADABLE net still applies
```

## Error handling

- Conversion failure is non-fatal: fall back to base64 path.
- Existing `PDF_UNREADABLE` fallback (description-only extraction) remains the
  final safety net.

## Testing

- Unit (`pdfToMarkdown`): mock `@opendocsg/pdf2md` — returns text → passes
  through trimmed; throws → returns `''`; whitespace-only → returns `''`.
- Route: a text PDF produces `type: 'text'`; a no-text PDF falls back to
  `type: 'pdf'`.

## Out of scope (YAGNI)

- DOCX/PPTX/XLSX/image conversion (markitdown's broader scope; DOCX already
  handled by mammoth).
- OCR for scanned PDFs.
- Any Python runtime.
