import { describe, it, expect } from 'vitest';
import { nodeCreateSchema } from '../nodeInput';

describe('nodeCreateSchema', () => {
  it('accepts a minimal valid node and defaults status to raw', () => {
    const result = nodeCreateSchema.parse({ node_type: 'hunch', title: 'A thought' });
    expect(result.node_type).toBe('hunch');
    expect(result.title).toBe('A thought');
    expect(result.status).toBe('raw');
  });

  it('allows the UI structural-node case (status: promoted)', () => {
    const result = nodeCreateSchema.parse({ node_type: 'commitment', title: 'Ship v1', status: 'promoted' });
    expect(result.status).toBe('promoted');
  });

  it('strips dangerous/server-managed fields (mass-assignment guard)', () => {
    const result = nodeCreateSchema.parse({
      node_type: 'hunch',
      title: 'A thought',
      author_id: 'someone-elses-id',
      llm_extraction: { hacked: true },
      llm_review: { hacked: true },
      human_review: { hacked: true },
      id: 'forced-id',
      lifecycle_stage: 'coherent',
      created_at: '2000-01-01',
    }) as Record<string, unknown>;
    expect(result.author_id).toBeUndefined();
    expect(result.llm_extraction).toBeUndefined();
    expect(result.llm_review).toBeUndefined();
    expect(result.human_review).toBeUndefined();
    expect(result.id).toBeUndefined();
    expect(result.lifecycle_stage).toBeUndefined();
    expect(result.created_at).toBeUndefined();
  });

  it('rejects an invalid node_type', () => {
    expect(() => nodeCreateSchema.parse({ node_type: 'malware', title: 'x' })).toThrow();
  });

  it('rejects a server-managed status (e.g. processing/archived)', () => {
    expect(() => nodeCreateSchema.parse({ node_type: 'hunch', title: 'x', status: 'processing' })).toThrow();
    expect(() => nodeCreateSchema.parse({ node_type: 'hunch', title: 'x', status: 'archived' })).toThrow();
  });

  it('rejects an empty or whitespace-only title', () => {
    expect(() => nodeCreateSchema.parse({ node_type: 'hunch', title: '' })).toThrow();
    expect(() => nodeCreateSchema.parse({ node_type: 'hunch', title: '   ' })).toThrow();
  });

  it('rejects an out-of-range confidence_level', () => {
    expect(() => nodeCreateSchema.parse({ node_type: 'hunch', title: 'x', confidence_level: 9 })).toThrow();
  });
});
