import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { callLLM } from '@/lib/llm';
import { buildCorrectionPrompt, parseCorrectionActions, applyCorrection } from '../agent';
import type { CorrectionNode } from '../agent';

const mockNodes: CorrectionNode[] = [
  { id: 'node-1', node_type: 'hunch', title: 'AI will transform finance', description: 'This is happening' },
  { id: 'node-2', node_type: 'learning', title: 'Old learning', description: 'Outdated info' },
];

describe('buildCorrectionPrompt', () => {
  it('includes all node IDs in the prompt', () => {
    const prompt = buildCorrectionPrompt('Generated text here', mockNodes, 'node-1 is wrong');
    expect(prompt).toContain('node-1');
    expect(prompt).toContain('node-2');
  });

  it('includes the user feedback text', () => {
    const feedback = 'The description is completely incorrect';
    const prompt = buildCorrectionPrompt('Output', mockNodes, feedback);
    expect(prompt).toContain(feedback);
  });

  it('includes the generated text', () => {
    const generated = 'This was the AI output';
    const prompt = buildCorrectionPrompt(generated, mockNodes, 'wrong');
    expect(prompt).toContain(generated);
  });

  it('includes node titles and descriptions', () => {
    const prompt = buildCorrectionPrompt('Output', mockNodes, 'feedback');
    expect(prompt).toContain('AI will transform finance');
    expect(prompt).toContain('Outdated info');
  });
});

describe('parseCorrectionActions', () => {
  it('parses an update action', () => {
    const raw = JSON.stringify({
      reasoning: 'description was wrong',
      actions: [{ action: 'update', node_id: 'node-1', fields: { description: 'corrected' } }],
    });
    const result = parseCorrectionActions(raw);
    expect(result.reasoning).toBe('description was wrong');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({ action: 'update', node_id: 'node-1' });
  });

  it('parses an archive action', () => {
    const raw = JSON.stringify({
      reasoning: 'node was irreparably wrong',
      actions: [{ action: 'archive', node_id: 'node-2' }],
    });
    const result = parseCorrectionActions(raw);
    expect(result.actions[0]).toMatchObject({ action: 'archive', node_id: 'node-2' });
  });

  it('parses a create action', () => {
    const raw = JSON.stringify({
      reasoning: 'missing information',
      actions: [{ action: 'create', node_type: 'learning', title: 'New node', description: 'Correct info' }],
    });
    const result = parseCorrectionActions(raw);
    expect(result.actions[0]).toMatchObject({ action: 'create', node_type: 'learning', title: 'New node' });
  });

  it('returns empty actions on invalid JSON', () => {
    const result = parseCorrectionActions('not json {{{');
    expect(result.actions).toEqual([]);
    expect(result.reasoning).toBe('');
  });

  it('returns empty actions when actions field is missing', () => {
    const raw = JSON.stringify({ reasoning: 'something', no_actions: [] });
    const result = parseCorrectionActions(raw);
    expect(result.actions).toEqual([]);
  });
});

