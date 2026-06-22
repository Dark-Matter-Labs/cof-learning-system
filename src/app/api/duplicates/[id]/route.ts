import { withAuth, ok, fail } from '@/lib/api/withAuth';

const ALLOWED_STATUSES = new Set(['dismissed', 'resolved']);

// Resolve a duplicate candidate: 'dismissed' (not a duplicate) or 'resolved'
// (the client has archived the duplicate node via PATCH /api/nodes/[id]).
export const PATCH = withAuth<{ id: string }>(async ({ request, supabase, params }) => {
  const { id } = await params;

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON body');
  }
  if (typeof body.status !== 'string' || !ALLOWED_STATUSES.has(body.status)) {
    return fail('status must be "dismissed" or "resolved"');
  }

  const { error } = await supabase
    .from('duplicate_candidates')
    .update({ status: body.status })
    .eq('id', id);
  if (error) return fail(error.message, 500);

  return ok({ id, status: body.status });
});
