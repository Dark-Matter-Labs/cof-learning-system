import { z } from 'zod';
import { CAPTURE_TYPES } from '@/lib/config/captureTypes';

const NODE_TYPE_IDS = CAPTURE_TYPES.map(t => t.id) as [string, ...string[]];

// Statuses a client may legitimately set when manually creating a node (e.g.
// structural commitments/outcomes from the Commitments page, created already
// 'promoted'). Server-managed statuses — processing, llm_reviewed,
// flagged_for_review, error, archived — are intentionally excluded so they can
// only be reached through the proper pipeline.
const CLIENT_SETTABLE_STATUS = ['raw', 'promoted', 'human_reviewed'] as const;

/**
 * Whitelist schema for POST /api/graph/nodes. Zod strips any key not listed
 * here, which closes the mass-assignment hole: a client cannot set author_id,
 * llm_extraction/llm_review/human_review, id, lifecycle_stage, timestamps, or
 * any other server-owned column by stuffing it into the request body.
 */
export const nodeCreateSchema = z.object({
  node_type: z.enum(NODE_TYPE_IDS),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(10_000).nullish(),
  status: z.enum(CLIENT_SETTABLE_STATUS).default('raw'),
  hunch_type: z.string().max(50).optional(),
  confidence_level: z.number().int().min(1).max(5).optional(),
  domain_tags: z.array(z.string().max(100)).max(50).optional(),
  content: z.record(z.string(), z.unknown()).nullish(),
  insight_date: z.string().max(40).nullish(),
  parent_node_id: z.string().uuid().nullish(),
});

export type NodeCreateInput = z.infer<typeof nodeCreateSchema>;
