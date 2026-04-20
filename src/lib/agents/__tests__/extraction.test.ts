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
      personNodes: [],
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
    const goalContext = { goalSpaces: [], triggerOutcomes: [], personNodes: [] };
    const prompt = buildExtractionPrompt('My title', 'My description', goalContext);
    expect(prompt).toBe('Title: My title\n\nDescription: My description');
    expect(prompt).not.toContain('Active goal spaces');
  });

  it('buildExtractionPrompt with personNodes includes known persons section', () => {
    const goalContext = {
      goalSpaces: [],
      triggerOutcomes: [],
      personNodes: [
        { id: 'p-1', title: 'Robyn Munro' },
        { id: 'p-2', title: 'Indy Johar' },
      ],
    };
    const prompt = buildExtractionPrompt('My title', 'My description', goalContext);
    expect(prompt).toContain('Known persons in the system:');
    expect(prompt).toContain('Robyn Munro');
    expect(prompt).toContain('Indy Johar');
    expect(prompt).toContain('mentioned_in');
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

describe('SYSTEM_PROMPT node_type and maturity classification', () => {
  it('SYSTEM_PROMPT includes CRITICAL node type classification instructions', async () => {
    // Import the module to access SYSTEM_PROMPT indirectly via runExtraction
    // We verify by checking that the system prompt passed to callLLM contains the critical instructions
    vi.resetModules();

    const mockCallLLM = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        node_type: 'hunch',
        maturity: 'watch_closely',
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
    await runExtraction('Test title', 'Test description');

    const callArgs = mockCallLLM.mock.calls[0][1];
    expect(callArgs.systemPrompt).toContain('CRITICAL');
    expect(callArgs.systemPrompt).toContain('node_type');
    expect(callArgs.systemPrompt).toContain('maturity');
    expect(callArgs.systemPrompt).toContain('ready_to_promote');
    expect(callArgs.systemPrompt).toContain('watch_closely');
    expect(callArgs.systemPrompt).toContain('needs_development');
    expect(callArgs.systemPrompt).toContain('cluster_dependent');
    expect(callArgs.systemPrompt).toContain('hunch');
    expect(callArgs.systemPrompt).toContain('assumption_background');
    expect(callArgs.systemPrompt).toContain('assumption_foreground');
    expect(callArgs.systemPrompt).toContain('signal');
    expect(callArgs.systemPrompt).toContain('learning');
    expect(callArgs.systemPrompt).toContain('option');
  });

  it('parseExtractionResponse accepts node_type and maturity fields', () => {
    const validResponse = JSON.stringify({
      node_type: 'signal',
      maturity: 'ready_to_promote',
      title: 'Test signal',
      summary: 'A summary',
      structured_claim: null,
      assumption_type: null,
      entities: [],
      domain_tags: [],
      suggested_connections: [],
      confidence_assessment: { level: 4, basis: 'early_evidence' },
      open_questions: [],
    });
    const result = parseExtractionResponse(validResponse);
    expect(result.node_type).toBe('signal');
    expect(result.maturity).toBe('ready_to_promote');
  });

  it('parseExtractionResponse is backward compatible without node_type/maturity', () => {
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
    expect(result.node_type).toBeUndefined();
    expect(result.maturity).toBeUndefined();
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
      personNodes: [],
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
