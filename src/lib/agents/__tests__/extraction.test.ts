import { describe, it, expect } from 'vitest';
import { parseExtractionResponse, buildExtractionPrompt } from '../extraction';

describe('extraction agent', () => {
  it('builds prompt with title and description', () => {
    const prompt = buildExtractionPrompt('Test title', 'Test description');
    expect(prompt).toContain('Test title');
    expect(prompt).toContain('Test description');
  });

  it('parses valid extraction JSON', () => {
    const validResponse = JSON.stringify({
      title: 'Extracted title',
      summary: 'A summary',
      structured_claim: { if: 'X', then: 'Y', because: 'Z' },
      assumption_type: 'foreground',
      entities: [{ name: 'Indy', type: 'person' }],
      domain_tags: ['capital_strategy'],
      suggested_connections: [],
      confidence_assessment: { level: 3, basis: 'observation' },
      open_questions: ['What about X?'],
    });

    const result = parseExtractionResponse(validResponse);
    expect(result.title).toBe('Extracted title');
    expect(result.entities).toHaveLength(1);
    expect(result.confidence_assessment.level).toBe(3);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseExtractionResponse('not json')).toThrow();
  });

  it('throws on missing required fields', () => {
    expect(() => parseExtractionResponse(JSON.stringify({ title: 'only title' }))).toThrow();
  });
});
