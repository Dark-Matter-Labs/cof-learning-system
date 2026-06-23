import { withAuth, ok, fail } from '@/lib/api/withAuth';

// Resolve an edge suggestion: 'accept' creates the real edge then marks the
// suggestion accepted; 'dismiss' marks it dismissed without creating an edge.
export const PATCH = withAuth<{ id: string }>(async ({ request, supabase, user, params }) => {
  const { id } = await params;

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON body');
  }
  if (body.action !== 'accept' && body.action !== 'dismiss') {
    return fail('action must be "accept" or "dismiss"');
  }

  if (body.action === 'dismiss') {
    const { error } = await supabase
      .from('edge_suggestions')
      .update({ status: 'dismissed' })
      .eq('id', id);
    if (error) return fail(error.message, 500);
    return ok({ id, status: 'dismissed' });
  }

  // accept
  const { data: suggestion, error: readErr } = await supabase
    .from('edge_suggestions')
    .select('source_id, target_id, edge_type')
    .eq('id', id)
    .maybeSingle();
  if (readErr) return fail(readErr.message, 500);
  if (!suggestion) return fail('Suggestion not found', 404);

  const { error: edgeErr } = await supabase.from('edges').insert({
    source_id: suggestion.source_id,
    target_id: suggestion.target_id,
    edge_type: suggestion.edge_type,
    weight: 1,
    author_id: user.id,
  });
  if (edgeErr) return fail(edgeErr.message, 500);

  const { error: updateErr } = await supabase
    .from('edge_suggestions')
    .update({ status: 'accepted' })
    .eq('id', id);
  if (updateErr) return fail(updateErr.message, 500);

  return ok({ id, status: 'accepted' });
});
