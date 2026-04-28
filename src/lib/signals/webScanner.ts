import { extractKeywords, filterRelevant } from './relevanceFilter';
import { ingestSignals, type SignalInput } from './signalIngestor';
import { callLLM } from '@/lib/llm';

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
  const keywords = extractKeywords(...topics.map(t => t.title));

  const allSignals: SignalInput[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    const config = source.config as { search_query?: string };
    const query = config.search_query ?? topics.find(t => t.id === source.topic_node_id)?.title ?? '';
    if (!query) continue;

    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
        { headers: { 'X-Subscription-Token': apiKey, 'Accept': 'application/json' } }
      );
      if (!res.ok) { errors.push(`Brave search failed for "${query}": ${res.status}`); continue; }

      const data = await res.json() as BraveResponse;
      const results = data.web?.results ?? [];

      const unseenResults: BraveResult[] = [];
      for (const result of results) {
        const { data: seen } = await supabase
          .from('seen_external_urls')
          .select('url')
          .eq('url', result.url)
          .single();
        if (!seen) unseenResults.push(result);
      }

      const relevant = filterRelevant(unseenResults, r => `${r.title} ${r.description}`, keywords, 5);
      if (!relevant.length) continue;

      await supabase.from('seen_external_urls').insert(
        relevant.map(r => ({ url: r.url, source_type: 'web', topic_node_id: source.topic_node_id }))
      );

      const batchContent = relevant.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\nURL: ${r.url}`).join('\n\n');
      const extractionResult = await callLLM('extraction', {
        systemPrompt: 'Extract relevant signals from these web articles. For each article, output JSON: {"signals": [{"title": "...", "summary": "..."}]}. Focus on concrete findings, data, or developments relevant to the query topic. Skip articles without clear substance.',
        userMessage: `Topic: "${query}"\n\nArticles:\n${batchContent}`,
        maxTokens: 1024,
      });

      type ExtractionOutput = { signals?: { title: string; summary: string }[] };
      let extracted: { title: string; summary: string }[] = [];
      try {
        const parsed = JSON.parse(extractionResult.content) as ExtractionOutput;
        extracted = parsed.signals ?? [];
      } catch {
        // non-fatal: malformed JSON from LLM
      }

      for (const e of extracted) {
        allSignals.push({
          title: e.title,
          summary: e.summary,
          sourceType: 'web',
          sourceAttribution: relevant[0]?.url ?? query,
          topicNodeId: source.topic_node_id as string,
          authorId: userId,
        });
      }
    } catch (err) {
      errors.push(`Web scan error for "${query}": ${String(err)}`);
    }

    await supabase.from('auto_signal_sources').update({ last_run_at: new Date().toISOString() }).eq('id', source.id);
  }

  const result = await ingestSignals(allSignals);
  return { ...result, errors };
}
