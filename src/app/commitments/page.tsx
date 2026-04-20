import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CommitmentsClient } from './CommitmentsClient';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert } from '@/lib/types/tension';

export default async function CommitmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { id: highlightId } = await searchParams;

  let commitmentsData, goalSpacesData, triggerOutcomesData, allNodesData, edgesData, tensionsData;
  try {
    const [
      commitmentsRes,
      goalSpacesRes,
      triggerOutcomesRes,
      allNodesRes,
      edgesRes,
      tensionsRes,
    ] = await Promise.all([
      supabase.from('nodes').select('*').eq('node_type', 'commitment'),
      supabase.from('nodes').select('*').eq('node_type', 'goal_space').neq('status', 'archived'),
      supabase.from('nodes').select('*').eq('node_type', 'trigger_outcome'),
      supabase.from('nodes').select('*'),
      supabase.from('edges').select('*'),
      supabase.from('tension_alerts').select('*').eq('status', 'active'),
    ]);

    // Check errors on critical queries (tensions error not checked as table may not exist)
    if (
      commitmentsRes.error ||
      goalSpacesRes.error ||
      triggerOutcomesRes.error ||
      allNodesRes.error ||
      edgesRes.error
    ) {
      throw new Error('Failed to load commitments');
    }

    commitmentsData = commitmentsRes.data ?? [];
    goalSpacesData = goalSpacesRes.data ?? [];
    triggerOutcomesData = triggerOutcomesRes.data ?? [];
    allNodesData = allNodesRes.data ?? [];
    edgesData = edgesRes.data ?? [];
    tensionsData = tensionsRes.data ?? [];
  } catch {
    return (
      <div className="page-with-nav">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-8">Commitments</h1>
          <p className="text-sm text-red-400">Failed to load commitments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-8">Commitments</h1>
        <CommitmentsClient
          commitments={commitmentsData as unknown as Node[]}
          goalSpaces={goalSpacesData as unknown as Node[]}
          triggerOutcomes={triggerOutcomesData as unknown as Node[]}
          allNodes={allNodesData as unknown as Node[]}
          edges={edgesData as unknown as Edge[]}
          tensions={tensionsData as unknown as TensionAlert[]}
          highlightId={highlightId}
        />
      </div>
    </div>
  );
}
