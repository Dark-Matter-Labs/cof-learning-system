export type CaptureTypeId =
  | 'hunch'
  | 'assumption_background'
  | 'assumption_foreground'
  | 'test'
  | 'learning'
  | 'option'
  | 'commitment'
  | 'signal'
  | 'goal_space'
  | 'trigger_outcome'
  | 'meeting_notes';

export type CaptureField =
  | 'hunch_type'
  | 'confidence'
  | 'external_link'
  | 'expected_signals'
  | 'meeting_date'
  | 'participants'
  | 'insight_date';

export interface CaptureTypeConfig {
  readonly id: CaptureTypeId;
  readonly label: string;
  readonly nodeType: string;
  readonly description: string;
  readonly fields: readonly CaptureField[];
  readonly supportsExtraction: boolean;
  readonly multiNodeExtraction: boolean;
  readonly graph: {
    readonly color: string;
    readonly visible: boolean;
  };
  readonly llm: {
    readonly description: string;
  };
  readonly isKnowledgeNode: boolean;
  readonly isDistillable: boolean;
}

// ─── Deployment-level config ─────────────────────────────────────────────────
// Change these in a fork to match the tenant's vocabulary and domain.

export const ORG_CONTEXT = 'xCO (Expanding Civilisational Optionality), a formation studio working at the intersection of civilisational risk, institutional design, and transition finance';

export const DOMAIN_TAGS: readonly string[] = [
  'dartmoor', 'madrid', 'copenhagen', 'antarctica',
  'capital_strategy', 'formation', 'demand_architecture',
  'philanthropy', 'natural_assets', 'carbon', 'water',
];

/** The node type that gets the dedicated GoalSpacePanel in the graph. */
export const GOAL_CONTAINER_TYPE = 'goal_space';

/** The node type representing measurable outcomes. */
export const OUTCOME_TYPE = 'trigger_outcome';

// ─── Node type definitions ────────────────────────────────────────────────────

