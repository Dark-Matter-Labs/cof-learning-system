import type { ReflectionReport } from '@/lib/agents/reflection';

export interface DecisionEntry {
  readonly text: string;
  readonly node_id: string | null;
}

export interface ReflectionSessionPayload {
  readonly machine_reflection: ReflectionReport | Record<string, never>;
  readonly human_responses: Record<string, string>;
  readonly decisions: readonly DecisionEntry[];
  readonly convergence_snapshot: Record<string, { readonly score: number; readonly computed_at: string }>;
  readonly participants: readonly string[];
  readonly node_count_at_reflection: number;
  readonly triggered_by: 'on_demand';
}

export interface GoalSpaceInfo {
  readonly id: string;
  readonly title: string;
}

export interface ReflectionSession {
  readonly id: string;
  readonly machine_reflection: ReflectionReport | Record<string, never>;
  readonly human_responses: Record<string, string>;
  readonly decisions: readonly DecisionEntry[];
  readonly convergence_snapshot: Record<string, { readonly score: number; readonly computed_at: string }>;
  readonly participants: readonly string[];
  readonly created_at: string;
}