describe('applyCorrection', () => {
  const makeSupabase = (overrides: Record<string, unknown> = {}) => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const inFn = vi.fn().mockResolvedValue({ data: [] });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select, update, insert, eq, in: inFn, ...overrides });
    return { from, update, insert, eq, inFn };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls LLM with prompt containing node ID when nodeRefs provided', async () => {
    const { from, update, eq } = makeSupabase();
    const supabase = { from } as never;
    // node fetch returns one node
    from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [{ id: 'node-1', node_type: 'hunch', title: 'Test', description: null }] }),
      }),
    });
    // nodes.update(...).eq(...) for archive
    from.mockReturnValueOnce({ update: update.mockReturnValue({ eq: eq.mockResolvedValue({ data: null, error: null }) }) });
    // feedback.update(...).eq(...)
    from.mockReturnValueOnce({ update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) });

    vi.mocked(callLLM).mockResolvedValueOnce({
      content: JSON.stringify({ reasoning: 'was wrong', actions: [{ action: 'archive', node_id: 'node-1' }] }),
      model: 'claude-sonnet-4-6',
    });

    await applyCorrection('fb-1', ['node-1'], 'output', 'feedback', supabase, 'user-1');

    expect(callLLM).toHaveBeenCalledWith('correction', expect.objectContaining({
      userMessage: expect.stringContaining('node-1'),
    }));
  });

  it('stamps applied_at when all actions succeed', async () => {
    const feedbackEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const feedbackUpdate = vi.fn().mockReturnValue({ eq: feedbackEq });
    const nodeEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const nodeUpdate = vi.fn().mockReturnValue({ eq: nodeEq });

    // 'x' is in context (nodeRefs), so the archive action is allowed.
    const from = vi.fn()
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ id: 'x', node_type: 'hunch', title: 't', description: null }] }) }) }) // node fetch
      .mockReturnValueOnce({ update: nodeUpdate })       // nodes.update (archive)
      .mockReturnValueOnce({ update: feedbackUpdate });  // feedback.update (applied_at)

    vi.mocked(callLLM).mockResolvedValueOnce({
      content: JSON.stringify({ reasoning: 'fix', actions: [{ action: 'archive', node_id: 'x' }] }),
      model: 'claude-sonnet-4-6',
    });

    await applyCorrection('fb-1', ['x'], 'output', 'feedback', { from } as never, 'user-1');

    expect(feedbackUpdate).toHaveBeenCalledWith(expect.objectContaining({ applied_at: expect.any(String) }));
  });

  it('drops actions targeting nodes outside the flagged context, and does not stamp applied_at', async () => {
    const feedbackUpdate = vi.fn();
    const nodeUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });

    // Context contains only 'safe'; the LLM emits an archive against 'victim'.
    const from = vi.fn()
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ id: 'safe', node_type: 'hunch', title: 't', description: null }] }) }) }) // node fetch
      .mockReturnValue({ update: nodeUpdate });

    vi.mocked(callLLM).mockResolvedValueOnce({
      content: JSON.stringify({ reasoning: 'evil', actions: [{ action: 'archive', node_id: 'victim' }] }),
      model: 'claude-sonnet-4-6',
    });

    await applyCorrection('fb-1', ['safe'], 'output', 'feedback', { from } as never, 'user-1');

    expect(nodeUpdate).not.toHaveBeenCalled();
    expect(feedbackUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ applied_at: expect.any(String) }));
  });

  it('does NOT stamp applied_at when LLM returns no actions', async () => {
    const feedbackUpdate = vi.fn();
    const from = vi.fn()
      .mockReturnValue({ select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [] }) }), update: feedbackUpdate });

    vi.mocked(callLLM).mockResolvedValueOnce({
      content: JSON.stringify({ reasoning: 'nothing', actions: [] }),
      model: 'claude-sonnet-4-6',
    });

    await applyCorrection('fb-1', [], 'output', 'feedback', { from } as never, 'user-1');

    expect(feedbackUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ applied_at: expect.any(String) }));
  });

  it('does NOT stamp applied_at when a Supabase action errors', async () => {
    const feedbackUpdate = vi.fn();
    const nodeEq = vi.fn().mockResolvedValue({ data: null, error: { message: 'RLS denied' } });
    const nodeUpdate = vi.fn().mockReturnValue({ eq: nodeEq });

    // nodeRefs=[] so node fetch is skipped; first from() call is for the archive action
    const from = vi.fn()
      .mockReturnValueOnce({ update: nodeUpdate })   // nodes.update (archive) → returns error
      .mockReturnValue({ update: feedbackUpdate });  // would be feedback.update (should NOT be reached)

    vi.mocked(callLLM).mockResolvedValueOnce({
      content: JSON.stringify({ reasoning: 'archive', actions: [{ action: 'archive', node_id: 'bad' }] }),
      model: 'claude-sonnet-4-6',
    });

    await applyCorrection('fb-1', [], 'output', 'feedback', { from } as never, 'user-1');

    expect(feedbackUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ applied_at: expect.any(String) }));
  });

  it('does NOT insert when create action has invalid node_type', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const feedbackUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });

    const from = vi.fn()
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [] }) }) })
      .mockReturnValue({ insert, update: feedbackUpdate });

    vi.mocked(callLLM).mockResolvedValueOnce({
      content: JSON.stringify({
        reasoning: 'add bad node',
        actions: [{ action: 'create', node_type: 'invalid_type', title: 'Bad', description: 'Bad' }],
      }),
      model: 'claude-sonnet-4-6',
    });

    await applyCorrection('fb-1', [], 'output', 'feedback', { from } as never, 'user-1');

    expect(insert).not.toHaveBeenCalled();
  });
});
