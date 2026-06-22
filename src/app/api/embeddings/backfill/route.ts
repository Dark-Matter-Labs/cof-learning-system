import { withAuth, ok } from '@/lib/api/withAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { upsertNodeEmbedding } from '@/lib/llm/embedNode';

// Embeds existing vetted nodes that have no embedding yet. Idempotent and
// re-runnable; run once after enabling pgvector + setting VOYAGE_API_KEY.
export const maxDuration = 300;

export const POST = withAuth(async ({ supabase }) => {
  const [{ data: nodes }, { data: existing }] = await Promise.all([
    supabase
      .from('nodes')
      .select('id, title, description')
      .in('status', ['promoted', 'human_reviewed']),
    supabase.from('node_embeddings').select('node_id'),
  ]);

  const alreadyEmbedded = new Set((existing ?? []).map(e => e.node_id as string));
  const missing = (nodes ?? []).filter(n => !alreadyEmbedded.has(n.id as string));

  // Writes bypass RLS via the service-role client (see v1.1-embeddings.sql).
  const admin = createAdminClient();
  for (const n of missing) {
    await upsertNodeEmbedding(admin, {
      id: n.id as string,
      title: n.title as string,
      description: (n.description ?? null) as string | null,
    });
  }

  return ok({
    total: (nodes ?? []).length,
    alreadyEmbedded: alreadyEmbedded.size,
    processed: missing.length,
  });
});
