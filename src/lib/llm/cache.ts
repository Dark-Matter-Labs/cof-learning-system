import { createHash } from 'crypto';
import type { LLMResponse } from './index';

export interface CacheEntry {
  readonly response: LLMResponse;
  readonly expires_at: string | null;
  readonly hit_count: number;
}

const CACHE_TTL_MS: Record<string, number | null> = {
  extraction: null,
  review: null,
  process: null,
  reflection: 7 * 24 * 60 * 60 * 1000,
  setup: 24 * 60 * 60 * 1000,
};

const CACHED_AGENTS = new Set(['extraction', 'review', 'process', 'reflection', 'setup']);

export function hashRequest(agent: string, systemPrompt: string, userMessage: string, pdfBase64?: string): string {
  const material = pdfBase64
    ? `${agent}:${systemPrompt}:${userMessage}:${pdfBase64}`
    : `${agent}:${systemPrompt}:${userMessage}`;
  return createHash('sha256').update(material).digest('hex');
}

export function isExpired(expiresAt: string | null): boolean {
  if (expiresAt === null) return false;
  return new Date(expiresAt) < new Date();
}

export function shouldCache(agent: string): boolean {
  return CACHED_AGENTS.has(agent);
}

export function computeExpiresAt(agent: string): string | null {
  const ttlMs = CACHE_TTL_MS[agent] ?? null;
  if (ttlMs === null) return null;
  return new Date(Date.now() + ttlMs).toISOString();
}

export async function getCached(cacheKey: string): Promise<LLMResponse | null> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('llm_cache')
      .select('response, expires_at, hit_count')
      .eq('cache_key', cacheKey)
      .single();
    if (error || !data) return null;
    const entry = data as { response: unknown; expires_at: string | null; hit_count: number };
    if (isExpired(entry.expires_at)) return null;
    // Increment hit count fire-and-forget
    void supabase.from('llm_cache').update({ hit_count: entry.hit_count + 1 }).eq('cache_key', cacheKey);
    return entry.response as LLMResponse;
  } catch {
    return null;
  }
}

export async function setCached(cacheKey: string, agent: string, model: string, response: LLMResponse): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    await supabase.from('llm_cache').upsert({
      cache_key: cacheKey,
      agent,
      model,
      response,
      input_tokens: response.usage?.input_tokens ?? null,
      output_tokens: response.usage?.output_tokens ?? null,
      expires_at: computeExpiresAt(agent),
      hit_count: 0,
    });
  } catch {
    // non-fatal: cache write failure doesn't break the LLM call
  }
}
