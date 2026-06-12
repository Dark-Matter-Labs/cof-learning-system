import { withAuth, ok, fail } from '@/lib/api/withAuth';
import { runDistillation } from '@/lib/agents/distillation';

// Clustering + one synthesis LLM call per group run sequentially; on a large
// graph this can exceed the default function timeout.
export const maxDuration = 300;

export const POST = withAuth(async ({ user, supabase }) => {
  try {
    const result = await runDistillation(supabase, user.id);
    return ok(result);
  } catch {
    process.stderr.write('[distill/run] Unhandled error in runDistillation\n');
    return fail('Distillation failed', 500);
  }
});
