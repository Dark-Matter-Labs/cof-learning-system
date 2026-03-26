export type TensionAlertType =
  | 'assumption_challenged'
  | 'test_diverged'
  | 'signal_contradicts'
  | 'commitment_stalled'
  | 'assumption_unsupported';

export type TensionSeverity = 'high' | 'medium' | 'low';
export type TensionStatus = 'active' | 'acknowledged' | 'resolved';

export interface TensionAlert {
  readonly id: string;
  readonly type: TensionAlertType;
  readonly severity: TensionSeverity;
  readonly description: string;
  readonly affected_assumption_id: string | null;
  readonly affected_commitment_ids: readonly string[];
  readonly source_node_id: string | null;
  readonly status: TensionStatus;
  readonly resolved_by: string | null;
  readonly resolved_action: string | null;
  readonly created_at: string;
  readonly resolved_at: string | null;
}

export type TensionResolutionAction =
  | 'revise_assumption'
  | 'revise_commitment'
  | 'create_test'
  | 'no_action';

export interface TensionResolution {
  readonly alertId: string;
  readonly action: TensionResolutionAction;
  readonly belief: string;
  readonly resolved_action: string;
}
