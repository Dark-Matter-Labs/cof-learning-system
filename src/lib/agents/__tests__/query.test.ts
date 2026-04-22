import { describe, it, expect } from 'vitest';
import {
  serializeNodesForQuery,
  buildQuerySystemPrompt,
  buildTourPrompt,
} from '../query';

describe('serializeNodesForQuery', () => {
  it('formats a node as [type] title: description (id: uuid)', () => {
    const nodes = [{ id: 'abc', node_type: 'hunch', title: 'My hunch', description: 'A description', status: 'raw' }];
    expect(serializeNodesForQuery(nodes)).toBe('[hunch] My hunch: A description (id: abc)');
  });

  it('omits description when null', () => {
    const nodes = [{ id: 'abc', node_type: 'hunch', title: 'My hunch', description: null, status: 'raw' }];
    expect(serializeNodesForQuery(nodes)).toBe('[hunch] My hunch (id: abc)');
  });

  it('joins multiple nodes with newlines', () => {
    const nodes = [
      { id: 'a', node_type: 'hunch', title: 'Hunch 1', description: null, status: 'raw' },
      { id: 'b', node_type: 'learning', title: 'Learning 1', description: 'desc', status: 'promoted' },
    ];
    expect(serializeNodesForQuery(nodes)).toBe('[hunch] Hunch 1 (id: a)\n[learning] Learning 1: desc (id: b)');
  });

  it('returns empty string for empty array', () => {
    expect(serializeNodesForQuery([])).toBe('');
  });

  it('replaces newlines in title and description with spaces', () => {
    const nodes = [{ id: 'x', node_type: 'hunch', title: 'Line one\nLine two', description: 'desc\nmore', status: 'raw' }];
    expect(serializeNodesForQuery(nodes)).toBe('[hunch] Line one Line two: desc more (id: x)');
  });
});

describe('buildQuerySystemPrompt', () => {
  it('returns a non-empty prompt when no background provided', () => {
    const result = buildQuerySystemPrompt();
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain('undefined');
  });

  it('includes background framing when provided', () => {
    const result = buildQuerySystemPrompt('finance and investment');
    expect(result).toContain('finance and investment');
  });

  it('omits framing sentence when background is empty string', () => {
    const withEmpty = buildQuerySystemPrompt('');
    const withoutBg = buildQuerySystemPrompt();
    expect(withEmpty).toBe(withoutBg);
  });

  it('includes user name when provided without background', () => {
    const result = buildQuerySystemPrompt(undefined, 'Malik');
    expect(result).toContain('Malik');
  });

  it('includes both name and background when both provided', () => {
    const result = buildQuerySystemPrompt('finance', 'Malik');
    expect(result).toContain('Malik');
    expect(result).toContain('finance');
  });
});

describe('buildTourPrompt', () => {
  it('includes the serialized graph in the prompt', () => {
    const result = buildTourPrompt('my graph content');
    expect(result).toContain('my graph content');
  });

  it('requests JSON output with chapters array structure', () => {
    const result = buildTourPrompt('graph');
    expect(result).toContain('"chapters"');
    expect(result).toContain('"nodeIds"');
  });
});
