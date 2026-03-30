import { describe, it, expect } from 'vitest';
import {
  buildReflectionPrompt,
  parseReflectionResponse,
  REFLECTION_SYSTEM_PROMPT,
} from '../reflection';

// ─── Type definitions (mirroring what reflection.ts must export) ──────────────

interface ReflectionContext {
  readonly goalSpaces: ReadonlyArray<{ id: string; title: string }>;
  readonly triggerOutcomes: ReadonlyArray<{ id: string; title: string; goal_space_id: string }>;
  readonly nodes: ReadonlyArray<{ id: string; title: string; node_type: string; status: string; description: string | null; author_id: string | null }>;
  readonly convergenceSnapshots: ReadonlyArray<{ goal_space_id: string; score: number; computed_at: string }>;
  readonly activeTensions: ReadonlyArray<{ type: string; severity: string; description: string }>;
  readonly activityByAuthor: ReadonlyArray<{ author_id: string; node_count: number }>;
}

interface ReflectionReport {
  readonly patterns: readonly string[];
  readonly contradictions: ReadonlyArray<{ description: string; node_ids: readonly string[] }>;
  readonly coverage_gaps: readonly string[];
  readonly trajectory: string;
  readonly recommendations: ReadonlyArray<{
    readonly text: string;
    readonly action_type: 'stop' | 'strengthen' | 'reframe' | null;
    readonly target_node_id: string | null;
  }>;
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const fullContext: ReflectionContext = {
  goalSpaces: [
    { id: 'gs-1', title: 'Carbon Transition Capital' },
    { id: 'gs-2', title: 'Formation Infrastructure' },
  ],
  triggerOutcomes: [
    { id: 'to-1', title: 'Raise £10M by Q4', goal_space_id: 'gs-1' },
    { id: 'to-2', title: 'Launch pilot fund', goal_space_id: 'gs-1' },
    { id: 'to-3', title: 'Build institution pipeline', goal_space_id: 'gs-2' },
  ],
  nodes: [
    {
      id: 'n-1',
      title: 'Carbon markets are tightening',
      node_type: 'hunch',
      status: 'promoted',
      description: 'Evidence suggests carbon credit supply is being restricted artificially by large players',
      author_id: 'author-indy',
    },
    {
      id: 'n-2',
      title: 'Institutional capital still risk-averse',
      node_type: 'assumption',
      status: 'human_reviewed',
      description: 'Most pension funds remain cautious about transition finance despite regulatory push',
      author_id: 'author-gurden',
    },
    {
      id: 'n-3',
      title: 'Long description node',
      node_type: 'signal',
      status: 'raw',
      description: 'A'.repeat(300),
      author_id: 'author-indy',
    },
  ],
  convergenceSnapshots: [
    { goal_space_id: 'gs-1', score: 3.5, computed_at: '2026-03-28T00:00:00Z' },
    { goal_space_id: 'gs-2', score: -1.2, computed_at: '2026-03-28T00:00:00Z' },
  ],
  activeTensions: [
    {
      type: 'assumption_challenged',
      severity: 'high',
      description: 'Signal contradicts core assumption about capital availability',
    },
  ],
  activityByAuthor: [
    { author_id: 'author-indy', node_count: 12 },
    { author_id: 'author-gurden', node_count: 3 },
  ],
};

const emptyContext: ReflectionContext = {
  goalSpaces: [],
  triggerOutcomes: [],
  nodes: [],
  convergenceSnapshots: [],
  activeTensions: [],
  activityByAuthor: [],
};

// ─── buildReflectionPrompt tests ──────────────────────────────────────────────

describe('buildReflectionPrompt', () => {
  it('returns a string containing "Goal Spaces:" section header', () => {
    const prompt = buildReflectionPrompt(fullContext);
    expect(prompt).toContain('Goal Spaces:');
  });

  it('returns a string containing "Trigger Outcomes:" section header', () => {
    const prompt = buildReflectionPrompt(fullContext);
    expect(prompt).toContain('Trigger Outcomes:');
  });

  it('returns a string containing "Nodes:" section header', () => {
    const prompt = buildReflectionPrompt(fullContext);
    expect(prompt).toContain('Nodes:');
  });

  it('returns a string containing "Convergence Scores:" section header', () => {
    const prompt = buildReflectionPrompt(fullContext);
    expect(prompt).toContain('Convergence Scores:');
  });

  it('returns a string containing "Active Tensions:" section header', () => {
    const prompt = buildReflectionPrompt(fullContext);
    expect(prompt).toContain('Active Tensions:');
  });

  it('returns a string containing "Activity by Author:" section header', () => {
    const prompt = buildReflectionPrompt(fullContext);
    expect(prompt).toContain('Activity by Author:');
  });

  it('includes goal space titles in the prompt', () => {
    const prompt = buildReflectionPrompt(fullContext);
    expect(prompt).toContain('Carbon Transition Capital');
    expect(prompt).toContain('Formation Infrastructure');
  });

  it('includes node titles in the prompt', () => {
    const prompt = buildReflectionPrompt(fullContext);
    expect(prompt).toContain('Carbon markets are tightening');
    expect(prompt).toContain('Institutional capital still risk-averse');
  });

  it('includes convergence scores in the prompt', () => {
    const prompt = buildReflectionPrompt(fullContext);
    expect(prompt).toContain('3.5');
    expect(prompt).toContain('-1.2');
  });

  it('includes tension descriptions in the prompt', () => {
    const prompt = buildReflectionPrompt(fullContext);
    expect(prompt).toContain('Signal contradicts core assumption about capital availability');
  });

  it('includes author activity in the prompt', () => {
    const prompt = buildReflectionPrompt(fullContext);
    expect(prompt).toContain('author-indy');
    expect(prompt).toContain('author-gurden');
  });

  it('truncates node descriptions to 200 characters maximum', () => {
    const prompt = buildReflectionPrompt(fullContext);
    // n-3 has a 300-char description — should be sliced to 200
    expect(prompt).toContain('A'.repeat(200));
    expect(prompt).not.toContain('A'.repeat(201));
  });

  it('with empty context returns a valid string containing all section headers', () => {
    const prompt = buildReflectionPrompt(emptyContext);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('Goal Spaces:');
    expect(prompt).toContain('Trigger Outcomes:');
    expect(prompt).toContain('Nodes:');
    expect(prompt).toContain('Convergence Scores:');
    expect(prompt).toContain('Active Tensions:');
    expect(prompt).toContain('Activity by Author:');
  });
});

// ─── REFLECTION_SYSTEM_PROMPT tests ──────────────────────────────────────────

describe('REFLECTION_SYSTEM_PROMPT', () => {
  it('instructs LLM to reason about per-author blind spots', () => {
    expect(REFLECTION_SYSTEM_PROMPT).toContain('author blind spots');
  });

  it('frames recommendations as stop / strengthen / reframe', () => {
    expect(REFLECTION_SYSTEM_PROMPT).toContain('stop');
    expect(REFLECTION_SYSTEM_PROMPT).toContain('strengthen');
    expect(REFLECTION_SYSTEM_PROMPT).toContain('reframe');
  });

  it('instructs LLM to return JSON with required fields', () => {
    expect(REFLECTION_SYSTEM_PROMPT).toContain('patterns');
    expect(REFLECTION_SYSTEM_PROMPT).toContain('contradictions');
    expect(REFLECTION_SYSTEM_PROMPT).toContain('coverage_gaps');
    expect(REFLECTION_SYSTEM_PROMPT).toContain('trajectory');
    expect(REFLECTION_SYSTEM_PROMPT).toContain('recommendations');
  });
});

// ─── parseReflectionResponse tests ───────────────────────────────────────────

const validReport = {
  patterns: ['Predominantly human/institutional framing', 'Strong focus on carbon markets'],
  contradictions: [
    {
      description: 'Carbon supply hunch contradicts institutional risk-aversion assumption',
      node_ids: ['n-1', 'n-2'],
    },
  ],
  coverage_gaps: ['No nodes about water or natural assets', 'Antarctica domain under-explored'],
  trajectory: 'Converging on carbon track; formation infrastructure drifting',
  recommendations: [
    {
      text: 'Stop adding low-confidence hunches without follow-up signals',
      action_type: 'stop',
      target_node_id: null,
    },
    {
      text: 'Strengthen the institutional capital assumption with more concrete signals',
      action_type: 'strengthen',
      target_node_id: 'n-2',
    },
    {
      text: 'Reframe the formation infrastructure goal space to include demand-side actors',
      action_type: 'reframe',
      target_node_id: 'gs-2',
    },
  ],
};

describe('parseReflectionResponse', () => {
  it('returns a typed ReflectionReport from valid plain JSON string', () => {
    const result: ReflectionReport = parseReflectionResponse(JSON.stringify(validReport));
    expect(result.patterns).toHaveLength(2);
    expect(result.contradictions).toHaveLength(1);
    expect(result.coverage_gaps).toHaveLength(2);
    expect(result.trajectory).toBe('Converging on carbon track; formation infrastructure drifting');
    expect(result.recommendations).toHaveLength(3);
  });

  it('parses all 5 sections correctly', () => {
    const result = parseReflectionResponse(JSON.stringify(validReport));
    expect(result.patterns[0]).toBe('Predominantly human/institutional framing');
    expect(result.contradictions[0].node_ids).toEqual(['n-1', 'n-2']);
    expect(result.recommendations[0].action_type).toBe('stop');
    expect(result.recommendations[1].action_type).toBe('strengthen');
    expect(result.recommendations[2].action_type).toBe('reframe');
  });

  it('strips markdown code fences before parsing', () => {
    const fenced = `\`\`\`json\n${JSON.stringify(validReport)}\n\`\`\``;
    const result = parseReflectionResponse(fenced);
    expect(result.patterns).toHaveLength(2);
    expect(result.trajectory).toBeTruthy();
  });

  it('strips markdown code fences without language tag', () => {
    const fenced = `\`\`\`\n${JSON.stringify(validReport)}\n\`\`\``;
    const result = parseReflectionResponse(fenced);
    expect(result.patterns).toHaveLength(2);
  });

  it('throws an Error with descriptive message when "patterns" field is missing', () => {
    const { patterns: _p, ...withoutPatterns } = validReport;
    expect(() => parseReflectionResponse(JSON.stringify(withoutPatterns))).toThrowError(
      /Missing required field: patterns/
    );
  });

  it('throws an Error with descriptive message when "recommendations" field is missing', () => {
    const { recommendations: _r, ...withoutRecs } = validReport;
    expect(() => parseReflectionResponse(JSON.stringify(withoutRecs))).toThrowError(
      /Missing required field: recommendations/
    );
  });

  it('throws on invalid JSON', () => {
    expect(() => parseReflectionResponse('not valid json')).toThrow();
  });

  it('handles recommendation with null action_type and null target_node_id', () => {
    const reportWithNulls = {
      ...validReport,
      recommendations: [
        { text: 'General observation', action_type: null, target_node_id: null },
      ],
    };
    const result = parseReflectionResponse(JSON.stringify(reportWithNulls));
    expect(result.recommendations[0].action_type).toBeNull();
    expect(result.recommendations[0].target_node_id).toBeNull();
  });

  it('handles contradictions with node_ids array', () => {
    const reportWithMultiNodeContradiction = {
      ...validReport,
      contradictions: [
        { description: 'Multiple nodes contradict each other', node_ids: ['n-1', 'n-2', 'n-3'] },
      ],
    };
    const result = parseReflectionResponse(JSON.stringify(reportWithMultiNodeContradiction));
    expect(result.contradictions[0].node_ids).toHaveLength(3);
    expect(result.contradictions[0].node_ids[2]).toBe('n-3');
  });

  it('throws on missing "contradictions" field', () => {
    const { contradictions: _c, ...withoutContradictions } = validReport;
    expect(() => parseReflectionResponse(JSON.stringify(withoutContradictions))).toThrowError(
      /Missing required field: contradictions/
    );
  });

  it('throws on missing "coverage_gaps" field', () => {
    const { coverage_gaps: _cg, ...withoutGaps } = validReport;
    expect(() => parseReflectionResponse(JSON.stringify(withoutGaps))).toThrowError(
      /Missing required field: coverage_gaps/
    );
  });

  it('throws on missing "trajectory" field', () => {
    const { trajectory: _t, ...withoutTrajectory } = validReport;
    expect(() => parseReflectionResponse(JSON.stringify(withoutTrajectory))).toThrowError(
      /Missing required field: trajectory/
    );
  });
});
