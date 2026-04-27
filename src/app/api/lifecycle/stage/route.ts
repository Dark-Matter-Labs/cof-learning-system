import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const VALID_STAGES = ['divergence', 'attractor', 'convergence', 'execution', 'archived'] as const;

const schema = z.object({
  node_id: z.string().uuid(),
  stage: z.enum(VALID_STAGES),
  reason: z.string().max(500).optional(),
});

export async function PATCH(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { node_id, stage, reason } = parsed.data;

  const { data: node } = await supabase.from('nodes').select('lifecycle_stage').eq('id', node_id).single();
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 });

  const { error } = await supabase.from('nodes').update({
    lifecycle_stage: stage,
    stage_transitioned_at: new Date().toISOString(),
    stage_transition_reason: reason ? `Manual: ${reason}` : 'Manual override',
  }).eq('id', node_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('activity_log').insert({
    actor_id: user.id,
    action: 'lifecycle_manual_override',
    target_node_id: node_id,
    details: { from: node.lifecycle_stage, to: stage, reason: reason ?? 'Manual override' },
  });

  return NextResponse.json({ data: { node_id, stage } });
}
