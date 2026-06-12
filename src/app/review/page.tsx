import { createClient } from '@/lib/supabase/server';
import { getKnowledgeReviewTypes } from '@/lib/config/captureTypes';
import { redirect } from 'next/navigation';
import { SystemHealthClient } from './SystemHealthClient';
import type { Node } from '@/lib/types/nodes';
import type { TensionAlert } from '@/lib/types/tension';

export const dynamic = 'force-dynamic';

export default async function SystemHealthPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [
    flaggedRes,
    tensionsRes,
    learningsRes,
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
      .in('node_type', getKnowledgeReviewTypes() as string[])
      .eq('status', 'llm_reviewed')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-8">System Health</h1>
        <SystemHealthClient
          flagged={(flaggedRes.data ?? []) as unknown as Node[]}
          tensions={(tensionsRes.data ?? []) as unknown as TensionAlert[]}
          learnings={(learningsRes.data ?? []) as unknown as Node[]}
        />
      </div>
    </div>
  );
}
