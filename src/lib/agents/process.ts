import type { Node } from '@/lib/types/nodes';
import { callLLM } from '@/lib/llm';
import { parseLlmJsonLoose } from '@/lib/llm/parse';
import type { GoalContext } from '@/lib/agents/extraction';

export interface SuggestedNodeImpact {
  readonly nodeId: string;
  readonly relationship: 'SUPPORTS' | 'CHALLENGES';
  readonly reasoning: string;
}

export interface SuggestedHunch {
  readonly suggested: boolean;
  readonly hunch: {
    readonly title: string;
    readonly description: string;
    readonly structured_claim: {
      readonly if: string;
      readonly then: string;
      readonly because: string;
    };
    readonly target_outcome_id: string | null;
  } | null;
  readonly reasoning: string;
}

export interface CommitmentWithAssumptions {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
}

export interface CommitmentAssessment {
  readonly commitmentId: string;
  readonly assessment: 'ON_TRACK' | 'NEEDS_ATTENTION' | 'REFRAME' | 'STOP';
  readonly reasoning: string;
}

const STEP1_SYSTEM_PROMPT = `You are an analysis system for the xCO (Expanding Civilisational Optionality). Your task is to identify which existing nodes in the knowledge graph a new learning or signal might affect.

Return ONLY valid JSON array:
[{ "nodeId": "uuid", "relationship": "SUPPORTS" | "CHALLENGES", "reasoning": "1-2 sentence explanation" }]

Only include nodes where the relationship is clear and meaningful. If a node is UNRELATED, exclude it. Aim for 1-5 relevant nodes maximum.`;

const STEP2_SYSTEM_PROMPT = `You are a strategic thinking assistant for xCO (Expanding Civilisational Optionality), working at the intersection of civilisational risk, institutional design, and transition finance.

Given a learning or signal, identify if it suggests a new strategic hunch worth exploring.

Return ONLY valid JSON:
{ "suggested": true/false, "hunch": { "title": "max 10 words", "description": "2-3 sentences", "structured_claim": { "if": "...", "then": "...", "because": "..." }, "target_outcome_id": "id or null" }, "reasoning": "why this hunch" }

If no hunch is clearly warranted, return { "suggested": false, "hunch": null, "reasoning": "why not" }`;

const STEP3_SYSTEM_PROMPT = `You are analyzing how a new learning or signal affects active resource commitments at xCO (Expanding Civilisational Optionality).

Return ONLY valid JSON array:
[{ "commitmentId": "uuid", "assessment": "ON_TRACK" | "NEEDS_ATTENTION" | "REFRAME" | "STOP", "reasoning": "1-2 sentence explanation" }]

Only include commitments where the learning is clearly relevant. If a commitment is unaffected, exclude it.`;

function parseJsonResponse<T>(content: string): T {
  // Handles both object and array responses (step 3 returns an array), plus
  // ```json fences and trailing prose.
  return parseLlmJsonLoose(content) as T;
}

export async function suggestAffectedNodes(
  sourceNode: Node,
  candidateNodes: Node[]
): Promise<SuggestedNodeImpact[]> {
  const candidateList = candidateNodes
    .map(n => `- id: ${n.id}, type: ${n.node_type}, title: "${n.title}"`)
    .join('\n');

  const userMessage = `Source node (${sourceNode.node_type}): "${sourceNode.title}"
${sourceNode.description ? `Description: ${sourceNode.description}` : ''}

Candidate nodes to evaluate:
${candidateList}`;

  const response = await callLLM('process', {
    systemPrompt: STEP1_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 1024,
    temperature: 0.3,
  });

  try {
    return parseJsonResponse<SuggestedNodeImpact[]>(response.content);
  } catch {
    return [];
  }
}

export async function suggestHunch(
  sourceNode: Node,
  goalContext: GoalContext
): Promise<SuggestedHunch | null> {
  const outcomeList = goalContext.triggerOutcomes
    .map(o => `- id: ${o.id}, title: "${o.title}"`)
    .join('\n');

  const userMessage = `Source node (${sourceNode.node_type}): "${sourceNode.title}"
${sourceNode.description ? `Description: ${sourceNode.description}` : ''}
${sourceNode.llm_extraction?.summary ? `Summary: ${sourceNode.llm_extraction.summary}` : ''}

Active trigger outcomes:
${outcomeList || '(none)'}`;

  const response = await callLLM('process', {
    systemPrompt: STEP2_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 1024,
    temperature: 0.4,
  });

  try {
    return parseJsonResponse<SuggestedHunch>(response.content);
  } catch {
    return null;
  }
}

export async function suggestCommitmentAssessments(
  sourceNode: Node,
  commitments: CommitmentWithAssumptions[]
): Promise<CommitmentAssessment[]> {
  const commitmentList = commitments
    .map(c => `- id: ${c.id}, title: "${c.title}"${c.description ? `, description: "${c.description}"` : ''}`)
    .join('\n');

  const userMessage = `Source node (${sourceNode.node_type}): "${sourceNode.title}"
${sourceNode.description ? `Description: ${sourceNode.description}` : ''}
${sourceNode.llm_extraction?.summary ? `Summary: ${sourceNode.llm_extraction.summary}` : ''}

Active commitments:
${commitmentList}`;

  const response = await callLLM('process', {
    systemPrompt: STEP3_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 1024,
    temperature: 0.3,
  });

  try {
    return parseJsonResponse<CommitmentAssessment[]>(response.content);
  } catch {
    return [];
  }
}
