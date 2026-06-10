import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the pdf2md library — exercised via dynamic import in the unit under test.
const mockPdf2md = vi.fn();
vi.mock('@opendocsg/pdf2md', () => ({ default: (...args: unknown[]) => mockPdf2md(...args) }));

import { pdfToMarkdown } from '../pdfToMarkdown';

describe('pdfToMarkdown', () => {
  const buffer = Buffer.from('%PDF-1.4 fake');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns trimmed markdown when the library extracts text', async () => {
    mockPdf2md.mockResolvedValue('\n# Heading\n\nSome body text.\n\n');

    const result = await pdfToMarkdown(buffer);

    expect(result).toBe('# Heading\n\nSome body text.');
    expect(mockPdf2md).toHaveBeenCalledOnce();
  });

  it('returns empty string when the PDF has no extractable text layer', async () => {
    mockPdf2md.mockResolvedValue('   \n  \n ');

    const result = await pdfToMarkdown(buffer);

    expect(result).toBe('');
  });

  it('returns empty string when the library returns null/undefined', async () => {
    mockPdf2md.mockResolvedValue(undefined);

    const result = await pdfToMarkdown(buffer);

    expect(result).toBe('');
  });

  it('returns empty string when the library throws', async () => {
    mockPdf2md.mockRejectedValue(new Error('corrupt PDF'));

    const result = await pdfToMarkdown(buffer);

    expect(result).toBe('');
  });
});
