# Feedback Loop — Design Spec

## Overview

An inline feedback mechanism on all AI-generated outputs (reflection, query, newsletter). User describes what is wrong in free text; an LLM correction agent determines which contributing nodes to update, archive, or create, and applies changes automatically — no review step.

---

## Architecture

**Option A — stored context + correction agent:**
Node references are stored at generation time. When feedback is submitted, the correction agent receives the original generated text, the contributing nodes (with full content), and the user's feedback, and applies corrections directly.

---

## Data Model

```sql
-- 1. Add node_refs to newsletters
ALTER TABLE newsletters ADD COLUMN node_refs UUID[] DEFAULT '{}';

-- 2. Persist query context (currently discarded after response)
CREATE TABLE query_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  response   TEXT NOT NULL,
  node_refs  UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_query_sessions_author ON query_sessions(author_id);

ALTER TABLE query_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own query sessions" ON query_sessions
  FOR ALL USING (author_id = auth.uid());

-- 3. Feedback records
CREATE TABLE feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type   TEXT NOT NULL CHECK (source_type IN ('reflection', 'query', 'newsletter')),
  source_id     UUID NOT NULL,
  feedback_text TEXT NOT NULL,
  applied_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_author ON feedback(author_id);
CREATE INDEX idx_feedback_source ON feedback(source_type, source_id);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own feedback" ON feedback
  FOR ALL USING (author_id = auth.uid());
```

Node references per source:
- **reflection** — node IDs already stored in `machine_reflection` JSONB (contradictions + recommendations with `target_node_id`)
- **query** — `query_sessions.node_refs` (populated from `X-Context-Nodes` at generation time)
- **newsletter** — `newsletters.node_refs` (populated at generation time from `select*Nodes()` results)

---

## Correction Agent

**Agent name:** `'correction'` — registered in `src/lib/llm/index.ts` using `claude-sonnet-4-6`.

### System prompt
```
You are a knowledge graph correction agent. The user has flagged an error in AI-generated output.
You will receive: the original generated text, the nodes that contributed to it (with their full content), and the user's feedback describing what is wrong.

Your job is to decide what corrections are needed and apply them as a JSON action list.

Actions available:
- update: modify title, description, or domain_tags on an existing node
- archive: set a node's status to 'archived' (use when a node contains fundamentally wrong information)
- create: add a new node with correct information (use when the user identifies something missing)

Rules:
- Only touch nodes that are directly relevant to the feedback
- Prefer update over archive unless the node is irreparably wrong
- Only create a node when the user explicitly identifies missing information
- Return ONLY valid JSON — no explanation, no markdown

Output schema:
{
  "reasoning": "one sentence explaining what was wrong",
  "actions": [
    { "action": "update", "node_id": "<uuid>", "fields": { "description": "corrected text" } },
    { "action": "archive", "node_id": "<uuid>" },
    { "action": "create", "node_type": "learning", "title": "...", "description": "..." }
  ]
}
```

### Inputs
- Generated text (the output the user is correcting)
- Contributing nodes: `{ id, node_type, title, description }[]`
- User's free-text feedback

### Execution flow (`src/lib/correction/agent.ts`)
1. Fetch node content for each ref from Supabase
2. Build prompt with generated text + nodes + feedback
3. Call `callLLM('correction', { systemPrompt, userMessage, maxTokens: 600 })`, parse JSON
4. Execute each action:
   - `update` → PATCH `/api/nodes/[id]` with `fields`
   - `archive` → PATCH `/api/nodes/[id]` with `{ status: 'archived' }`
   - `create` → POST `/api/nodes` with node fields
5. Mark `feedback.applied_at = NOW()`
6. On any action failure: log error, leave `applied_at` null

---

## API Routes

### `POST /api/feedback`
Body: `{ source_type: 'reflection' | 'query' | 'newsletter', source_id: string, feedback_text: string }`

1. Auth guard → 401 if not authenticated
2. Zod validate body → 400 on invalid
3. Fetch source record, verify it belongs to the user → 404 if not found or not owned
4. Extract node_refs from source record
5. Insert feedback row
6. Kick off `applyCorrection(...)` via `after()` (background, non-blocking)
7. Return `{ id, created_at }` with 201

The `after()` task calls `applyCorrection(feedbackId, sourceType, sourceId, nodeRefs, feedbackText, generatedText)`.

### Modified: `POST /api/query`
- After generating response: insert `query_sessions` row with `query_text`, `response`, `node_refs` (from `X-Context-Nodes`)
- Return `session_id` alongside the answer in the response body

### Modified: `POST /api/newsletters`
- Pass `node_refs` (IDs from `select*Nodes()`) into the newsletter insert

---

## UI

### `<FeedbackWidget>` — shared client component

```typescript
interface FeedbackWidgetProps {
  sourceType: 'reflection' | 'query' | 'newsletter'
  sourceId: string
}
```

**States:**
1. **Idle** — unobtrusive "Something wrong? Give feedback" link below the output
2. **Open** — expands to textarea + "Submit" button
3. **Submitting** — button loading state
4. **Done** — "Feedback received — corrections applying in the background"
5. **Error** — inline error, form stays open for retry

### Placement per surface

| Surface | Page | `sourceId` |
|---------|------|------------|
| Newsletter | `NewsletterTabs` (after generation) | newsletter `id` from POST response |
| Query | Query response area | `session_id` from updated POST /api/query |
| Reflect | Each reflection card | `reflection_session.id` (already available) |

---

## File Structure

| Action | Path |
|--------|------|
| Create | `supabase/v0.10-feedback.sql` |
| Create | `src/lib/correction/agent.ts` |
| Create | `src/lib/correction/__tests__/agent.test.ts` |
| Create | `src/app/api/feedback/route.ts` |
| Create | `src/components/feedback/FeedbackWidget.tsx` |
| Create | `src/components/feedback/__tests__/FeedbackWidget.test.tsx` |
| Modify | `src/lib/llm/index.ts` (add correction agent) |
| Modify | `src/app/api/query/route.ts` (persist query_session, return session_id) |
| Modify | `src/app/api/newsletters/route.ts` (populate node_refs on insert) |
| Modify | `src/components/newsletter/NewsletterTabs.tsx` (add FeedbackWidget) |
| Modify | Query response component (add FeedbackWidget) |
| Modify | Reflection card component (add FeedbackWidget) |

---

## Testing

### Unit — `src/lib/correction/__tests__/agent.test.ts`
- `buildCorrectionPrompt(generatedText, nodes, feedbackText)` — assert all node IDs and feedback text appear in output
- JSON parsing — mock `callLLM`, verify correct action extraction for update / archive / create
- Action execution — mock node API calls, assert PATCH/POST called with correct shape per action type

### API — `src/app/api/feedback/__tests__/route.test.ts`
- Unauthenticated → 401
- Invalid body → 400
- Source not found / not owned → 404
- Valid submission → 201, `after()` invoked
- `after()` failure does not affect the 201 response

### Component — `src/components/feedback/__tests__/FeedbackWidget.test.tsx`
- Idle: link visible, form hidden
- Opens on click
- Loading state on submit
- Confirmation on success
- Error shown and form stays open on failure

### Integration — modified routes
- Query route: response body includes `session_id`
- Newsletter route: DB row includes `node_refs`
