import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SystemHealthClient } from './SystemHealthClient';
import type { Node } from '@/lib/types/nodes';
import type { TensionAlert } from '@/lib/types/tension';

export default async function SystemHealthPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [
    flaggedRes,
    tensionsRes,
    learningsRes,
    sitesRes,
    optionsRes,
    goalSpacesRes,
  ] = await Promise.all([
    supabase
      .from('nodes')
      .select('*')
      .eq('status', 'flagged_for_review')
      .order('created_at', { ascending: true }),
    supabase
      .from('tension_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('nodes')
      .select('id, title, node_type, created_at')
      .in('node_type', ['learning', 'signal'])
      .eq('status', 'promoted')
      .order('created_at', { ascending: false }),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'site')
      .neq('status', 'archived'),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'option')
      .in('status', ['promoted', 'human_reviewed']),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'goal_space')
      .neq('status', 'archived'),
  ]);

  const sites = (sitesRes.data ?? []).map(n => ({ id: n.id as string, label: n.title as string, type: 'site' as const }));
  const options = (optionsRes.data ?? []).map(n => ({ id: n.id as string, label: n.title as string, type: 'option' as const }));
  const goalSpaces = (goalSpacesRes.data ?? []).map(n => ({ id: n.id as string, label: n.title as string, type: 'goal_space' as const }));

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-8">System Health</h1>
        <SystemHealthClient
          flagged={(flaggedRes.data ?? []) as unknown as Node[]}
          tensions={(tensionsRes.data ?? []) as unknown as TensionAlert[]}
          learnings={(learningsRes.data ?? []) as unknown as Node[]}
          sites={sites}
          options={options}
          goalSpaces={goalSpaces}
        />
      </div>
    </div>
  );
}
