import { NextResponse } from 'next/server';
import { suggestAffectedNodes } from '@/lib/agents/process';
import type { Node } from '@/lib/types/nodes';
import { withAuth } from '@/lib/api/withAuth';

export const POST = withAuth(async ({ supabase, request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sourceNodeId } = body;
  if (!sourceNodeId || typeof sourceNodeId !== 'string') {
    return NextResponse.json({ error: 'sourceNodeId is required' }, { status: 400 });
  }

  const { data: sourceNode, error: sourceError } = await supabase
    .from('nodes')
    .select('*')
    .eq('id', sourceNodeId)
    .single();

  if (sourceError || !sourceNode) {
    return NextResponse.json({ error: 'Source node not found' }, { status: 404 });
  }

  const typedSource = sourceNode as Node;

  // Fetch up to 50 candidate nodes — prefer same domain tags
  const { data: allNodes } = await supabase
    .from('nodes')
    .select('*')
    .neq('id', sourceNodeId)
    .in('status', ['promoted'])
    .limit(100);

  const candidates = (allNodes ?? []) as Node[];

  // Sort: same domain tags first, then take up to 50
  const sourceTags = new Set(typedSource.domain_tags ?? []);
  const sorted = [...candidates].sort((a, b) => {
    const aMatch = (a.domain_tags ?? []).some(t => sourceTags.has(t)) ? 1 : 0;
    const bMatch = (b.domain_tags ?? []).some(t => sourceTags.has(t)) ? 1 : 0;
    return bMatch - aMatch;
  }).slice(0, 50);

  try {
    const suggestions = await suggestAffectedNodes(typedSource, sorted);
    return NextResponse.json({ data: suggestions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'LLM call failed' },
      { status: 500 }
    );
  }
});
