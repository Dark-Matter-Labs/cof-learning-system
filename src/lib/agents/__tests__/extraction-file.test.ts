import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildExtractionPrompt, runExtraction } from '../extraction';

const mockCallLLM = vi.fn();
vi.mock('@/lib/llm', () => ({ callLLM: (...args: unknown[]) => mockCallLLM(...args) }));

const VALID_EXTRACTION = JSON.stringify({
  node_type: 'learning',
  maturity: 'watch_closely',
  title: 'Quarterly targets missed',
  summary: 'The Q1 targets were not met.',
  structured_claim: null,
  assumption_type: null,
  entities: [],
  domain_tags: ['finance'],
  suggested_connections: [],
  confidence_assessment: { level: 3, basis: 'observation' },
  open_questions: [],
  commitment_relevance: null,
});

describe('buildExtractionPrompt with file content', () => {
  it('includes text file content in prompt when textFileContent provided', () => {
    const prompt = buildExtractionPrompt('', '', undefined, 'File body here');
    expect(prompt).toContain('File body here');
    expect(prompt).toContain('<document>');
  });

  it('includes title hint when title and text content provided', () => {
    const prompt = buildExtractionPrompt('My Doc', '', undefined, 'File body here');
    expect(prompt).toContain('My Doc');
    expect(prompt).toContain('File body here');
  });

  it('falls back to title/description when no text content', () => {
    const prompt = buildExtractionPrompt('A title', 'A description');
    expect(prompt).toBe('Title: A title\n\nDescription: A description');
  });
});

describe('runExtraction with AttachmentContent', () => {
  beforeEach(() => {
    mockCallLLM.mockResolvedValue({ content: VALID_EXTRACTION, model: 'test' });
  });

  it('passes text content via userMessage for text attachment', async () => {
    await runExtraction('', '', undefined, { type: 'text', textContent: 'Hello world' });
    expect(mockCallLLM).toHaveBeenCalledWith('extraction', expect.objectContaining({
      userMessage: expect.stringContaining('Hello world'),
      pdfBase64: undefined,
    }));
  });

  it('passes pdfBase64 for pdf attachment', async () => {
    await runExtraction('', '', undefined, { type: 'pdf', base64: 'abc123' });
    expect(mockCallLLM).toHaveBeenCalledWith('extraction', expect.objectContaining({
      pdfBase64: 'abc123',
    }));
  });

  it('uses normal title/description path when no attachment', async () => {
    await runExtraction('A title', 'A description');
    expect(mockCallLLM).toHaveBeenCalledWith('extraction', expect.objectContaining({
      userMessage: 'Title: A title\n\nDescription: A description',
      pdfBase64: undefined,
    }));
  });
});
