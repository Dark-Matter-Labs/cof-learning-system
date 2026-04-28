import { extractKeywords, filterRelevant } from './relevanceFilter';
import { ingestSignals, type SignalInput } from './signalIngestor';
import { callLLM } from '@/lib/llm';
import { z } from 'zod';

const extractedSignalSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  summary: z.string().min(1).max(2000).trim(),
});
const extractionOutputSchema = z.object({ signals: z.array(extractedSignalSchema).optional() });

interface BraveResult {
  readonly title: string;
  readonly url: string;
  readonly description: string;
}

interface BraveResponse {
  readonly web?: {
    readonly results?: BraveResult[];
  };
}

interface ActiveTopic {
  readonly id: string;
  readonly title: string;
  readonly node_type: string;
}

export async function scanWebForTopics(userId: string): Promise<{ created: number; skipped: number; errors: string[] }> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return { created: 0, skipped: 0, errors: ['BRAVE_SEARCH_API_KEY not configured'] };
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data: sources } = await supabase
    .from('auto_signal_sources')
    .select('id, topic_node_id, config')
    .eq('source_type', 'web')
    .eq('enabled', true);

  if (!sources?.length) return { created: 0, skipped: 0, errors: [] };

  const topicIds = sources.map(s => s.topic_node_id as string).filter(Boolean);
  const { data: topicNodes } = await supabase
    .from('nodes')
    .select('id, title, node_type')
    .in('id', topicIds)
    .neq('status', 'archived');

  const topics = (topicNodes ?? []) as ActiveTopic[];
  const keywords = extractKeywords(topics.map(t => t.title));

  const allSignals: SignalInput[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    const rawConfig = source.config as Record<string, unknown>;
    const rawQuery = typeof rawConfig?.search_query === 'string' ? rawConfig.search_query : undefined;
    const query = rawQuery ?? topics.find(t => t.id === source.topic_node_id)?.title ?? '';
    if (!query) continue;

    let sourceScanSucceeded = false;

    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
        {
          headers: { 'X-Subscription-Token': apiKey, 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) {
        process.stderr.write(`[signals] Brave search failed for "${query}": ${res.status}\n`);
        errors.push(`Brave search unavailable for a source`);
        continue;
      }

      const data = await res.json() as BraveResponse;
      const results = data.web?.results ?? [];

      const urls = results.map(r => r.url);
      const { data: seenRows } = await supabase
        .from('seen_external_urls')
        .select('url')
        .in('url', urls);
      const seenSet = new Set((seenRows ?? []).map(r => r.url as string));
      const unseenResults = results.filter(r => !seenSet.has(r.url));

      const relevant = filterRelevant(unseenResults, r => `${r.title} ${r.description}`, keywords, 5);
      if (!relevant.length) {
        sourceScanSucceeded = true;
        continue;
      }

      const { error: seenInsertError } = await supabase.from('seen_external_urls').insert(
        relevant.map(r => ({ url: r.url, source_type: 'web', topic_node_id: source.topic_node_id }))
      );
      if (seenInsertError) {
        process.stderr.write(`[signals] Failed to record seen URLs for "${query}": ${seenInsertError.message}\n`);
        errors.push(`Deduplication failed for a source — skipping to avoid reprocessing`);
        continue;
      }

      const batchContent = relevant.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\nURL: ${r.url}`).join('\n\n');
      const extractionResult = await callLLM('extraction', {
        systemPrompt: 'Extract relevant signals from these web articles. For each article, output JSON: {"signals": [{"title": "...", "summary": "..."}]}. Focus on concrete findings, data, or developments relevant to the query topic. Skip articles without clear substance.',
        userMessage: `Topic: "${query}"\n\nArticles:\n${batchContent}`,
        maxTokens: 1024,
      });

      let extracted: z.infer<typeof extractedSignalSchema>[] = [];
      try {
        const parsed = extractionOutputSchema.parse(JSON.parse(extractionResult.content));
        extracted = parsed.signals ?? [];
      } catch {
        // non-fatal: malformed or schema-invalid LLM output
      }

      const attributionUrl = relevant.map(r => r.url).join('; ');
      for (const e of extracted) {
        allSignals.push({
          title: e.title,
          summary: e.summary,
          sourceType: 'web',
          sourceAttribution: attributionUrl,
          topicNodeId: source.topic_node_id as string,
          authorId: userId,
        });
      }

      sourceScanSucceeded = true;
    } catch (err) {
      process.stderr.write(`[signals] Web scan error for "${query}": ${String(err)}\n`);
      errors.push(`Scan failed for source (see server logs)`);
    }

    if (sourceScanSucceeded) {
      await supabase.from('auto_signal_sources').update({ last_run_at: new Date().toISOString() }).eq('id', source.id);
    }
  }

  const result = await ingestSignals(allSignals);
  return { ...result, errors };
}
