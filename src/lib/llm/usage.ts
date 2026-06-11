import type { LLMResponse } from './index';

// Cost in micro-cents per 1k tokens (1 micro-cent = $0.00001).
// Per-1k micro-cents = (USD per 1M tokens) × 100. Rates per Anthropic pricing:
//   Haiku 4.5  $1 / $5    Sonnet 4.6  $3 / $15    Opus 4.7/4.8  $5 / $25
const MODEL_COSTS: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  'claude-haiku-4-5-20251001': { inputPer1k: 100, outputPer1k: 500 },
  'claude-haiku-4-5': { inputPer1k: 100, outputPer1k: 500 },
  'claude-sonnet-4-6': { inputPer1k: 300, outputPer1k: 1500 },
  'claude-sonnet-4-20250514': { inputPer1k: 300, outputPer1k: 1500 },
  'claude-opus-4-8': { inputPer1k: 500, outputPer1k: 2500 },
  'claude-opus-4-7': { inputPer1k: 500, outputPer1k: 2500 },
};

export function estimateCostMicroCents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = MODEL_COSTS[model] ?? { inputPer1k: 300, outputPer1k: 1500 };
  return Math.round((inputTokens / 1000) * costs.inputPer1k + (outputTokens / 1000) * costs.outputPer1k);
}

export async function logUsage(
  agent: string,
  model: string,
  response: LLMResponse,
  cached: boolean
): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    await supabase.from('llm_usage').insert({
      agent,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cached,
      user_id: user?.id ?? null,
    });
  } catch {
    // non-fatal: logging failure must never break the LLM call
  }
}
