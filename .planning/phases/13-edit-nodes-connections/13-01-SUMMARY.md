---
phase: 13-edit-nodes-connections
plan: "01"
subsystem: graph-ui
tags: [edit-mode, node-detail-panel, patch-api, tdd]
dependency_graph:
  requires: []
  provides: [EDIT-01, node-patch-api, node-detail-edit-mode]
  affects: [GraphOSSurface, NodeDetailPanel]
tech_stack:
  added: []
  patterns: [tdd-red-green, immutable-state-updates, use-client-directive]
key_files:
  created:
    - src/app/api/nodes/[id]/route.ts
    - src/components/graph/__tests__/NodeDetailPanel.test.tsx
  modified:
    - src/components/graph/NodeDetailPanel.tsx
    - src/components/graph/GraphOSSurface.tsx
decisions:
  - "Status select restricted to promoted/archived/falsified/suspended — system states (raw, processing, llm_reviewed, human_reviewed, error) hidden from users"
  - "NODE_TYPE_OPTIONS defined inline in NodeDetailPanel (not imported from GraphOSSurface) to keep component self-contained and avoid circular deps"
  - "editDescription initialized from node.description ?? '' to avoid null in controlled input; serialized back as null when empty on save"
  - "onNodeUpdated updates both nodes array and selectedNode in GraphOSSurface for immediate UI sync without waiting for realtime"
metrics:
  duration: "3min"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 4
requirements_completed: [EDIT-01]
---

# Phase 13 Plan 01: Node Detail Panel Edit Mode Summary

**One-liner:** PATCH /api/nodes/[id] route with field whitelisting + NodeDetailPanel edit/view toggle with inline field editing and onNodeUpdated callback wired through GraphOSSurface.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | PATCH route + failing tests | 9ea3695 | src/app/api/nodes/[id]/route.ts, NodeDetailPanel.test.tsx |
| 2 (GREEN) | Implement edit mode + wire GraphOSSurface | eb7c05a | NodeDetailPanel.tsx, GraphOSSurface.tsx |

## What Was Built

**PATCH /api/nodes/[id]** (`src/app/api/nodes/[id]/route.ts`):
- Auth-gated via `supabase.auth.getUser()`
- `params` awaited as `Promise<{ id: string }>` per Next.js 16 convention
- Whitelisted fields: title, description, node_type, confidence_level, confidence_basis, status, domain_tags
- Status validated against `['promoted', 'archived', 'falsified', 'suspended']`
- Returns `{ data }` on success, `{ error }` on failure

**NodeDetailPanel edit mode** (`src/components/graph/NodeDetailPanel.tsx`):
- `'use client'` directive added
- `onNodeUpdated?: (node: Node) => void` prop added
- Edit button in header header switches to edit mode
- Edit fields: title input, description textarea, type select (13 types), confidence 1-5 button group, status select (4 user-facing values), domain tag chips with remove + add-by-Enter
- Panel expands from `w-72` to `w-96` in edit mode
- Save: PATCH fetch, calls onNodeUpdated on success, exits edit mode
- Cancel: resets all field states from node prop, no fetch
- All edit states initialized from node prop (immutable — prop never mutated)

**GraphOSSurface wiring** (`src/components/graph/GraphOSSurface.tsx`):
- `onNodeUpdated` callback updates `nodes` state array (immutable map) and `selectedNode` simultaneously for immediate panel refresh

## Test Results

- NodeDetailPanel tests: 16/16 passing
- Full graph component suite: 543/543 passing
- Build: SUCCESS — `/api/nodes/[id]` registered as dynamic route

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/app/api/nodes/[id]/route.ts` — FOUND
- `src/components/graph/__tests__/NodeDetailPanel.test.tsx` — FOUND
- `src/components/graph/NodeDetailPanel.tsx` — FOUND (modified)
- `src/components/graph/GraphOSSurface.tsx` — FOUND (modified)
- Commit 9ea3695 — FOUND (RED: PATCH route + failing tests)
- Commit eb7c05a — FOUND (GREEN: edit mode implementation)
