export interface RetrievalNode {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
}

export interface RetrievalEdge {
  readonly source_id: string;
  readonly target_id: string;
}

/** Lexical fallback: nodes whose title/description contain any query term (>2 chars). */
export function lexicalMatchIds(nodes: readonly RetrievalNode[], query: string): Set<string> {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  return new Set(
    nodes
      .filter(n => {
        const text = `${n.title} ${n.description ?? ''}`.toLowerCase();
        return terms.length === 0 || terms.some(t => text.includes(t));
      })
      .map(n => n.id),
  );
}

/** Adds the immediate (1-hop) neighbours of the seed set. */
export function expandByEdges(ids: ReadonlySet<string>, edges: readonly RetrievalEdge[]): Set<string> {
  const out = new Set(ids);
  for (const e of edges) {
    if (ids.has(e.source_id)) out.add(e.target_id);
    if (ids.has(e.target_id)) out.add(e.source_id);
  }
  return out;
}

/**
 * Picks the context node ids for a query: the semantic matches (top-k from
 * pgvector) when present, otherwise the lexical fallback — then expands 1 hop
 * along edges. Falling back to lexical means behaviour is unchanged until
 * embeddings exist (backfill not run / no key / empty result).
 */
export function selectContextNodeIds(opts: {
  readonly nodes: readonly RetrievalNode[];
  readonly edges: readonly RetrievalEdge[];
  readonly query: string;
  readonly semanticIds: readonly string[];
}): Set<string> {
  const seed = opts.semanticIds.length > 0
    ? new Set(opts.semanticIds)
    : lexicalMatchIds(opts.nodes, opts.query);
  return expandByEdges(seed, opts.edges);
}
