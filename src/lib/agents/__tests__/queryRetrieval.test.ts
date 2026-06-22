import { describe, it, expect } from 'vitest';
import { lexicalMatchIds, expandByEdges, selectContextNodeIds } from '../queryRetrieval';

const nodes = [
  { id: 'a', title: 'Madrid funding', description: 'patient capital' },
  { id: 'b', title: 'Dartmoor', description: 'commons model' },
  { id: 'c', title: 'Unrelated', description: null },
];
const edges = [{ source_id: 'a', target_id: 'c' }];

describe('lexicalMatchIds', () => {
  it('matches on title/description terms', () => {
    expect(lexicalMatchIds(nodes, 'madrid')).toEqual(new Set(['a']));
    expect(lexicalMatchIds(nodes, 'commons')).toEqual(new Set(['b']));
  });
  it('ignores terms of 2 chars or fewer', () => {
    // only "of" (<=2) → no terms → matches all
    expect(lexicalMatchIds(nodes, 'of').size).toBe(3);
  });
});

describe('expandByEdges', () => {
  it('adds 1-hop neighbours in both directions', () => {
    expect(expandByEdges(new Set(['a']), edges)).toEqual(new Set(['a', 'c']));
    expect(expandByEdges(new Set(['c']), edges)).toEqual(new Set(['c', 'a']));
  });
});

describe('selectContextNodeIds', () => {
  it('uses semantic matches when present, then expands 1 hop', () => {
    const result = selectContextNodeIds({ nodes, edges, query: 'anything', semanticIds: ['a'] });
    expect(result).toEqual(new Set(['a', 'c'])); // 'a' semantic + 'c' neighbour
  });

  it('falls back to lexical when there are no semantic matches', () => {
    const result = selectContextNodeIds({ nodes, edges, query: 'madrid', semanticIds: [] });
    expect(result).toEqual(new Set(['a', 'c'])); // lexical 'a' + neighbour 'c'
  });

  it('ignores the lexical query entirely when semantic ids are given', () => {
    const result = selectContextNodeIds({ nodes, edges, query: 'madrid', semanticIds: ['b'] });
    expect(result).toEqual(new Set(['b'])); // 'b' has no edges; lexical 'madrid' not consulted
  });
});
