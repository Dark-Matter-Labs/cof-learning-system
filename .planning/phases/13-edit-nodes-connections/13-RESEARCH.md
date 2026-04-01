# Phase 13: Edit Nodes & Connections - Research

**Researched:** 2026-04-01
**Domain:** React inline edit UI, Next.js App Router dynamic API routes, Supabase PATCH/DELETE
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EDIT-01 | Node detail panel has Edit button that switches to edit mode (title, description, type, confidence, status, domain tags) | NodeDetailPanel.tsx is a pure read-only display component — needs edit mode state, PATCH API route for nodes, field inputs reusing QuickCaptureForm patterns |
| EDIT-02 | Node detail panel shows all current connections with edge type + connected node title, each with a Remove button | Panel already renders connections read-only — needs Remove button + DELETE API route for edges |
| EDIT-03 | User can add a new connection from the detail panel: search existing nodes, select edge type and direction, confirm | Needs NodeSearch component (can adapt PersonAutocomplete), edge type selector, direction toggle, then POST to existing /api/graph/edges |
</phase_requirements>

---

## Summary

Phase 13 upgrades the `NodeDetailPanel` from a read-only display into a full edit surface. The panel currently shows node metadata and connections but has no mutation capability. All mutations require new API routes — PATCH for node field updates (no route exists yet) and DELETE for edge removal (no route exists yet). The POST edge creation route already exists at `/api/graph/edges` and can be called directly from the panel for EDIT-03.

The codebase has clear, established patterns for all three capabilities: the `PersonAutocomplete` component provides an exact template for the node-search autocomplete needed in EDIT-03; `QuickCaptureForm` provides all the field input patterns for EDIT-01; and `GraphOSSurface` shows how to keep local state in sync after mutations. The `NodeDetailPanel` is a pure presentational component (no client directive, no state), so it must be converted to a `'use client'` component or wrapped in a client shell.

**Primary recommendation:** Convert `NodeDetailPanel` to a `'use client'` component with an `isEditing` boolean state. Split the 108-line file into view and edit sub-sections within the same file, keeping it under 400 lines. Create two new API routes — `PATCH /api/nodes/[id]/route.ts` and `DELETE /api/edges/[id]/route.ts` — following the exact pattern of existing routes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (useState, useCallback) | 19.2.4 | Edit mode toggle, form state, debounced search | Already in use throughout all interactive components |
| Supabase JS client | ^2.99.3 | PATCH/DELETE mutations via API routes | All data mutations go through API routes using `createClient` from `@/lib/supabase/server` |
| Next.js App Router dynamic routes | 16.2.1 | `/api/nodes/[id]` and `/api/edges/[id]` route handlers | Next.js docs confirm `params` is a `Promise<{ id: string }>` in this version |
| Tailwind CSS | ^4 | All styling; dark: variants required | Project uses Tailwind exclusively with dark mode support |
| Vitest + Testing Library | ^4.1.0 | Component tests in jsdom environment | Established test infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/config/captureTypes.ts` | local | `CAPTURE_TYPES` array provides node type list + label display for the type selector in edit mode | Already the canonical source for node type options |
| `@/lib/graph/queries.ts` | local | `getNodeConnections` already filters edges by node ID | Reuse in panel; no new utility needed |
| `@/components/shared/NodeTypeBadge.tsx` | local | Read-only type display in view mode | Keep using for the view mode header |

### No New Dependencies Required
All capabilities are achievable with existing packages.

---

## Architecture Patterns

### Recommended File Structure (Phase 13)

```
src/
├── app/api/
│   ├── nodes/
│   │   ├── search/route.ts              # EXISTS — search by title, any type
│   │   └── [id]/route.ts                # NEW — PATCH handler for node field updates
│   └── edges/
│       └── [id]/route.ts                # NEW — DELETE handler for edge removal
├── components/
│   ├── graph/
│   │   ├── NodeDetailPanel.tsx          # MODIFY — add 'use client', edit mode state
│   │   └── __tests__/
│   │       └── NodeDetailPanel.test.tsx # NEW — tests for edit mode toggle and save
│   └── shared/
│       └── NodeSearchAutocomplete.tsx   # NEW — generalised from PersonAutocomplete
```

### Pattern 1: Dynamic API Route with Params (Next.js 16)

Next.js 16 requires `params` to be awaited as a Promise. This is a breaking change from v13/v14.

```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
// File: src/app/api/nodes/[id]/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from('nodes')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

