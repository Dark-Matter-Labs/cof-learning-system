// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReflectionContext {
  readonly goalSpaces: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly triggerOutcomes: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly goal_space_id: string;
  }>;
  readonly nodes: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly node_type: string;
    readonly status: string;
    readonly description: string | null;
    readonly author_id: string | null;
  }>;
  readonly convergenceSnapshots: ReadonlyArray<{
    readonly goal_space_id: string;
    readonly score: number;
    readonly computed_at: string;
  }>;
  readonly activeTensions: ReadonlyArray<{
    readonly type: string;
    readonly severity: string;
    readonly description: string;
  }>;
  readonly activityByAuthor: ReadonlyArray<{
    readonly author_id: string;
    readonly node_count: number;
  }>;
}

export interface ReflectionReport {
  readonly patterns: readonly string[];
  readonly contradictions: ReadonlyArray<{
    readonly description: string;
    readonly node_ids: readonly string[];
  }>;
  readonly coverage_gaps: readonly string[];
  readonly trajectory: string;
  readonly recommendations: ReadonlyArray<{
    readonly text: string;
    readonly action_type: 'stop' | 'strengthen' | 'reframe' | null;
    readonly target_node_id: string | null;
  }>;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

export const REFLECTION_SYSTEM_PROMPT = `You are a strategic reflection analyst for the Civilization Options Fund (COF), a formation studio working at the intersection of civilisational risk, institutional design, and transition finance.

You will be given a structured snapshot of the COF knowledge graph including goal spaces, trigger outcomes, nodes, convergence scores, active tensions, and per-author activity.

Your task is to perform a deep analysis and return ONLY valid JSON with no other text, using this exact schema:

{
  "patterns": ["string describing a recurring pattern in the knowledge graph"],
  "contradictions": [{ "description": "what contradicts what", "node_ids": ["id1", "id2"] }],
  "coverage_gaps": ["string describing an area lacking evidence or exploration"],
  "trajectory": "single paragraph describing whether goal spaces are converging or drifting overall",
  "recommendations": [
    {
      "text": "specific actionable recommendation",
      "action_type": "stop" | "strengthen" | "reframe" | null,
      "target_node_id": "node or goal space id, or null if system-wide"
    }
  ]
}

Reasoning guidelines:

1. PATTERNS: Identify recurring themes, framing assumptions, or structural biases across the node graph. Look for over-represented domains, under-explored areas, and systemic patterns in how the team is building knowledge.

2. CONTRADICTIONS: Find nodes whose content or status directly contradicts each other. Include the node IDs so the UI can link to them.

3. COVERAGE GAPS: Identify goal spaces or trigger outcomes that have insufficient supporting nodes, signals, or evidence. Flag areas where the team is committing without adequate search.

4. TRAJECTORY: Synthesise the convergence score data to give an overall assessment — are commitments and search vectors spiralling together or apart? Be direct and specific.

5. RECOMMENDATIONS: Each recommendation must be framed as one of:
   - stop: cease an unproductive pattern (e.g. adding more hunches without follow-up signals)
   - strengthen: double down on a productive pattern that is working
   - reframe: look at something from a different angle to unlock new insight
   Use these as the action_type values. Set action_type to null only for general observations with no specific framing.

6. AUTHOR BLIND SPOTS: Reason about per-author blind spots using the activityByAuthor data. Identify which authors may be over-represented or under-represented in specific goal areas. Consider whether the distribution of contributions creates systemic blind spots. Include author blind spots as patterns or coverage_gaps where relevant.

Return only the JSON object. No preamble. No explanation. No markdown fences.`;

// ─── buildReflectionPrompt ────────────────────────────────────────────────────

export function buildReflectionPrompt(ctx: ReflectionContext): string {
  const sections: string[] = [];

  sections.push('Goal Spaces:');
  if (ctx.goalSpaces.length === 0) {
    sections.push('  (none)');
  } else {
    for (const gs of ctx.goalSpaces) {
      sections.push(`  - ${gs.title} (id: ${gs.id})`);
    }
  }

  sections.push('');
  sections.push('Trigger Outcomes:');
  if (ctx.triggerOutcomes.length === 0) {
    sections.push('  (none)');
  } else {
    for (const to of ctx.triggerOutcomes) {
      sections.push(`  - ${to.title} (id: ${to.id}, goal_space_id: ${to.goal_space_id})`);
    }
  }

  sections.push('');
  sections.push('Nodes:');
  if (ctx.nodes.length === 0) {
    sections.push('  (none)');
  } else {
    for (const node of ctx.nodes) {
      const desc = node.description != null ? node.description.slice(0, 200) : '';
      const authorPart = node.author_id != null ? `, author: ${node.author_id}` : '';
      sections.push(
        `  - [${node.node_type}/${node.status}] ${node.title} (id: ${node.id}${authorPart})`
      );
      if (desc.length > 0) {
        sections.push(`    ${desc}`);
      }
    }
  }

  sections.push('');
  sections.push('Convergence Scores:');
  if (ctx.convergenceSnapshots.length === 0) {
    sections.push('  (none)');
  } else {
    for (const snap of ctx.convergenceSnapshots) {
      sections.push(
        `  - goal_space_id: ${snap.goal_space_id}, score: ${snap.score}, computed_at: ${snap.computed_at}`
      );
    }
  }

  sections.push('');
  sections.push('Active Tensions:');
  if (ctx.activeTensions.length === 0) {
    sections.push('  (none)');
  } else {
    for (const tension of ctx.activeTensions) {
      sections.push(`  - [${tension.type}/${tension.severity}] ${tension.description}`);
    }
  }

  sections.push('');
  sections.push('Activity by Author:');
  if (ctx.activityByAuthor.length === 0) {
    sections.push('  (none)');
  } else {
    for (const activity of ctx.activityByAuthor) {
      sections.push(`  - ${activity.author_id}: ${activity.node_count} nodes`);
    }
  }

  return sections.join('\n');
}

// ─── parseReflectionResponse ──────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  'patterns',
  'contradictions',
  'coverage_gaps',
  'trajectory',
  'recommendations',
] as const;

export function parseReflectionResponse(content: string): ReflectionReport {
  // Strip markdown code fences if present
  const cleaned = content
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  const parsed: unknown = JSON.parse(cleaned);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Reflection response must be a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return obj as unknown as ReflectionReport;
}
