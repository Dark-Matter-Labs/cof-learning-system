import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import Link from 'next/link';
import type { Node } from '@/lib/types/nodes';

export default async function ReviewPage() {
  const supabase = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [awaitingRes, staleRes, challengesRes] = await Promise.all([
    // Awaiting promotion
    supabase
      .from('nodes')
      .select('*')
      .eq('status', 'llm_reviewed')
      .order('created_at', { ascending: true }),
    // Stale hunches (llm_reviewed for >7 days)
    supabase
      .from('nodes')
      .select('*')
      .eq('status', 'llm_reviewed')
      .lt('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true }),
    // Recent challenges
    supabase
      .from('edges')
      .select('id, source_id, target_id, edge_type, created_at')
      .eq('edge_type', 'challenges')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false }),
  ]);

  const awaiting = (awaitingRes.data ?? []) as unknown as Node[];
  const stale = (staleRes.data ?? []) as unknown as Node[];
  const challenges = challengesRes.data ?? [];

  if (awaiting.length === 0 && challenges.length === 0) {
    return (
      <EmptyState
        title="All caught up — no hunches awaiting review"
        description="New hunches will appear here after AI processing"
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-lg font-bold text-gray-200 mb-6">Weekly Review</h1>

      {/* Stale hunches warning */}
      {stale.length > 0 && (
        <div className="bg-node-option/10 border border-node-option/30 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-medium text-node-option mb-2">
            {stale.length} stale hunch{stale.length > 1 ? 'es' : ''} (&gt;7 days)
          </h2>
          <p className="text-xs text-gray-500">These have been waiting for human review for over a week.</p>
        </div>
      )}

      {/* Awaiting promotion */}
      {awaiting.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Awaiting Review ({awaiting.length})
          </h2>
          <div className="space-y-2">
            {awaiting.map(node => (
              <Link
                key={node.id}
                href={`/capture/${node.id}/review`}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-200 truncate">{node.title}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {new Date(node.created_at).toLocaleDateString()}
                  </div>
                </div>
                <StatusBadge status={node.status} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Assumption challenges */}
      {challenges.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Recent Challenges ({challenges.length})
          </h2>
          <div className="space-y-2">
            {challenges.map(edge => (
              <div key={edge.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-gray-400">
                <span className="text-node-assumption-fg">challenges</span> connection created {new Date(edge.created_at).toLocaleDateString()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