**Critical:** `params` is `Promise<{ id: string }>` in Next.js 16 — must `await params`. Existing routes with dynamic segments do not exist in this codebase yet, but this is the correct current convention per project CLAUDE.md ("This version has breaking changes — APIs may differ from training data").

### Pattern 2: Client Component with Edit Mode Toggle

The NodeDetailPanel is currently a pure server-compatible component (no `'use client'`). EDIT-01 requires local state.

```typescript
// Pattern used in: src/components/capture/PersonAutocomplete.tsx
// and src/components/capture/QuickCaptureForm.tsx
'use client';

import { useState, useCallback } from 'react';

export function NodeDetailPanel({ node, edges, allNodes, onClose }: NodeDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // ... edit fields initialized from node props

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/nodes/${node.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      // update local state, call onNodeUpdated if needed
    } finally {
      setIsSaving(false);
    }
  }, [node.id, editData]);
```

### Pattern 3: Realtime Sync After Mutations

`GraphOSSurface` already listens to `postgres_changes` on the `nodes` and `edges` tables (lines 121-158). This means:
- After a PATCH to a node, the UPDATE event fires and `GraphOSSurface` calls `setNodes(prev => prev.map(...))` automatically
- After a DELETE to an edge, there is **no edges realtime channel** — `edges` is not in the realtime subscription
- After a POST to create an edge, same: no automatic sync

**Implication for EDIT-02 and EDIT-03:** The panel needs a callback mechanism (`onEdgesChanged`) or it must maintain local edge state independently, OR `GraphOSSurface` needs an edges realtime subscription added.

Checking `GraphOSSurface` line 95-159 confirms: only `nodes` and `tension_alerts` channels are subscribed. The `edges` array is fetched once at startup. This is the key gap.

**Recommendation:** Add an `onEdgeAdded` and `onEdgeRemoved` callback to `NodeDetailPanelProps`. `GraphOSSurface` passes handlers that update its local `edges` state. This avoids a realtime subscription overhead and keeps the pattern consistent with how node selection already works via callbacks.

### Pattern 4: Node Search Autocomplete (Generalise PersonAutocomplete)

`PersonAutocomplete` is hardcoded to `type=person`. For EDIT-03, Robyn needs to search all node types. The `/api/nodes/search` route already accepts an optional `type` param — if omitted it defaults to `'person'`. The route must be updated to make `type` truly optional (search all types when absent).

Current route signature:
```typescript
const type = searchParams.get('type') ?? 'person';
// Query: .eq('node_type', type) — this will always filter by something
```

The route needs a branch: if `type` is provided, filter by node_type; if absent, return all promoted/human_reviewed nodes matching the title query.

A `NodeSearchAutocomplete` component generalises `PersonAutocomplete` with an optional `nodeTypeFilter?: string` prop. When absent, it passes no `type` param (all types). The Tailwind and pattern stay identical.

### Pattern 5: Domain Tags Inline Edit

The `domain_tags` field on `Node` is `readonly string[]` in TypeScript, stored as `TEXT[]` in Postgres. In edit mode, render it as a comma-separated tag input similar to the chip pattern in `PersonAutocomplete`.

Simple implementation:
- Display chips for each tag in view mode (already done in NodeDetailPanel lines 71-79)
- In edit mode: render an `<input>` where typing adds a tag on space/comma/enter, and chips have ×-remove buttons
- On save, send the final string array to the PATCH endpoint

### Anti-Patterns to Avoid

