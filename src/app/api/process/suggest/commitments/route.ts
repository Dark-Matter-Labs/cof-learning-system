import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { suggestCommitmentAssessments } from '@/lib/agents/process';
import type { Node } from '@/lib/types/nodes';
import type { CommitmentWithAssumptions } from '@/lib/agents/process';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const { data: commitmentNodes } = await supabase
    .from('nodes')
    .select('id, title, description')
    .eq('node_type', 'commitment')
    .not('status', 'in', '("archived","suspended","falsified")');

  const commitments: CommitmentWithAssumptions[] = (commitmentNodes ?? []).map(n => ({
    id: n.id as string,
    title: n.title as string,
    description: n.description as string | null,
  }));

  if (commitments.length === 0) {
    return NextResponse.json({ data: [] });
  }

  try {
    const assessments = await suggestCommitmentAssessments(typedSource, commitments);
    return NextResponse.json({ data: assessments });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'LLM call failed' },
      { status: 500 }
    );
  }
}
