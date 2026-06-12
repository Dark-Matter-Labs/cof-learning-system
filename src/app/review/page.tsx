import { createClient } from '@/lib/supabase/server';
import { getKnowledgeReviewTypes } from '@/lib/config/captureTypes';
import { redirect } from 'next/navigation';
import { SystemHealthClient, type ReviewQueueEntry } from './SystemHealthClient';
import type { Node } from '@/lib/types/nodes';
import type { TensionAlert } from '@/lib/types/tension';

export const dynamic = 'force-dynamic';

export default async function SystemHealthPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [flaggedRes, tensionsRes, awaitingRes] = await Promise.all([
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
      .select('*')
      .in('node_type', getKnowledgeReviewTypes() as string[])
      .eq('status', 'llm_reviewed')
      .order('created_at', { ascending: false }),
  ]);

  const flagged = (flaggedRes.data ?? []) as unknown as Node[];
  const awaiting = (awaitingRes.data ?? []) as unknown as Node[];

  const queue: ReviewQueueEntry[] = [
    ...flagged.map(node => ({ node, kind: 'flagged' as const })),
    ...awaiting.map(node => ({ node, kind: 'awaiting' as const })),
  ];

  // Fetch titles of source documents/meetings so extracted children can show
  // a "from <source>" tag.
  const parentIds = Array.from(
    new Set(queue.map(e => e.node.parent_node_id).filter((id): id is string => Boolean(id)))
  );
  let sourceTitles: Record<string, string> = {};
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('nodes')
      .select('id, title')
      .in('id', parentIds);
    sourceTitles = Object.fromEntries(
      (parents ?? []).map(p => [p.id as string, p.title as string])
    );
  }

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-8">Review</h1>
        <SystemHealthClient
          queue={queue}
          tensions={(tensionsRes.data ?? []) as unknown as TensionAlert[]}
          sourceTitles={sourceTitles}
        />
      </div>
    </div>
  );
}
