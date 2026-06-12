import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { estimateCostMicroCents } from '@/lib/llm/usage';

interface UsageRow {
  agent: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached: boolean;
}

export const GET = withAuth(async ({ supabase }) => {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data, error } = await supabase
    .from('llm_usage' as string)
    .select('agent, model, input_tokens, output_tokens, cached')
    .gte('created_at', monthStart);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as UsageRow[];
  const totalCalls = rows.length;
  const cachedCalls = rows.filter(r => r.cached).length;
  const totalInputTokens = rows.reduce((sum, r) => sum + r.input_tokens, 0);
  const totalOutputTokens = rows.reduce((sum, r) => sum + r.output_tokens, 0);
  const estimatedCostMicroCents = rows.reduce(
    (sum, r) => sum + estimateCostMicroCents(r.model, r.input_tokens, r.output_tokens),
    0
  );

  const byAgent: Record<string, { calls: number; inputTokens: number; outputTokens: number; cachedCalls: number }> = {};
  for (const row of rows) {
    if (!byAgent[row.agent]) byAgent[row.agent] = { calls: 0, inputTokens: 0, outputTokens: 0, cachedCalls: 0 };
    byAgent[row.agent].calls += 1;
    byAgent[row.agent].inputTokens += row.input_tokens;
    byAgent[row.agent].outputTokens += row.output_tokens;
    if (row.cached) byAgent[row.agent].cachedCalls += 1;
  }

  return NextResponse.json({
    data: {
      totalCalls,
      cachedCalls,
      cacheHitRate: totalCalls > 0 ? Math.round((cachedCalls / totalCalls) * 100) : 0,
      totalInputTokens,
      totalOutputTokens,
      estimatedCostCents: Math.round(estimatedCostMicroCents / 1000),
      byAgent,
    },
  });
});