- **Mutating node prop directly:** Node is `readonly`. Initialize edit state by copying node fields into `useState` — never set fields on the original `node` prop.
- **Forgetting to await params:** In Next.js 16 dynamic routes, `params` is a Promise. `const { id } = params` will give undefined — must `await params`.
- **Using `/api/graph/nodes` for PATCH:** The existing route at `/api/graph/nodes` has GET and POST only. Create a new `/api/nodes/[id]` route — do not add PATCH to the collection endpoint (REST convention: `/nodes` is the collection, `/nodes/[id]` is the resource).
- **Assuming edges realtime updates automatically:** Only `nodes` and `tension_alerts` have realtime subscriptions. Edge mutations must be propagated via callbacks.
- **Hard-coding node type options:** Use `NODE_TYPE_OPTIONS` from `GraphOSSurface` (lines 17-31) or `CAPTURE_TYPES` from `captureTypes.ts` — the type list is authoritative there. Do not create a new local array.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Person/node autocomplete search | New search UI from scratch | Adapt `PersonAutocomplete` — identical pattern, just remove `type=person` hardcode | Saves ~80 lines, keeps consistent UX |
| Node type selector | New dropdown component | `<select>` with `NODE_TYPE_OPTIONS` from GraphOSSurface or `CAPTURE_TYPES` | Already maintained in two canonical places |
| Confidence level picker | New button group | Copy the button group from `QuickCaptureForm` lines 206-224 | Identical requirement, identical 5-level picker |
| Edge type list | Fetch from `edge_types` table dynamically | Use a static constant array from seed data — all 14 edge types are stable and known | Dynamic fetch adds complexity; edge types don't change at runtime |
| Tag input for domain_tags | A full tag library | Simple split-on-comma chip pattern (same as PersonAutocomplete chips) | The tag input is a lightweight requirement |
| Realtime edge sync | Add `edges` realtime channel | Callback props: `onEdgeAdded(edge)` and `onEdgeRemoved(edgeId)` in GraphOSSurface | Simpler, avoids subscription overhead for a low-frequency event |

---

## Common Pitfalls

### Pitfall 1: NodeDetailPanel Is Not a Client Component
**What goes wrong:** Edit mode requires `useState` but the current file has no `'use client'` directive.
**Why it happens:** The component was built as a pure display component passed props from a client parent.
**How to avoid:** Add `'use client'` at line 1 of `NodeDetailPanel.tsx`. Since `GraphOSSurface` is already a client component that imports it, this is straightforward — no structural changes needed.
**Warning signs:** TypeScript error "useState is not allowed in server components" or hydration mismatch.

### Pitfall 2: Stale `node` Prop After Save
**What goes wrong:** After saving edits, the panel still shows old data until the parent re-renders.
**Why it happens:** `GraphOSSurface` updates `nodes` state via realtime for node changes (UPDATE event fires). However there is a brief window before realtime arrives.
**How to avoid:** Optimistically update the edit form state to show the saved values immediately. The realtime UPDATE will arrive within ~100ms and the parent will pass the fresh `node` prop. For edges, use `onEdgeAdded`/`onEdgeRemoved` callbacks because there is no realtime channel.

### Pitfall 3: params Not Awaited in Dynamic Route
**What goes wrong:** `const { id } = params` in a Next.js 16 dynamic route returns `undefined` because params is a Promise.
**Why it happens:** Breaking change in Next.js 15+. The project is on 16.2.1 confirmed in package.json.
**How to avoid:** Always `const { id } = await params`.
**Warning signs:** Supabase query silently fails with id=undefined, returning no rows.

### Pitfall 4: Unique Constraint Violation When Adding Duplicate Edge
**What goes wrong:** `UNIQUE(source_id, target_id, edge_type)` constraint on the `edges` table causes a 500 error if the user tries to add an edge that already exists.
**Why it happens:** Schema constraint (schema.sql line 54).
**How to avoid:** In the add-connection UI, filter out nodes that already have an edge of the selected type with the current node before showing them as options. Also handle the 500/conflict gracefully in the UI with a user-friendly message.

