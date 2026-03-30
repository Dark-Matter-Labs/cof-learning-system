'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ReviewCard } from '@/components/review/ReviewCard';
import type { Node, HumanReview } from '@/lib/types/nodes';

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'in', 'to', 'and', 'for', 'is', 'as', 'on', 'by', 'at', 'or', 'not']);

function getKeywords(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function findBestMatch(targetTitle: string, candidates: { id: string; title: string }[]): { id: string; title: string } | null {
  // Exact match
  const exact = candidates.find(n => n.title === targetTitle);
  if (exact) return exact;

  // Substring match
  const sub = candidates.find(n => n.title.toLowerCase().includes(targetTitle.toLowerCase()))
    ?? candidates.find(n => targetTitle.toLowerCase().includes(n.title.toLowerCase()));
  if (sub) return sub;

  // Word overlap — match if ANY significant keyword overlaps
  const searchWords = getKeywords(targetTitle);
  if (searchWords.length === 0) return null;

  let bestScore = 0;
  let bestMatch: { id: string; title: string } | null = null;

  for (const candidate of candidates) {
    const candidateWords = getKeywords(candidate.title);
    const overlap = searchWords.filter(w => candidateWords.some(cw => cw.includes(w) || w.includes(cw))).length;
    if (overlap > 0 && overlap > bestScore) {
      bestScore = overlap;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [node, setNode] = useState<Node | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triggerOutcomes, setTriggerOutcomes] = useState<ReadonlyArray<{ readonly id: string; readonly title: string }>>([]);

  useEffect(() => {
    const fetchNode = async () => {
      const supabase = createClient();
      const [{ data: nodeData }, { data: outcomesData }] = await Promise.all([
        supabase
          .from('nodes')
          .select('*')
          .eq('id', params.id)
          .single(),
        supabase
          .from('nodes')
          .select('id, title')
          .eq('node_type', 'trigger_outcome')
          .neq('status', 'archived'),
      ]);
      if (nodeData) setNode(nodeData as unknown as Node);
      if (outcomesData) setTriggerOutcomes(outcomesData as { id: string; title: string }[]);
    };
    fetchNode();
  }, [params.id]);

  const handlePromote = async (review: HumanReview) => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const nodeId = params.id as string;

      await supabase
        .from('nodes')
        .update({
          human_review: review,
          status: 'promoted',
          confidence_level: review.fields.confidence?.final as number,
          domain_tags: review.fields.domain_tags?.final as string[],
        })
        .eq('id', nodeId);

      // Create edges for accepted connections by matching target titles to existing nodes
      if (review.connections_accepted.length > 0) {
        const accepted = review.connections_accepted.filter(c => c.target_title);

        if (accepted.length > 0) {
          const { data: allNodes } = await supabase
            .from('nodes')
            .select('id, title')
            .in('status', ['promoted', 'human_reviewed'])
            .neq('id', nodeId);

          if (allNodes && allNodes.length > 0) {
            const edges = accepted
              .map(conn => {
                const target = findBestMatch(conn.target_title, allNodes);
                if (!target) return null;
                return { source_id: nodeId, target_id: target.id, edge_type: conn.edge_type, weight: 1 };
              })
              .filter((e): e is NonNullable<typeof e> => e !== null);

            if (edges.length > 0) {
              await supabase.from('edges').insert(edges);
            }
          }
        }
      }

      // Create targets_outcome edges for accepted/edited goal relevance suggestions
      const goalRelevanceEdges = Object.entries(review.fields)
        .filter(([key, field]) =>
          key.startsWith('goal_relevance_') &&
          (field.action === 'accepted' || field.action === 'edited')
        )
        .map(([, field]) => ({
          source_id: nodeId,
          target_id: field.final as string,
          edge_type: 'targets_outcome',
          weight: 1,
        }));

      if (goalRelevanceEdges.length > 0) {
        await supabase.from('edges').insert(goalRelevanceEdges);
      }

      await supabase.from('activity_log').insert({
        action: 'promoted',
        target_node_id: nodeId,
        details: { from_status: node?.status },
      });

      router.push('/capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async (review: HumanReview) => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      await supabase
        .from('nodes')
        .update({ human_review: review, status: 'human_reviewed' })
        .eq('id', params.id);
      router.push('/capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      await supabase
        .from('nodes')
        .update({ status: 'archived' })
        .eq('id', params.id);

      await supabase.from('activity_log').insert({
        action: 'archived',
        target_node_id: params.id as string,
      });

      router.push('/capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!node) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-48" />
          <div className="h-32 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (!node.llm_extraction || node.status === 'raw' || node.status === 'processing') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-400">This hunch is still being processed by the AI.</p>
        <p className="text-sm text-gray-600 mt-1">Check back in a moment.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-200">{node.title}</h1>
        {node.description && (
          <p className="mt-1 text-sm text-gray-500">{node.description}</p>
        )}
      </div>
      <ReviewCard
        node={node}
        onPromote={handlePromote}
        onSaveDraft={handleSaveDraft}
        onArchive={handleArchive}
        isSubmitting={isSubmitting}
        triggerOutcomes={triggerOutcomes}
      />
    </div>
  );
}
