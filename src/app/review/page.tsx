import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import Link from 'next/link';
import type { Node } from '@/lib/types/nodes';
import type { TensionAlert } from '@/lib/types/tension';
import { ReflectionPanel } from './ReflectionPanel';
import { shouldTriggerReflection } from '@/lib/types/convergence';

export default async function ReviewPage() {
  const supabase = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [awaitingRes, staleRes, lowConfRes, testsRes, tensionsRes, commitmentsRes, stalledRes, allHunchesRes, targetEdgesRes, reflectionCountRes, reflectionLastRes] = await Promise.all([
    // Context: awaiting promotion
    supabase
      .from('nodes')
      .select('*')
      .eq('status', 'llm_reviewed')
      .order('created_at', { ascending: true }),
    // Context: stale hunches (llm_reviewed for >7 days)
    supabase
      .from('nodes')
      .select('*')
      .eq('status', 'llm_reviewed')
      .lt('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true }),
    // Context: low-confidence assumptions
    supabase
      .from('nodes')
      .select('*')
      .in('node_type', ['assumption_background', 'assumption_foreground'])
      .lte('confidence_level', 2)
      .neq('status', 'archived'),
    // Context: active tests (in-progress tests to watch)
    supabase
      .from('nodes')
      .select('*')
      .eq('node_type', 'test')
      .neq('status', 'archived'),
    // Commitment: active tension alerts
    supabase
      .from('tension_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    // Commitment: active commitments
    supabase
      .from('nodes')
      .select('*')
      .eq('node_type', 'commitment'),
    // Commitment: commitments with no activity in 7 days
    supabase
      .from('nodes')
      .select('*')
      .eq('node_type', 'commitment')
      .lt('updated_at', sevenDaysAgo),
    // Undirected: all active hunches
    supabase
      .from('nodes')
      .select('*')
      .eq('node_type', 'hunch')
      .not('status', 'in', '("archived","falsified","suspended")'),
    // Undirected: all targets_outcome edges (to compute which hunches are linked)
    supabase
      .from('edges')
      .select('source_id')
      .eq('edge_type', 'targets_outcome'),
    // Reflection threshold: count qualified nodes
    supabase
      .from('nodes')
      .select('*', { count: 'exact', head: true })
      .in('status', ['promoted', 'human_reviewed']),
    // Reflection threshold: last reflection session
    supabase
      .from('reflection_sessions')
      .select('node_count_at_reflection, created_at')
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const awaiting = (awaitingRes.data ?? []) as unknown as Node[];
  const stale = (staleRes.data ?? []) as unknown as Node[];
  const lowConf = (lowConfRes.data ?? []) as unknown as Node[];
  const tests = (testsRes.data ?? []) as unknown as Node[];
  const tensions = (tensionsRes.data ?? []) as unknown as TensionAlert[];
  const commitments = (commitmentsRes.data ?? []) as unknown as Node[];
  const stalled = (stalledRes.data ?? []) as unknown as Node[];

  const qualifiedNodeCount = reflectionCountRes.count ?? 0;
  const lastSession = (reflectionLastRes.data?.[0] ?? null) as { node_count_at_reflection: number; created_at: string } | null;
  const reflectionDue = shouldTriggerReflection(
    qualifiedNodeCount,
    lastSession?.node_count_at_reflection ?? 0,
    lastSession?.created_at ? new Date(lastSession.created_at) : null,
  );

  const linkedHunchIds = new Set(
    ((targetEdgesRes.data ?? []) as unknown as { source_id: string }[]).map(e => e.source_id)
  );
  const undirectedHunches = ((allHunchesRes.data ?? []) as unknown as Node[]).filter(
    n => !linkedHunchIds.has(n.id)
  );

  const isEmpty = awaiting.length === 0 && tensions.length === 0 && lowConf.length === 0 && undirectedHunches.length === 0;

  if (isEmpty) {
    return (
      <div className="page-with-nav">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <EmptyState
            title="All caught up"
            description="No hunches awaiting review, no tension alerts, no low-confidence assumptions."
          />
          <div className="mt-8">
            <ReflectionPanel reflectionDue={reflectionDue} />
          </div>
        </div>
      </div>
    );
  }

  const SEVERITY_COLORS: Record<string, string> = {
    high:   'text-red-400 border-red-900/50',
    medium: 'text-amber-400 border-amber-900/50',
    low:    'text-gray-500 border-gray-800',
  };

  return (
    <div className="page-with-nav">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-200 mb-6">Weekly Review</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT: Context health ── */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Context health
            </h2>

            {/* Stale warning */}
            {stale.length > 0 && (
              <div className="bg-node-option/10 border border-node-option/30 rounded-lg p-3 mb-4">
                <div className="text-xs font-medium text-node-option mb-1">
                  {stale.length} stale hunch{stale.length > 1 ? 'es' : ''} (&gt;7 days)
                </div>
                <p className="text-[10px] text-gray-500">Waiting for human review over a week.</p>
              </div>
            )}

            {/* Awaiting promotion */}
            {awaiting.length > 0 && (
              <section className="mb-5">
                <h3 className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
                  Hunches awaiting review ({awaiting.length})
                </h3>
                <div className="space-y-1.5">
                  {awaiting.map(node => (
                    <Link
                      key={node.id}
                      href={`/capture/${node.id}/review`}
                      className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg p-2.5 hover:border-gray-700 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-200 truncate">{node.title}</div>
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          {new Date(node.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <StatusBadge status={node.status} />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Low-confidence assumptions */}
            {lowConf.length > 0 && (
              <section className="mb-5">
                <h3 className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
                  Assumptions needing tests ({lowConf.length})
                </h3>
                <div className="space-y-1.5">
                  {lowConf.map(node => (
                    <div key={node.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-300 truncate">{node.title}</div>
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          Confidence {node.confidence_level}/5
                        </div>
                      </div>
                      <span className="text-[9px] text-amber-500 shrink-0 ml-2">needs test</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Active tests */}
            {tests.length > 0 && (
              <section className="mb-5">
                <h3 className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
                  Tests in progress ({tests.length})
                </h3>
                <div className="space-y-1.5">
                  {tests.slice(0, 5).map(node => (
                    <div key={node.id} className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-2.5 gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4537E] shrink-0 mt-0.5" />
                      <div className="text-xs text-gray-400 truncate">{node.title}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Undirected hunches */}
            {undirectedHunches.length > 0 && (
              <section className="mb-5" data-testid="undirected-hunches">
                <h3 className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
                  Undirected hunches ({undirectedHunches.length})
                </h3>
                <p className="text-[10px] text-amber-500/80 mb-2">Consider linking these to a trigger outcome</p>
                <div className="space-y-1.5">
                  {undirectedHunches.map(node => (
                    <Link
                      key={node.id}
                      href={`/capture/${node.id}/review`}
                      className="flex items-center justify-between bg-gray-900 border border-amber-900/30 rounded-lg p-2.5 hover:border-amber-800/50 transition-colors"
                    >
                      <div className="text-xs text-gray-300 truncate">{node.title}</div>
                      <span className="text-[9px] text-amber-500 shrink-0 ml-2">consider linking</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── RIGHT: Commitment health ── */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Commitment health
            </h2>

            {/* Active tensions */}
            {tensions.length > 0 && (
              <section className="mb-5">
                <h3 className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
                  Active tensions ({tensions.length})
                </h3>
                <div className="space-y-1.5">
                  {tensions.map(alert => (
                    <div
                      key={alert.id}
                      className={`bg-gray-900 border rounded-lg p-2.5 ${SEVERITY_COLORS[alert.severity] ?? 'border-gray-800'}`}
                    >
                      <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${SEVERITY_COLORS[alert.severity]?.split(' ')[0] ?? 'text-gray-500'}`}>
                        {alert.severity} · {alert.type.replace(/_/g, ' ')}
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                        {alert.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Stalled commitments */}
            {stalled.length > 0 && (
              <section className="mb-5">
                <h3 className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
                  Commitments without recent activity ({stalled.length})
                </h3>
                <div className="space-y-1.5">
                  {stalled.map(node => (
                    <div key={node.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                      <div className="text-xs text-gray-400 truncate">{node.title}</div>
                      <span className="text-[9px] text-gray-600 shrink-0 ml-2">
                        {new Date(node.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Commitments summary */}
            {commitments.length > 0 && (
              <section className="mb-5">
                <h3 className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
                  All commitments ({commitments.length})
                </h3>
                <div className="space-y-1.5">
                  {commitments.map(node => (
                    <div key={node.id} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                      <div className="w-1.5 shrink-0 h-full self-stretch rounded-full bg-[#185FA5]" />
                      <div className="text-xs text-gray-300 truncate flex-1">{node.title}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

        </div>

        {/* ── System Reflection ── */}
        <div className="mt-8">
          <ReflectionPanel reflectionDue={reflectionDue} />
        </div>

      </div>
    </div>
  );
}
