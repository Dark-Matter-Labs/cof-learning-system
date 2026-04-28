const DAILY_CAP = 20;

export interface SignalInput {
  readonly title: string;
  readonly summary: string;
  readonly sourceType: 'web' | 'slack' | 'drive' | 'notion';
  readonly sourceAttribution: string;
  readonly topicNodeId: string;
  readonly authorId: string;
}

export interface SignalNodeRow {
  readonly node_type: 'signal';
  readonly title: string;
  readonly description: string;
  readonly status: 'flagged_for_review';
  readonly confidence_level: 2;
  readonly confidence_basis: 'observation';
  readonly hunch_type: 'external_validation';
  readonly author_id: string;
  readonly content: {
    readonly source_type: string;
    readonly source_attribution: string;
    readonly topic_node_id: string;
    readonly auto_generated: true;
  };
}

export function checkDailyQuota(currentCount: number, cap = DAILY_CAP): boolean {
  return currentCount < cap;
}

export function buildSignalNode(input: SignalInput): SignalNodeRow {
  return {
    node_type: 'signal',
    title: input.title,
    description: input.summary,
    status: 'flagged_for_review',
    confidence_level: 2,
    confidence_basis: 'observation',
    hunch_type: 'external_validation',
    author_id: input.authorId,
    content: {
      source_type: input.sourceType,
      source_attribution: input.sourceAttribution,
      topic_node_id: input.topicNodeId,
      auto_generated: true,
    },
  };
}

export async function ingestSignals(signals: SignalInput[]): Promise<{ created: number; skipped: number }> {
  if (signals.length === 0) return { created: 0, skipped: 0 };

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const today = new Date().toISOString().slice(0, 10);
    const { data: quotaRow, error: quotaError } = await supabase
      .from('auto_signal_quota')
      .select('signals_created')
      .eq('quota_date', today)
      .single();

    // If error is not PGRST116 (not found), it's a real DB error — safe to continue with 0 as default
    const currentCount = (!quotaError || quotaError.code === 'PGRST116') ? (quotaRow?.signals_created ?? 0) : 0;
    const remaining = DAILY_CAP - currentCount;

    if (remaining <= 0) return { created: 0, skipped: signals.length };

    const toProcess = signals.slice(0, remaining);
    const nodes = toProcess.map(buildSignalNode);

    const { error } = await supabase.from('nodes').insert(nodes);
    if (error) return { created: 0, skipped: signals.length };

    const { error: upsertError } = await supabase.from('auto_signal_quota').upsert({
      quota_date: today,
      signals_created: currentCount + toProcess.length,
    });
    // Non-fatal: log to stderr but don't fail the ingestion
    if (upsertError) process.stderr.write(`[signals] quota upsert failed: ${upsertError.message}\n`);

    return { created: toProcess.length, skipped: signals.length - toProcess.length };
  } catch (error) {
    return { created: 0, skipped: signals.length };
  }
}
