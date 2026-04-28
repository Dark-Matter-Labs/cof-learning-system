import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: candidates, error } = await supabase
    .from('distillation_candidates')
    .select('id, node_ids, merged_title, merged_summary, merged_node_type, rationale, created_at')
    .eq('created_by', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to load candidates' }, { status: 500 });
  if (!candidates?.length) return NextResponse.json({ data: [] });

  const allNodeIds = [...new Set(candidates.flatMap(c => c.node_ids as string[]))];
  const { data: nodes } = await supabase
    .from('nodes')
    .select('id, title, node_type, description')
    .in('id', allNodeIds)
    .eq('author_id', user.id);

  const nodeMap = new Map((nodes ?? []).map(n => [n.id as string, n]));
  const enriched = candidates.map(c => ({
    ...c,
    nodes: (c.node_ids as string[]).map(id => nodeMap.get(id)).filter(Boolean),
  }));

  return NextResponse.json({ data: enriched });
}

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const actionSchema = z.object({
  id: z.string().regex(uuidRegex),
  action: z.enum(['accept', 'reject']),
});

export async function PATCH(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { id, action } = parsed.data;

  const { data: candidate, error: fetchError } = await supabase
    .from('distillation_candidates')
    .select('id, node_ids, merged_title, merged_summary, merged_node_type, created_by')
    .eq('id', id)
    .eq('created_by', user.id)
    .single();

  if (fetchError || !candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  if (action === 'reject') {
    const { error: rejectError } = await supabase
      .from('distillation_candidates')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (rejectError) {
      process.stderr.write(`[distill/candidates] Reject update failed for ${id}: ${rejectError.message}\n`);
      return NextResponse.json({ error: 'Failed to reject candidate' }, { status: 500 });
    }
    return NextResponse.json({ data: { action: 'rejected' } });
  }

  // Accept: create merged node
  const { data: newNode, error: nodeError } = await supabase
    .from('nodes')
    .insert({
      node_type: candidate.merged_node_type,
      title: candidate.merged_title,
      description: candidate.merged_summary,
      confidence_level: 3,
      confidence_basis: 'observation',
      status: 'human_reviewed',
      author_id: user.id,
      content: { source: 'distillation', source_candidate_id: id },
    })
    .select('id')
    .single();

  if (nodeError || !newNode) return NextResponse.json({ error: 'Failed to create merged node' }, { status: 500 });

  const edges = (candidate.node_ids as string[]).map(sourceId => ({
    source_id: sourceId,
    target_id: newNode.id,
    edge_type: 'evolved_from',
    weight: 1,
    author_id: user.id,
  }));
  const { error: edgeError } = await supabase.from('edges').insert(edges);
  if (edgeError) {
    process.stderr.write(`[distill/candidates] Edge insert failed for candidate ${id}: ${edgeError.message}\n`);
  }

  const { error: archiveError } = await supabase
    .from('nodes')
    .update({ status: 'archived' })
    .in('id', candidate.node_ids as string[]);
  if (archiveError) {
    process.stderr.write(`[distill/candidates] Archive failed for candidate ${id}: ${archiveError.message}\n`);
  }

  const { error: acceptUpdateError } = await supabase
    .from('distillation_candidates')
    .update({ status: 'accepted', resolved_at: new Date().toISOString(), resolved_node_id: newNode.id })
    .eq('id', id);
  if (acceptUpdateError) {
    process.stderr.write(`[distill/candidates] Accept status update failed for ${id}: ${acceptUpdateError.message}\n`);
  }

  return NextResponse.json({ data: { action: 'accepted', node_id: newNode.id } });
}
