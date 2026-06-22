import { createClient } from '@/lib/supabase/server';
import { getKnowledgeReviewTypes } from '@/lib/config/captureTypes';
import { redirect } from 'next/navigation';
import { SystemHealthClient, type ReviewQueueEntry } from './SystemHealthClient';
import type { ReviewDuplicate } from '@/components/review/DuplicateItem';
import type { Node } from '@/lib/types/nodes';
import type { TensionAlert } from '@/lib/types/tension';

interface DuplicateRow {
  id: string;
  similarity: number;
  node_id: string;
  similar_node_id: string;
}

export const dynamic = 'force-dynamic';

export default async function SystemHealthPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [flaggedRes, tensionsRes, awaitingRes, dupesRes] = await Promise.all([
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
    supabase
      .from('duplicate_candidates')
      .select('id, similarity, node_id, similar_node_id')
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
  ]);

  const flagged = (flaggedRes.data ?? []) as unknown as Node[];
  const awaiting = (awaitingRes.data ?? []) as unknown as Node[];

  const queue: ReviewQueueEntry[] = [
    ...flagged.map(node => ({ node, kind: 'flagged' as const })),
    ...awaiting.map(node => ({ node, kind: 'awaiting' as const })),
  ];

  const dupeRows = (dupesRes.data ?? []) as DuplicateRow[];

  // One title lookup covering both the "from <source>" tags on extracted
  // children and the node pairs in the duplicates section.
  const titleIds = Array.from(new Set([
    ...queue.map(e => e.node.parent_node_id).filter((id): id is string => Boolean(id)),
    ...dupeRows.flatMap(d => [d.node_id, d.similar_node_id]),
  ]));
  let titles: Record<string, string> = {};
  if (titleIds.length > 0) {
    const { data: rows } = await supabase.from('nodes').select('id, title').in('id', titleIds);
    titles = Object.fromEntries((rows ?? []).map(r => [r.id as string, r.title as string]));
  }

  // Only show candidates where both nodes still exist (titles resolved).
  const duplicates: ReviewDuplicate[] = dupeRows
    .filter(d => titles[d.node_id] && titles[d.similar_node_id])
    .map(d => ({
      id: d.id,
      similarity: d.similarity,
      node: { id: d.node_id, title: titles[d.node_id] },
      similarTo: { id: d.similar_node_id, title: titles[d.similar_node_id] },
    }));

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-8">Review</h1>
        <SystemHealthClient
          queue={queue}
          tensions={(tensionsRes.data ?? []) as unknown as TensionAlert[]}
          sourceTitles={titles}
          duplicates={duplicates}
        />
      </div>
    </div>
  );
}
