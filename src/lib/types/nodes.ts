export interface NodeType {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly icon: string | null;
  readonly sort_order: number;
  readonly is_active: boolean;
  readonly created_at: string;
}

export interface LlmExtraction {
  readonly title: string;
  readonly summary: string;
  readonly structured_claim: {
    readonly if: string;
    readonly then: string;
    readonly because: string;
  } | null;
  readonly assumption_type: 'background' | 'foreground' | null;
  readonly entities: ReadonlyArray<{
    readonly name: string;
    readonly type: 'person' | 'organisation' | 'site' | 'concept';
  }>;
  readonly domain_tags: readonly string[];
  readonly suggested_connections: ReadonlyArray<{
    readonly target_title: string;
    readonly edge_type: string;
    readonly rationale: string;
  }>;
  readonly confidence_assessment: {
    readonly level: 1 | 2 | 3 | 4 | 5;
    readonly basis: 'intuition' | 'analogy' | 'observation' | 'early_evidence' | 'strong_evidence';
  };
  readonly open_questions: readonly string[];
  readonly commitment_relevance: {
    readonly relevant: boolean;
    readonly commitment_areas: readonly string[];
    readonly tension_flag: boolean;
    readonly tension_description: string | null;
  } | null;
}

export interface HumanReview {
  readonly reviewed_at: string;
  readonly reviewer_id: string;
  readonly fields: Readonly<Record<string, {
    readonly action: 'accepted' | 'rejected' | 'edited';
    readonly original: unknown;
    readonly final: unknown;
  }>>;
  readonly connections_accepted: ReadonlyArray<{
    readonly target_node_id: string;
    readonly target_title: string;
    readonly edge_type: string;
  }>;
  readonly connections_rejected: readonly string[];
  readonly connections_added: ReadonlyArray<{
    readonly target_node_id: string;
    readonly edge_type: string;
  }>;
}

export interface ExternalLink {
  readonly url: string;
  readonly label: string;
  readonly added_at: string;
}

export interface Attachment {
  readonly storage_path: string;
  readonly filename: string;
  readonly mime_type: string;
  readonly size: number;
}

export type NodeStatus = 'raw' | 'processing' | 'llm_reviewed' | 'human_reviewed' | 'promoted' | 'error' | 'archived' | 'falsified' | 'suspended';
export type HunchType = 'new' | 'feedback' | 'test_result' | 'external_validation';
export type ConfidenceBasis = 'intuition' | 'analogy' | 'observation' | 'early_evidence' | 'strong_evidence';

export interface Node {
  readonly id: string;
  readonly node_type: string;
  readonly title: string;
  readonly description: string | null;
  readonly content: unknown | null;
  readonly hunch_type: HunchType | null;
  readonly confidence_level: number | null;
  readonly confidence_basis: ConfidenceBasis | null;
  readonly status: NodeStatus;
  readonly llm_extraction: LlmExtraction | null;
  readonly llm_review: unknown | null;
  readonly human_review: HumanReview | null;
  readonly author_id: string | null;
  readonly parent_node_id: string | null;
  readonly domain_tags: readonly string[];
  readonly external_links: readonly ExternalLink[];
  readonly attachments: readonly Attachment[];
  readonly created_at: string;
  readonly updated_at: string;
}
