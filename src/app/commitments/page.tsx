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

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-8">Commitments</h1>
        <CommitmentsClient
          commitments={(commitmentsRes.data ?? []) as unknown as Node[]}
          goalSpaces={(goalSpacesRes.data ?? []) as unknown as Node[]}
          triggerOutcomes={(triggerOutcomesRes.data ?? []) as unknown as Node[]}
          allNodes={(allNodesRes.data ?? []) as unknown as Node[]}
          edges={(edgesRes.data ?? []) as unknown as Edge[]}
          tensions={(tensionsRes.data ?? []) as unknown as TensionAlert[]}
          highlightId={highlightId}
        />
      </div>
    </div>
  );
}
