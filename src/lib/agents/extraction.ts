import type { LlmExtraction } from '@/lib/types/nodes';
import { callLLM } from '@/lib/llm';

export interface GoalContext {
  readonly goalSpaces: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly triggerOutcomes: ReadonlyArray<{ readonly id: string; readonly title: string }>;
}

const SYSTEM_PROMPT = `You are an extraction system for the Civilization Options Fund (COF), a formation studio working at the intersection of civilisational risk, institutional design, and transition finance.

Given input text (which may be a rough note, call transcript, document excerpt, or transcribed audio), extract the following and return ONLY valid JSON with no other text:

{
  "title": "Concise title (max 10 words)",
  "summary": "2-3 sentence summary of the core insight or claim",
  "structured_claim": { "if": "condition", "then": "consequence", "because": "reasoning" } or null if no clear causal claim,
  "assumption_type": "background" or "foreground" or null,
  "entities": [{ "name": "...", "type": "person|organisation|site|concept" }],
  "domain_tags": ["dartmoor", "madrid", "copenhagen", "antarctica", "capital_strategy", "formation", "demand_architecture", "philanthropy", "natural_assets", "carbon", "water"],
  "suggested_connections": [{ "target_title": "existing concept name", "edge_type": "supports|contradicts|requires|challenges", "rationale": "why" }],
  "confidence_assessment": { "level": 1-5, "basis": "intuition|analogy|observation|early_evidence|strong_evidence" },
  "open_questions": ["question 1", "question 2"],
  "commitment_relevance": {
    "relevant": true,
    "commitment_areas": ["area 1", "area 2"],
    "tension_flag": false,
    "tension_description": null
  },
  "goal_relevance": [{ "outcome_id": "id of trigger outcome", "outcome_title": "title", "rationale": "why this node is relevant to this outcome" }],
  "expected_signals": ["signal that would indicate progress"]
}

Rules for commitment_relevance:
10. COMMITMENT_RELEVANCE: Does this hunch or signal relate to any existing commitments?
    Could it support, challenge, or inform reallocation of any committed resources?
    - Set relevant=true if this relates to resource allocation, delivery obligations, or active commitments
    - List commitment_areas as the domains/areas of work this might affect (e.g. "carbon", "philanthropy", "COF formation")
    - Set tension_flag=true ONLY if this DIRECTLY contradicts a known assumption a commitment depends on
    - If tension_flag is true, write a clear tension_description explaining the contradiction
    - If this is a signal that contradicts a known assumption, flag TENSION_FLAG: true prominently

Rules for goal_relevance and expected_signals (only present when goal context is provided):
11. GOAL_RELEVANCE: Which trigger outcomes does this node relate to? Only include outcomes from the provided list. Include outcome_id (exact ID from list), outcome_title, and a concise rationale. Omit if no clear relevance. This field is optional.
12. EXPECTED_SIGNALS: What observable signals would indicate this hunch/intervention is working or this signal is meaningful? List 1-3 concrete, measurable signals. This field is optional.

Mark uncertain extractions appropriately. All outputs are suggestions for human review.`;

export function buildExtractionPrompt(title: string, description: string, goalContext?: GoalContext): string {
  const base = `Title: ${title}\n\nDescription: ${description}`;

  if (!goalContext) {
    return base;
  }

  const hasGoalSpaces = goalContext.goalSpaces.length > 0;
  const hasTriggerOutcomes = goalContext.triggerOutcomes.length > 0;

  if (!hasGoalSpaces && !hasTriggerOutcomes) {
    return base;
  }

  const sections: string[] = [base, ''];

  if (hasGoalSpaces) {
    sections.push('Active goal spaces:');
    for (const gs of goalContext.goalSpaces) {
      sections.push(`- ${gs.title} (id: ${gs.id})`);
    }
  }

  if (hasTriggerOutcomes) {
    if (hasGoalSpaces) sections.push('');
    sections.push('Active trigger outcomes:');
    for (const to of goalContext.triggerOutcomes) {
      sections.push(`- ${to.title} (id: ${to.id})`);
    }
  }

  sections.push('');
  sections.push('If this node relates to any of the trigger outcomes above, include goal_relevance in your response using the exact outcome IDs provided.');

  return sections.join('\n');
}

export function parseExtractionResponse(content: string): LlmExtraction {
  // Strip markdown code fences if present
  const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  const parsed = JSON.parse(cleaned);

  // Validate required fields
  const required = ['title', 'summary', 'entities', 'domain_tags', 'suggested_connections', 'confidence_assessment', 'open_questions'];
  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return parsed as LlmExtraction;
}

export async function runExtraction(title: string, description: string, goalContext?: GoalContext): Promise<LlmExtraction> {
  const response = await callLLM('extraction', {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: buildExtractionPrompt(title, description, goalContext),
    maxTokens: 2048,
    temperature: 0.3,
  });

  return parseExtractionResponse(response.content);
}
