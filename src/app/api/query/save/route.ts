import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const SaveSchema = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.string().min(1).max(10000),
  node_type: z.enum(['hunch', 'learning']),
  context_node_ids: z.array(z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)).max(50).default([]),
});

export const POST = withAuth(async ({ user, supabase, request }) => {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { title, content, node_type, context_node_ids } = parsed.data;

  const { data: node, error: nodeError } = await supabase.from('nodes').insert({
    node_type,
    title,
    description: content,
    confidence_level: 3,
    confidence_basis: 'observation',
    status: 'human_reviewed',
    author_id: user.id,
    content: { source: 'query_synthesis', context_node_ids },
  }).select('id, title, node_type').single();

  if (nodeError || !node) return NextResponse.json({ error: 'Failed to create node' }, { status: 500 });

  let edgesCreated = 0;
  if (context_node_ids.length > 0) {
    const edges = context_node_ids.map(targetId => ({
      source_id: node.id,
      target_id: targetId,
      edge_type: 'supports',
      weight: 1,
      author_id: user.id,
    }));
    const { error: edgeError } = await supabase.from('edges').insert(edges);
    if (edgeError) {
      process.stderr.write(`[query/save] Edge insert failed for node ${node.id}: ${edgeError.message}\n`);
    } else {
      edgesCreated = edges.length;
    }
  }

  const { error: logError } = await supabase.from('activity_log').insert({
    actor_id: user.id,
    action: node_type === 'hunch' ? 'created_hunch' : 'created_learning',
    target_node_id: node.id,
    details: { source: 'query_synthesis', context_node_count: context_node_ids.length },
  });
  if (logError) {
    process.stderr.write(`[query/save] Activity log failed for node ${node.id}: ${logError.message}\n`);
  }

  return NextResponse.json({ data: { node, edges_created: edgesCreated } }, { status: 201 });
});
