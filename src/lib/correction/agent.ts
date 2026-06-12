import type { SupabaseClient } from '@supabase/supabase-js';
import { callLLM } from '@/lib/llm';
import { parseLlmJsonLoose } from '@/lib/llm/parse';

const VALID_NODE_TYPES = new Set(['hunch', 'learning', 'commitment', 'signal', 'option', 'test']);

export interface CorrectionNode {
  readonly id: string;
  readonly node_type: string;
  readonly title: string;
  readonly description: string | null;
}

export type CorrectionAction =
  | { readonly action: 'update'; readonly node_id: string; readonly fields: { readonly title?: string; readonly description?: string; readonly domain_tags?: string[] } }
  | { readonly action: 'archive'; readonly node_id: string }
  | { readonly action: 'create'; readonly node_type: string; readonly title: string; readonly description: string };

export interface CorrectionResult {
  readonly reasoning: string;
  readonly actions: readonly CorrectionAction[];
}

const CORRECTION_SYSTEM_PROMPT = `You are a knowledge graph correction agent. The user has flagged an error in AI-generated output.
You will receive: the original generated text, the nodes that contributed to it (with their full content), and the user's feedback describing what is wrong.

Your job is to decide what corrections are needed and apply them as a JSON action list.

Actions available:
- update: modify title, description, or domain_tags on an existing node
- archive: set a node's status to 'archived' (use when a node contains fundamentally wrong information)
- create: add a new node with correct information (use when the user explicitly identifies something missing)

Rules:
- Only touch nodes that are directly relevant to the feedback
- Prefer update over archive unless the node is irreparably wrong
- Only create a node when the user explicitly identifies missing information
- Return ONLY valid JSON — no explanation, no markdown

Output schema:
{
  "reasoning": "one sentence explaining what was wrong",
  "actions": [
    { "action": "update", "node_id": "<uuid>", "fields": { "description": "corrected text" } },
    { "action": "archive", "node_id": "<uuid>" },
    { "action": "create", "node_type": "learning", "title": "...", "description": "..." }
  ]
}`;

export function buildCorrectionPrompt(
  generatedText: string,
  nodes: readonly CorrectionNode[],
  feedbackText: string
): string {
  const nodesSection = nodes.map(n =>
    `ID: ${n.id}\nType: ${n.node_type}\nTitle: ${n.title}\nDescription: ${n.description ?? '(none)'}`
  ).join('\n\n');

  return `ORIGINAL GENERATED OUTPUT:\n${generatedText}\n\nCONTRIBUTING NODES:\n${nodesSection}\n\nUSER FEEDBACK:\n${feedbackText}`;
}

export function parseCorrectionActions(rawJson: string): CorrectionResult {
  try {
    const parsed = parseLlmJsonLoose(rawJson) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return { reasoning: '', actions: [] };
    const obj = parsed as Record<string, unknown>;
    const reasoning = typeof obj['reasoning'] === 'string' ? obj['reasoning'] : '';
    if (!Array.isArray(obj['actions'])) return { reasoning, actions: [] };
    const actions = (obj['actions'] as unknown[]).filter((a): a is CorrectionAction => {
      if (typeof a !== 'object' || a === null) return false;
      const action = (a as Record<string, unknown>)['action'];
      return action === 'update' || action === 'archive' || action === 'create';
    });
    return { reasoning, actions };
  } catch {
    return { reasoning: '', actions: [] };
  }
}

/**
 * Splits LLM-proposed actions into those allowed to run and those rejected.
 *
 * `update`/`archive` may only target a node that was actually part of the
 * flagged output (i.e. present in `allowedNodeIds`). Feedback text is free user
 * input forwarded into the prompt, so without this guard a crafted message
 * could make the model emit an action against any node id in the graph.
 * `create` has no target and is always allowed.
 */
export function partitionCorrectionActions(
  actions: readonly CorrectionAction[],
  allowedNodeIds: ReadonlySet<string>,
): { allowed: CorrectionAction[]; rejected: CorrectionAction[] } {
  const allowed: CorrectionAction[] = [];
  const rejected: CorrectionAction[] = [];
  for (const action of actions) {
    if (action.action === 'create' || allowedNodeIds.has(action.node_id)) {
      allowed.push(action);
    } else {
      rejected.push(action);
    }
  }
  return { allowed, rejected };
}

export async function applyCorrection(
  feedbackId: string,
  nodeRefs: readonly string[],
  generatedText: string,
  feedbackText: string,
  supabase: SupabaseClient,
  authorId: string
): Promise<void> {
  const nodes: CorrectionNode[] = [];

  if (nodeRefs.length > 0) {
    const { data } = await supabase
      .from('nodes')
      .select('id, node_type, title, description')
      .in('id', nodeRefs);
    if (data) {
      for (const row of data) {
        nodes.push({
          id: row.id as string,
          node_type: row.node_type as string,
          title: row.title as string,
          description: (row.description ?? null) as string | null,
        });
      }
    }
  }

  const userMessage = buildCorrectionPrompt(generatedText, nodes, feedbackText);
  const llmResponse = await callLLM('correction', {
    systemPrompt: CORRECTION_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 600,
  });

  const { actions } = parseCorrectionActions(llmResponse.content);

  if (actions.length === 0) {
    console.error('[correction] LLM returned no actions for feedback:', feedbackId);
    return;
  }

  // Only let the agent mutate nodes that were actually part of the flagged
  // output. Anything targeting another node id is dropped (and logged).
  const allowedNodeIds = new Set(nodes.map(n => n.id));
  const { allowed: actionsToApply, rejected } = partitionCorrectionActions(actions, allowedNodeIds);
  if (rejected.length > 0) {
    console.error('[correction] dropped out-of-context actions for feedback:', feedbackId, rejected);
  }

  // Nothing applicable remains (e.g. every action targeted a node outside the
  // flagged context). Don't stamp applied_at for a no-op.
  if (actionsToApply.length === 0) {
    console.error('[correction] no in-context actions to apply for feedback:', feedbackId);
    return;
  }

  const errors: string[] = [];

  for (const action of actionsToApply) {
    if (action.action === 'update') {
      const { error } = await supabase.from('nodes').update(action.fields).eq('id', action.node_id);
      if (error) errors.push(`update ${action.node_id}: ${error.message}`);
    } else if (action.action === 'archive') {
      const { error } = await supabase.from('nodes').update({ status: 'archived' }).eq('id', action.node_id);
      if (error) errors.push(`archive ${action.node_id}: ${error.message}`);
    } else if (action.action === 'create') {
      if (!VALID_NODE_TYPES.has(action.node_type)) {
        errors.push(`create: invalid node_type '${action.node_type}'`);
        continue;
      }
      const { error } = await supabase.from('nodes').insert({
        node_type: action.node_type,
        title: action.title,
        description: action.description,
        status: 'raw',
        author_id: authorId,
        hunch_type: 'new',
        confidence_level: 3,
        confidence_basis: 'intuition',
      });
      if (error) errors.push(`create: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    console.error('[correction] action failures:', errors);
    return;
  }

  await supabase.from('feedback').update({ applied_at: new Date().toISOString() }).eq('id', feedbackId);
}
