import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/withAuth';
import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { applyCorrection } from '@/lib/correction/agent';

const postSchema = z.object({
  source_type: z.enum(['reflection', 'query', 'newsletter']),
  source_id: z.string().uuid(),
  feedback_text: z.string().trim().min(1).max(2000),
});

type SourceType = 'reflection' | 'query' | 'newsletter';

const SOURCE_TABLE: Record<SourceType, string> = {
  newsletter: 'newsletters',
  query: 'query_sessions',
  reflection: 'reflection_sessions',
};

function extractNodeRefs(sourceType: SourceType, record: Record<string, unknown>): string[] {
  if (sourceType === 'newsletter' || sourceType === 'query') {
    const refs = record['node_refs'];
    return Array.isArray(refs) ? refs.filter((r): r is string => typeof r === 'string') : [];
  }
  const mr = record['machine_reflection'];
  if (!mr || typeof mr !== 'object') return [];
  const report = mr as Record<string, unknown>;
  const ids = new Set<string>();
  const contradictions = report['contradictions'];
  if (Array.isArray(contradictions)) {
    for (const c of contradictions) {
      const nodeIds = (c as Record<string, unknown>)['node_ids'];
      if (Array.isArray(nodeIds)) {
        for (const id of nodeIds) {
          if (typeof id === 'string') ids.add(id);
        }
      }
    }
  }
  const recommendations = report['recommendations'];
  if (Array.isArray(recommendations)) {
    for (const r of recommendations) {
      const targetId = (r as Record<string, unknown>)['target_node_id'];
      if (typeof targetId === 'string') ids.add(targetId);
    }
  }
  return [...ids];
}

function extractGeneratedText(sourceType: SourceType, record: Record<string, unknown>): string {
  if (sourceType === 'newsletter') return typeof record['content'] === 'string' ? record['content'] : '';
  if (sourceType === 'query') return typeof record['response'] === 'string' ? record['response'] : '';
  const mr = record['machine_reflection'];
  return mr ? JSON.stringify(mr) : '';
}

export const POST = withAuth(async ({ request, user, supabase }) => {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { source_type, source_id, feedback_text } = parsed.data;
  const table = SOURCE_TABLE[source_type];

  const { data: sourceRecord, error: sourceError } = await supabase
    .from(table)
    .select('*')
    .eq('id', source_id)
    .single();

  if (sourceError || !sourceRecord) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  const record = sourceRecord as Record<string, unknown>;
  const nodeRefs = extractNodeRefs(source_type, record);
  const generatedText = extractGeneratedText(source_type, record);

  const { data: feedback, error: insertError } = await supabase
    .from('feedback')
    .insert({ author_id: user.id, source_type, source_id, feedback_text })
    .select('id, created_at')
    .single();

  if (insertError || !feedback) {
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  const feedbackId = (feedback as Record<string, unknown>)['id'] as string;
  const userId = user.id;

  after(async () => {
    const bgSupabase = await createClient();
    try {
      await applyCorrection(feedbackId, nodeRefs, generatedText, feedback_text, bgSupabase, userId);
    } catch (err) {
      console.error('[feedback] correction failed:', err);
    }
  });

  return NextResponse.json(
    { id: feedbackId, created_at: (feedback as Record<string, unknown>)['created_at'] },
    { status: 201 }
  );
});
