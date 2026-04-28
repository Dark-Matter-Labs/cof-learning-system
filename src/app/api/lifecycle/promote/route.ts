import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkHunchPromotion } from '@/lib/lifecycle/autoPromote';

export async function POST(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: hunches, error } = await supabase
    .from('nodes')
    .select('id, lifecycle_stage')
    .eq('node_type', 'hunch')
    .eq('author_id', user.id)
    .not('lifecycle_stage', 'in', '("execution","archived")');

  if (error) return NextResponse.json({ error: 'Failed to load hunches' }, { status: 500 });

  const promoted: string[] = [];
  const failed: string[] = [];

  for (const hunch of (hunches ?? [])) {
    if (!hunch.id) continue;
    const decision = await checkHunchPromotion(hunch.id);
    if (!decision.advance || !decision.newStage) continue;

    const { error: updateError } = await supabase
      .from('nodes')
      .update({
        lifecycle_stage: decision.newStage,
        stage_transitioned_at: new Date().toISOString(),
        stage_transition_reason: decision.reason ?? null,
      })
      .eq('id', hunch.id)
      .eq('author_id', user.id);

    if (updateError) {
      failed.push(hunch.id);
      continue;
    }

    await supabase.from('activity_log').insert({
      actor_id: user.id,
      action: 'lifecycle_promoted',
      target_node_id: hunch.id,
      details: { from: hunch.lifecycle_stage, to: decision.newStage, reason: decision.reason },
    });

    promoted.push(hunch.id);
  }

  return NextResponse.json({ data: { promoted: promoted.length, ids: promoted, failed: failed.length } });
}