export const CAPTURE_TYPES: readonly CaptureTypeConfig[] = [
  {
    id: 'hunch',
    label: 'Hunch',
    nodeType: 'hunch',
    description: 'A rough intuition or early signal worth tracking',
    fields: ['hunch_type', 'confidence', 'external_link', 'expected_signals', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
    graph: { color: '#7F77DD', visible: true },
    llm: { description: 'A directional belief, emerging insight, or speculation about how things work' },
    isKnowledgeNode: false,
    isDistillable: true,
  },
  {
    id: 'assumption_background',
    label: 'Background Assumption',
    nodeType: 'assumption_background',
    description: 'An assumption operating in the background',
    fields: ['confidence', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
    graph: { color: '#1D9E75', visible: true },
    llm: { description: 'A contextual claim treated as given (e.g. "3-4° warming is coming")' },
    isKnowledgeNode: false,
    isDistillable: true,
  },
  {
    id: 'assumption_foreground',
    label: 'Foreground Assumption',
    nodeType: 'assumption_foreground',
    description: 'An assumption actively being tested',
    fields: ['confidence', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
    graph: { color: '#D85A30', visible: true },
    llm: { description: 'An actively testable if/then proposition' },
    isKnowledgeNode: false,
    isDistillable: true,
  },
  {
    id: 'test',
    label: 'Test',
    nodeType: 'test',
    description: 'An experiment or test to validate an assumption',
    fields: ['confidence', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
    graph: { color: '#D4537E', visible: true },
    llm: { description: 'A specific probe or experiment being run' },
    isKnowledgeNode: false,
    isDistillable: false,
  },
  {
    id: 'learning',
    label: 'Learning',
    nodeType: 'learning',
    description: 'A confirmed insight from a test or observation',
    fields: ['confidence', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
    graph: { color: '#378ADD', visible: true },
    llm: { description: 'A conclusion drawn from tests or signals' },
    isKnowledgeNode: true,
    isDistillable: true,
  },
  {
    id: 'option',
    label: 'Option',
    nodeType: 'option',
    description: 'A potential path or opportunity being considered',
    fields: ['confidence', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
    graph: { color: '#BA7517', visible: true },
    llm: { description: 'A potential path or strategic opportunity' },
    isKnowledgeNode: false,
    isDistillable: true,
  },
  {
    id: 'commitment',
    label: 'Commitment',
    nodeType: 'commitment',
    description: 'A resource allocation or delivery obligation',
    fields: ['insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
    graph: { color: '#185FA5', visible: true },
    llm: { description: 'A resource allocation or delivery obligation' },
    isKnowledgeNode: false,
    isDistillable: false,
  },
  {
    id: 'signal',
    label: 'Signal',
    nodeType: 'signal',
    description: 'An observable indicator of progress or change',
    fields: ['confidence', 'expected_signals', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
    graph: { color: '#A32D2D', visible: true },
    llm: { description: 'Feedback from reality — new data, a conversation result, external evidence' },
    isKnowledgeNode: true,
    isDistillable: false,
  },
  {
    id: 'goal_space',
    label: 'Goal Space',
    nodeType: 'goal_space',
    description: 'A high-level goal area the team is pursuing',
    fields: ['insight_date'],
    supportsExtraction: false,
    multiNodeExtraction: false,
    graph: { color: '#0F6E56', visible: true },
    llm: { description: 'A high-level goal area' },
    isKnowledgeNode: false,
    isDistillable: false,
  },
  {
    id: 'trigger_outcome',
    label: 'Trigger Outcome',
    nodeType: 'trigger_outcome',
    description: 'A measurable outcome that would indicate goal progress',
    fields: ['insight_date'],
    supportsExtraction: false,
    multiNodeExtraction: false,
    graph: { color: '#085041', visible: true },
    llm: { description: 'A measurable outcome indicating goal progress' },
    isKnowledgeNode: false,
    isDistillable: false,
  },
  {
    id: 'meeting_notes',
    label: 'Meeting Notes / Transcript',
    nodeType: 'meeting_notes',
    description: 'A call or meeting transcript — extracts multiple nodes',
    fields: ['meeting_date', 'participants'],
    supportsExtraction: true,
    multiNodeExtraction: true,
    graph: { color: '#888780', visible: false },
    llm: { description: 'A meeting or call transcript' },
    isKnowledgeNode: false,
    isDistillable: false,
  },
] as const;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getCaptureType(id: CaptureTypeId): CaptureTypeConfig | undefined {
  return CAPTURE_TYPES.find(t => t.id === id);
}

export function getInlineTypes(): readonly CaptureTypeConfig[] {
  return CAPTURE_TYPES.filter(t => !t.multiNodeExtraction);
}

export function getPageTypes(): readonly CaptureTypeConfig[] {
  return CAPTURE_TYPES;
}

export function getStructuralTypes(): readonly CaptureTypeConfig[] {
  const structuralIds: readonly CaptureTypeId[] = ['hunch', 'goal_space', 'trigger_outcome', 'commitment', 'entity' as CaptureTypeId];
  return CAPTURE_TYPES.filter(t => structuralIds.includes(t.id));
}

// ─── Derived config helpers ───────────────────────────────────────────────────
// These are the primary seam for a fork — consuming code imports these rather
// than hardcoding strings, so a fork only needs to change this file.

/** Node type options for the graph type filter. */
export function getGraphTypes(): ReadonlyArray<{ readonly id: string; readonly label: string; readonly color: string }> {
  return CAPTURE_TYPES
    .filter(t => t.graph.visible)
    .map(t => ({ id: t.id, label: t.label, color: t.graph.color }));
}

/** Node types that surface in the Health page "awaiting review" section. */
export function getKnowledgeReviewTypes(): readonly string[] {
  return CAPTURE_TYPES
    .filter(t => t.isKnowledgeNode)
    .map(t => t.id);
}

/** Pipe-separated node type string for LLM prompt JSON schemas. */
export function getLlmNodeTypeEnum(): string {
  return CAPTURE_TYPES
    .filter(t => t.supportsExtraction && !t.multiNodeExtraction)
    .map(t => t.id)
    .join('|');
}

/** Bulleted node type descriptions for LLM prompts. */
export function getLlmNodeTypeDescriptions(): string {
  return CAPTURE_TYPES
    .filter(t => t.supportsExtraction && !t.multiNodeExtraction)
    .map(t => `   - ${t.id}: ${t.llm.description}`)
    .join('\n');
}

/** Node types the distillation agent can merge nodes into. */
export function getDistillableTypes(): readonly string[] {
  return CAPTURE_TYPES
    .filter(t => t.isDistillable)
    .map(t => t.id);
}
