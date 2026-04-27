import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm', () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from '@/lib/llm';
import { suggestGoal, processSeedChat } from '../setup';

const mockCallLLM = vi.mocked(callLLM);

describe('suggestGoal', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns title and description from LLM response', async () => {
    mockCallLLM.mockResolvedValue({
      content: JSON.stringify({ title: 'Establish formation capital model', description: 'A multi-capital vehicle operating at scale.' }),
      model: 'claude-test',
    });
    const result = await suggestGoal('We want to create a fund that works differently...');
    expect(result.title).toBe('Establish formation capital model');
    expect(result.description).toBe('A multi-capital vehicle operating at scale.');
  });

  it('throws on invalid JSON response', async () => {
    mockCallLLM.mockResolvedValue({ content: 'not json', model: 'claude-test' });
    await expect(suggestGoal('something')).rejects.toThrow('Failed to parse goal suggestion');
  });
});

describe('processSeedChat', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns reply and extracted nodes', async () => {
    mockCallLLM.mockResolvedValue({
      content: JSON.stringify({
        reply: 'Great, I captured that hunch.',
        extracted: [{ title: 'Warming requires new capital tools', node_type: 'hunch' }],
      }),
      model: 'claude-test',
    });
    const result = await processSeedChat({
      message: 'I think warming will drive new capital formation',
      history: [],
      goals: [{ title: 'Establish formation capital model' }],
    });
    expect(result.reply).toBe('Great, I captured that hunch.');
    expect(result.extracted).toHaveLength(1);
    expect(result.extracted[0].title).toBe('Warming requires new capital tools');
  });
});