### Pitfall 5: Status Field Editable Without Business Logic
**What goes wrong:** EDIT-01 lists `status` as an editable field. Status has a strict lifecycle (`raw → processing → llm_reviewed → human_reviewed → promoted → archived/falsified/suspended`). If Robyn can arbitrarily set any status, this could corrupt the review pipeline.
**Why it happens:** Requirement says "status" is editable without specifying constraints.
**How to avoid:** In the edit UI, offer a limited set of user-facing status transitions: `promoted`, `archived`, `falsified`, `suspended`. Do not expose `raw`, `processing`, `llm_reviewed` — those are system states. Validate on the API route.

### Pitfall 6: direction prop for "undirected" edge types
**What goes wrong:** `connected_to` has `is_directional: false` in the DB. Adding a direction toggle to every edge type is misleading.
**Why it happens:** EDIT-03 says "pick an edge type and direction." For undirected types, direction is meaningless.
**How to avoid:** When the user selects an undirected edge type, hide or disable the direction toggle. The source/target order doesn't matter semantically for undirected edges, but source will be the current node by default.

---

## Code Examples

### Node PATCH Route (New)
```typescript
// Source: Next.js 16 dynamic route convention (node_modules/next/dist/docs/)
// File: src/app/api/nodes/[id]/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Whitelist updatable fields — never allow id, author_id, created_at
  const {
    title, description, node_type, confidence_level, confidence_basis,
    status, domain_tags,
  } = body as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (node_type !== undefined) updates.node_type = node_type;
  if (confidence_level !== undefined) updates.confidence_level = confidence_level;
  if (confidence_basis !== undefined) updates.confidence_basis = confidence_basis;
  if (status !== undefined) updates.status = status;
  if (domain_tags !== undefined) updates.domain_tags = domain_tags;

  const { data, error } = await supabase
    .from('nodes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

### Edge DELETE Route (New)
```typescript
// File: src/app/api/edges/[id]/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('edges')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
```

### NodeSearchAutocomplete (Adapted from PersonAutocomplete)
```typescript
// Generalised from: src/components/capture/PersonAutocomplete.tsx
// Change: optional nodeTypeFilter prop; no type filter = all promoted nodes
interface NodeSearchAutocompleteProps {
  readonly selectedNode: NodeOption | null;
  readonly onChange: (node: NodeOption | null) => void;
  readonly excludeNodeId?: string;  // exclude the current node from results
  readonly placeholder?: string;
}
// Fetch: /api/nodes/search?q=...   (no &type= → searches all types)
// Single-select (not multi), so onChange receives one node or null
```

### Edit Mode State Initialisation (Immutable Pattern)
```typescript
// Immutable: copy node fields into state on mount — never mutate node prop
const [editTitle, setEditTitle] = useState(node.title);
const [editDescription, setEditDescription] = useState(node.description ?? '');
const [editNodeType, setEditNodeType] = useState(node.node_type);
const [editConfidence, setEditConfidence] = useState(node.confidence_level ?? 3);
const [editStatus, setEditStatus] = useState(node.status);
const [editDomainTags, setEditDomainTags] = useState<string[]>([...node.domain_tags]);
```

### Edge Type Static Constant
```typescript
// All edge types from supabase/seed.sql + v0.4-migration.sql + phase 12 decisions
// Confidence: HIGH — from schema and migration files, no dynamic fetch needed
export const EDGE_TYPES = [
  { id: 'supports',            label: 'Supports',            directional: true  },
  { id: 'contradicts',         label: 'Contradicts',         directional: true  },
  { id: 'requires',            label: 'Requires',            directional: true  },
  { id: 'evolved_from',        label: 'Evolved from',        directional: true  },
  { id: 'tested_by',           label: 'Tested by',           directional: true  },
  { id: 'produced',            label: 'Produced',            directional: true  },
  { id: 'connected_to',        label: 'Connected to',        directional: false },
  { id: 'works_at',            label: 'Works at',            directional: true  },
  { id: 'authored_by',         label: 'Authored by',         directional: true  },
  { id: 'challenges',          label: 'Challenges',          directional: true  },
  { id: 'advances_goal',       label: 'Advances goal',       directional: true  },
  { id: 'targets_outcome',     label: 'Targets outcome',     directional: true  },
  { id: 'indicates_progress',  label: 'Indicates progress',  directional: true  },
  { id: 'assigned_to_outcome', label: 'Assigned to outcome', directional: true  },
  { id: 'participated_in',     label: 'Participated in',     directional: true  },
  { id: 'mentioned_in',        label: 'Mentioned in',        directional: true  },
] as const;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params` is synchronous object | `params` is `Promise<{ id: string }>` — must `await` | Next.js 15+ (project uses 16.2.1) | Dynamic route handlers must await params or get undefined |
| `NextResponse.json()` only | Can use `new Response(null, { status: 204 })` for DELETE with no body | Next.js 15+ | Use standard Web Response for 204 No Content |

---

## Existing Data Model Summary

### Node Fields (editable in EDIT-01)

| Field | Type | DB Column | Notes |
|-------|------|-----------|-------|
| title | `string` | `TEXT NOT NULL` | Required, trim on save |
| description | `string \| null` | `TEXT` | Optional |
| node_type | `string` | `TEXT NOT NULL REFERENCES node_types(id)` | FK to node_types — use CAPTURE_TYPES list; excludes `meeting_notes` |
| confidence_level | `number \| null` | `INT CHECK (1-5)` | 5-level picker |
| confidence_basis | `ConfidenceBasis \| null` | `TEXT CHECK (enum)` | 'intuition', 'analogy', 'observation', 'early_evidence', 'strong_evidence' |
| status | `NodeStatus` | `TEXT CHECK (enum)` | Editable subset: 'promoted', 'archived', 'falsified', 'suspended' (not system states) |
| domain_tags | `string[]` | `TEXT[] DEFAULT '{}'` | GIN-indexed; chip input in edit mode |

**Not editable in this phase:** `llm_extraction`, `human_review`, `parent_node_id`, `insight_date`, `author_id`, `external_links`, `attachments`, `created_at`, `updated_at` (updated_at is auto-set by DB trigger on every UPDATE).

### Edge Fields (displayed in EDIT-02)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Used for DELETE |
| source_id | UUID | Determines direction arrow in panel (→ vs ←) |
| target_id | UUID | |
| edge_type | string | Display in panel, used in add-connection form |
| weight | float | Not shown in panel — not editable in this phase |

### DB Constraints Affecting This Phase

- `edges UNIQUE(source_id, target_id, edge_type)` — adding a duplicate edge returns a DB error; handle gracefully
- `nodes.node_type REFERENCES node_types(id)` — only valid node_type ids can be saved; use the known list
- `updated_at` trigger fires automatically on every node UPDATE — no need to set it manually
- `edges.source_id/target_id ON DELETE CASCADE` — deleting a node removes all its edges automatically

---

## Open Questions

1. **Should `NodeDetailPanel` receive `onNodeUpdated` and `onEdgeAdded`/`onEdgeRemoved` callbacks, or rely entirely on realtime?**
   - What we know: Nodes have realtime UPDATE events. Edges do NOT have a realtime channel in GraphOSSurface.
   - What's unclear: Whether it's simpler to add an edges realtime channel or use callbacks.
   - Recommendation: Callbacks — `onEdgeAdded(edge: Edge)` and `onEdgeRemoved(edgeId: string)` passed from GraphOSSurface. Avoids subscription overhead. For node updates, realtime already handles it but an `onNodeUpdated(node: Node)` callback would let the panel optimistically update without waiting for realtime lag.

2. **Which node types should be available in the type selector for EDIT-01?**
   - What we know: `CAPTURE_TYPES` has 11 types including `meeting_notes` (which is a capture-only virtual type, not a real node_type). `NODE_TYPE_OPTIONS` in `GraphOSSurface` has 13 types including `goal_space` and `trigger_outcome`.
   - What's unclear: Should Robyn be able to change a node to `goal_space` or `trigger_outcome` from the edit panel? These have special panel logic.
   - Recommendation: Use `NODE_TYPE_OPTIONS` from GraphOSSurface but exclude `meeting_notes` (not a real DB node type). This gives the most complete and accurate list.

3. **How wide should the `NodeDetailPanel` be in edit mode?**
   - What we know: Current panel is `w-72` (288px). The edit form inputs from QuickCaptureForm are wider.
   - Recommendation: Expand to `w-80` or `w-96` in edit mode, or make the panel width dynamic. The planner should decide but should be aware it affects layout.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (jsdom environment, setupFiles: `./src/test-setup.ts`) |
| Quick run command | `npx vitest run --reporter=verbose src/components/graph/__tests__/NodeDetailPanel.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | Edit button toggles to edit mode, shows field inputs | unit | `npx vitest run src/components/graph/__tests__/NodeDetailPanel.test.tsx` | Wave 0 |
| EDIT-01 | Save button calls PATCH API with updated fields | unit (fetch mock) | `npx vitest run src/components/graph/__tests__/NodeDetailPanel.test.tsx` | Wave 0 |
| EDIT-01 | Cancel button returns to view mode without saving | unit | `npx vitest run src/components/graph/__tests__/NodeDetailPanel.test.tsx` | Wave 0 |
| EDIT-02 | Connections list renders edge type + connected node title | unit | `npx vitest run src/components/graph/__tests__/NodeDetailPanel.test.tsx` | Wave 0 |
| EDIT-02 | Remove button calls DELETE on correct edge id | unit (fetch mock) | `npx vitest run src/components/graph/__tests__/NodeDetailPanel.test.tsx` | Wave 0 |
| EDIT-03 | Add connection form shows node search autocomplete | unit | `npx vitest run src/components/graph/__tests__/NodeDetailPanel.test.tsx` | Wave 0 |
| EDIT-03 | Confirming add calls POST /api/graph/edges with correct payload | unit (fetch mock) | `npx vitest run src/components/graph/__tests__/NodeDetailPanel.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/graph/__tests__/NodeDetailPanel.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/graph/__tests__/NodeDetailPanel.test.tsx` — covers EDIT-01, EDIT-02, EDIT-03 (file does not exist)
- Existing `GoalSpacePanel.test.tsx` provides `makeNode` and `makeEdge` helpers — copy these into `NodeDetailPanel.test.tsx` for consistent test fixtures

