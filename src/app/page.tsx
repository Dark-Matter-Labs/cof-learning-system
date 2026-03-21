import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/shared/EmptyState';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [awaitingRes, promotedRes, testsRes, recentRes] = await Promise.all([
    supabase
      .from('nodes')
      .select('id, node_type, title, status, created_at')
      .eq('status', 'llm_reviewed')
      .order('created_at', { ascending: true }),
    supabase
      .from('nodes')
      .select('id, title, author_id, created_at')
      .eq('status', 'promoted')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('nodes')
      .select('id, title, domain_tags')
      .eq('node_type', 'test')
      .eq('status', 'promoted'),
    supabase
      .from('activity_log')
      .select('id, action, target_node_id, created_at, details')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const awaiting = awaitingRes.data ?? [];
  const promoted = promotedRes.data ?? [];
  const tests = testsRes.data ?? [];
  const recent = recentRes.data ?? [];

  const hasData = awaiting.length > 0 || promoted.length > 0 || tests.length > 0;

  if (!hasData && recent.length === 0) {
    return (
      <EmptyState
        title="Welcome to COF Learning System"
        description="Start by capturing your first hunch"
        actionLabel="Capture a Hunch"
        actionHref="/capture"
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-lg font-bold text-gray-200 mb-6">Dashboard</h1>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-600 uppercase tracking-wider">Awaiting Review</div>
          <div className="text-2xl font-bold text-node-assumption-fg mt-1">{awaiting.length}</div>
          {awaiting.length > 0 && (
            <Link href="/review" className="text-xs text-gray-500 hover:text-gray-400 mt-1 block">
              View queue →
            </Link>
          )}
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-600 uppercase tracking-wider">Promoted This Week</div>
          <div className="text-2xl font-bold text-node-assumption-bg mt-1">{promoted.length}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-600 uppercase tracking-wider">Active Tests</div>
          <div className="text-2xl font-bold text-node-test mt-1">{tests.length}</div>
        </div>
      </div>

      {/* Recent activity */}
      {recent.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {recent.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 text-xs text-gray-500 py-1.5 border-b border-gray-800/50">
                <span className="text-gray-400 capitalize">{entry.action.replace(/_/g, ' ')}</span>
                <span className="text-gray-600">
                  {new Date(entry.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
