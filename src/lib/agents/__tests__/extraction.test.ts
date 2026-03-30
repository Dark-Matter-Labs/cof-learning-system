import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  // Goal context tests
  it('buildExtractionPrompt without goalContext returns base prompt only', () => {
    const prompt = buildExtractionPrompt('My title', 'My description');
    expect(prompt).toBe('Title: My title\n\nDescription: My description');
    expect(prompt).not.toContain('Active goal spaces');
    expect(prompt).not.toContain('Active trigger outcomes');
  });

  it('buildExtractionPrompt with goalContext includes goal spaces and trigger outcomes', () => {
    const goalContext = {
      goalSpaces: [{ id: 'gs-1', title: 'Formation capital' }],
      triggerOutcomes: [{ id: 'to-1', title: 'Raise £10M' }],
    };
    const prompt = buildExtractionPrompt('My title', 'My description', goalContext);
    expect(prompt).toContain('Active goal spaces:');
    expect(prompt).toContain('Formation capital');
    expect(prompt).toContain('gs-1');
    expect(prompt).toContain('Active trigger outcomes:');
    expect(prompt).toContain('Raise £10M');
    expect(prompt).toContain('to-1');
  });

  it('buildExtractionPrompt with empty goalContext arrays returns base prompt only', () => {
    const goalContext = { goalSpaces: [], triggerOutcomes: [] };
    const prompt = buildExtractionPrompt('My title', 'My description', goalContext);
    expect(prompt).toBe('Title: My title\n\nDescription: My description');
    expect(prompt).not.toContain('Active goal spaces');
  });

  it('parseExtractionResponse accepts JSON with optional goal_relevance and expected_signals', () => {
    const validResponse = JSON.stringify({
      title: 'Test',
      summary: 'Summary',
      structured_claim: null,
      assumption_type: null,
      entities: [],
      domain_tags: [],
      suggested_connections: [],
      confidence_assessment: { level: 2, basis: 'intuition' },
      open_questions: [],
      goal_relevance: [{ outcome_id: 'to-1', outcome_title: 'Raise £10M', rationale: 'Directly relevant' }],
      expected_signals: ['Signal A', 'Signal B'],
    });
    const result = parseExtractionResponse(validResponse);
    expect(result.goal_relevance).toHaveLength(1);
    expect(result.goal_relevance?.[0].outcome_id).toBe('to-1');
    expect(result.expected_signals).toEqual(['Signal A', 'Signal B']);
  });

  it('parseExtractionResponse accepts JSON without goal_relevance/expected_signals (backward compatible)', () => {
    const validResponse = JSON.stringify({
      title: 'Test',
      summary: 'Summary',
      structured_claim: null,
      assumption_type: null,
      entities: [],
      domain_tags: [],
      suggested_connections: [],
      confidence_assessment: { level: 2, basis: 'intuition' },
      open_questions: [],
    });
    const result = parseExtractionResponse(validResponse);
    expect(result.goal_relevance).toBeUndefined();
    expect(result.expected_signals).toBeUndefined();
  });
});

describe('runExtraction with goalContext', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('runExtraction passes goal-enriched prompt to callLLM', async () => {
    const mockCallLLM = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        title: 'Test',
        summary: 'Summary',
        structured_claim: null,
        assumption_type: null,
        entities: [],
        domain_tags: [],
        suggested_connections: [],
        confidence_assessment: { level: 2, basis: 'intuition' },
        open_questions: [],
      }),
    });

    vi.doMock('@/lib/llm', () => ({ callLLM: mockCallLLM }));

    const { runExtraction } = await import('../extraction');
    const goalContext = {
      goalSpaces: [{ id: 'gs-1', title: 'Formation capital' }],
      triggerOutcomes: [{ id: 'to-1', title: 'Raise £10M' }],
    };

    await runExtraction('Test title', 'Test description', goalContext);

    expect(mockCallLLM).toHaveBeenCalledOnce();
    const callArgs = mockCallLLM.mock.calls[0][1];
    expect(callArgs.userMessage).toContain('Active goal spaces:');
    expect(callArgs.userMessage).toContain('Formation capital');
    expect(callArgs.userMessage).toContain('Active trigger outcomes:');
    expect(callArgs.userMessage).toContain('Raise £10M');
  });
});