---

## Sources

### Primary (HIGH confidence)
- `src/components/graph/NodeDetailPanel.tsx` — current panel implementation (read directly)
- `src/lib/types/nodes.ts` — Node interface, all fields, status enum
- `src/lib/types/edges.ts` — Edge interface
- `supabase/schema.sql` — full DB schema, constraints, RLS policies
- `supabase/seed.sql` + `supabase/v0.4-migration.sql` — all edge type definitions
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Next.js 16 PATCH/DELETE/dynamic route params convention
- `src/app/api/graph/nodes/route.ts` — existing GET/POST pattern to replicate
- `src/app/api/graph/edges/route.ts` — existing GET/POST pattern to replicate
- `src/components/capture/PersonAutocomplete.tsx` — template for NodeSearchAutocomplete
- `src/components/graph/GraphOSSurface.tsx` — how selectedNode flows into NodeDetailPanel; realtime channels

### Secondary (MEDIUM confidence)
- `src/lib/config/captureTypes.ts` — `NODE_TYPE_OPTIONS` authoritative type list
- `src/components/capture/QuickCaptureForm.tsx` — confidence picker, field patterns to reuse
- `src/app/api/capture/route.ts` — edge creation pattern (participated_in) to replicate for add-connection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from direct codebase reads
- Architecture: HIGH — patterns extracted directly from existing files
- Pitfalls: HIGH — derived from schema constraints and Next.js 16 breaking changes confirmed in official docs
- Realtime gap: HIGH — confirmed by reading GraphOSSurface channel subscriptions

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable domain — no upcoming dependency changes expected)
