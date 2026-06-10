/**
 * Converts a PDF buffer to markdown text using @opendocsg/pdf2md (pure-JS,
 * pdf.js based — no native deps, serverless-safe).
 *
 * Returns an empty string when the PDF has no extractable text layer
 * (e.g. scanned/image-only PDFs) or when conversion fails. Callers should
 * treat an empty result as "no text" and fall back to sending the raw PDF.
 */
export async function pdfToMarkdown(buffer: Buffer): Promise<string> {
  try {
    const mod = await import('@opendocsg/pdf2md');
    const pdf2md = (mod.default ?? mod) as (data: Buffer | Uint8Array) => Promise<string>;
    const markdown = await pdf2md(buffer);
    return typeof markdown === 'string' ? markdown.trim() : '';
  } catch (err) {
    console.error('[pdfToMarkdown] conversion failed:', err);
    return '';
  }
}
