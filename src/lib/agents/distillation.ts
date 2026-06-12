import { callLLM } from '@/lib/llm';
import { z } from 'zod';
import { getDistillableTypes } from '@/lib/config/captureTypes';
import { parseLlmJson } from '@/lib/llm/parse';
import type { SupabaseClient } from '@supabase/supabase-js';

interface NodeSummary {
  readonly id: string;
  readonly title: string;
  readonly node_type: string;
  readonly description: string | null;
}

const clusterSchema = z.object({
  groups: z.array(z.object({
    node_ids: z.array(z.string()).min(2).max(5),
    rationale: z.string().min(1),
  })).optional(),
});

const distillableTypes = getDistillableTypes() as [string, ...string[]];
const synthesisSchema = z.object({
  title: z.string().min(1).max(300).trim(),
  summary: z.string().min(1).max(2000).trim(),
  node_type: z.enum(distillableTypes),
  rationale: z.string().min(1).max(500).trim(),
});

export async function runDistillation(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ created: number; errors: string[] }> {
  const { data: nodes, error: nodesError } = await supabase
    .from('nodes')
    .select('id, title, node_type, description')
    .in('status', ['promoted', 'human_reviewed'])
    .eq('author_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (nodesError) return { created: 0, errors: [`Failed to fetch nodes: ${nodesError.message}`] };
  if (!nodes?.length) return { created: 0, errors: [] };

  const nodeList = (nodes as NodeSummary[])
    .map(n => `[${n.id}] [${n.node_type}] ${n.title}\n${(n.description ?? '').slice(0, 150)}`)
    .join('\n\n');

  const clusterResult = await callLLM('digest', {
    systemPrompt: 'You are analyzing a knowledge graph for near-duplicate entries. Respond with JSON only.',
    userMessage: `Here are ${nodes.length} nodes from a knowledge graph:\n\n${nodeList}\n\nIdentify groups of 2-5 nodes that express the same core idea with minor variation (paraphrases, duplicates, or minor elaborations of the same point). Only group nodes that a thoughtful reader would consider worth merging — not merely related nodes.\n\nRespond with JSON only:\n{"groups": [{"node_ids": ["id1", "id2"], "rationale": "both express the idea that..."}]}\n\nIf no near-duplicates exist, respond: {"groups": []}`,
    maxTokens: 1024,
  });

  let groups: Array<{ node_ids: string[]; rationale: string }> = [];
  try {
    const parsed = parseLlmJson(clusterResult.content, clusterSchema);
    groups = parsed.groups ?? [];
  } catch {
    return { created: 0, errors: ['Cluster LLM response was not valid JSON or schema'] };
  }

  if (!groups.length) return { created: 0, errors: [] };

  const errors: string[] = [];
  let created = 0;
  const nodeMap = new Map((nodes as NodeSummary[]).map(n => [n.id, n]));

  for (const group of groups) {
    const groupNodes = group.node_ids.reduce<NodeSummary[]>((acc, id) => {
      const node = nodeMap.get(id);
      if (node) acc.push(node);
      return acc;
    }, []);

    if (groupNodes.length < 2) continue;

    const nodeDetails = groupNodes
      .map(n => `[${n.node_type}] ${n.title}\n${n.description ?? '(no description)'}`)
      .join('\n\n---\n\n');

    try {
      const synthResult = await callLLM('digest', {
        systemPrompt: 'You synthesise knowledge graph nodes into distilled summaries. Respond with JSON only.',
        userMessage: `Synthesise these ${groupNodes.length} knowledge nodes into a single, more precise distilled node.\n\n${nodeDetails}\n\nCombine the key insights and produce a distilled node that captures the essential claim more precisely than any individual node.\n\nRespond with JSON only:\n{"title": "...", "summary": "...", "node_type": "${distillableTypes.join('|')}", "rationale": "what was synthesised and why"}`,
        maxTokens: 1024,
      });

      const synthesis = parseLlmJson(synthResult.content, synthesisSchema);

      const { error } = await supabase.from('distillation_candidates').insert({
        node_ids: groupNodes.map(n => n.id),
        merged_title: synthesis.title,
        merged_summary: synthesis.summary,
        merged_node_type: synthesis.node_type,
        rationale: synthesis.rationale,
        created_by: userId,
      });

      if (error) {
        errors.push(`Failed to store candidate: ${error.message}`);
      } else {
        created++;
      }
    } catch (err) {
      const reason = err instanceof z.ZodError
        ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
        : err instanceof Error
          ? err.message
          : 'unknown error';
      errors.push(`Failed to synthesise group (${group.node_ids.join(', ')}): ${reason}`);
    }
  }

  return { created, errors };
}
