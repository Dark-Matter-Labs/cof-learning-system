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
}

export const CAPTURE_TYPES: readonly CaptureTypeConfig[] = [
  {
    id: 'hunch',
    label: 'Hunch',
    nodeType: 'hunch',
    description: 'A rough intuition or early signal worth tracking',
    fields: ['hunch_type', 'confidence', 'external_link', 'expected_signals', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
  },
  {
    id: 'assumption_background',
    label: 'Background Assumption',
    nodeType: 'assumption_background',
    description: 'An assumption operating in the background',
    fields: ['confidence', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
  },
  {
    id: 'assumption_foreground',
    label: 'Foreground Assumption',
    nodeType: 'assumption_foreground',
    description: 'An assumption actively being tested',
    fields: ['confidence', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
  },
  {
    id: 'test',
    label: 'Test',
    nodeType: 'test',
    description: 'An experiment or test to validate an assumption',
    fields: ['confidence', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
  },
  {
    id: 'learning',
    label: 'Learning',
    nodeType: 'learning',
    description: 'A confirmed insight from a test or observation',
    fields: ['confidence', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
  },
  {
    id: 'option',
    label: 'Option',
    nodeType: 'option',
    description: 'A potential path or opportunity being considered',
    fields: ['confidence', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
  },
  {
    id: 'commitment',
    label: 'Commitment',
    nodeType: 'commitment',
    description: 'A resource allocation or delivery obligation',
    fields: ['insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
  },
  {
    id: 'signal',
    label: 'Signal',
    nodeType: 'signal',
    description: 'An observable indicator of progress or change',
    fields: ['confidence', 'expected_signals', 'insight_date'],
    supportsExtraction: true,
    multiNodeExtraction: false,
  },
  {
    id: 'goal_space',
    label: 'Goal Space',
    nodeType: 'goal_space',
    description: 'A high-level goal area the team is pursuing',
    fields: ['insight_date'],
    supportsExtraction: false,
    multiNodeExtraction: false,
  },
  {
    id: 'trigger_outcome',
    label: 'Trigger Outcome',
    nodeType: 'trigger_outcome',
    description: 'A measurable outcome that would indicate goal progress',
    fields: ['insight_date'],
    supportsExtraction: false,
    multiNodeExtraction: false,
  },
  {
    id: 'meeting_notes',
    label: 'Meeting Notes / Transcript',
    nodeType: 'meeting_notes',
    description: 'A call or meeting transcript — extracts multiple nodes',
    fields: ['meeting_date', 'participants'],
    supportsExtraction: true,
    multiNodeExtraction: true,
  },
] as const;

export function getCaptureType(id: CaptureTypeId): CaptureTypeConfig | undefined {
  return CAPTURE_TYPES.find(t => t.id === id);
}

/** Types available in the inline graph card (excludes multi-node types) */
export function getInlineTypes(): readonly CaptureTypeConfig[] {
  return CAPTURE_TYPES.filter(t => !t.multiNodeExtraction);
}

/** Types available on the full capture page */
export function getPageTypes(): readonly CaptureTypeConfig[] {
  return CAPTURE_TYPES;
}

/** Structural node types used in the inline graph card */
export function getStructuralTypes(): readonly CaptureTypeConfig[] {
  const structuralIds: readonly CaptureTypeId[] = ['hunch', 'goal_space', 'trigger_outcome', 'commitment', 'entity' as CaptureTypeId];
  return CAPTURE_TYPES.filter(t => structuralIds.includes(t.id));
}
