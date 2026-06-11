import { withAuth, ok } from '@/lib/api/withAuth';
import { scanWebForTopics } from '@/lib/signals/webScanner';

// Web search + relevance filtering + per-topic LLM extraction; can exceed the
// default function timeout.
export const maxDuration = 300;

export const POST = withAuth(async ({ user }) => {
  const result = await scanWebForTopics(user.id);
  return ok(result);
});
