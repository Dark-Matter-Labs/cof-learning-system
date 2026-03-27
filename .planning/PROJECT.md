# COF OS — Civilization Options Fund Operating System

## What This Is

COF OS is a trajectory management environment for the Civilization Options Fund — a small team doing civilizational-scale thinking work. It turns unstructured exploration (hunches, assumptions, signals) into a structured knowledge graph that shows whether the team's search and commitment vectors are converging or drifting. Built as a Next.js web app with Supabase backend and LLM-assisted extraction.

## Core Value

The system must always tell you whether your exploration and your commitments are spiraling together toward your goals — or apart.

## Current Milestone: v0.4 Trajectory Management Environment

**Goal:** Transform COF OS from a workflow tool into a trajectory management environment where search and commitment vectors visibly spiral together (or apart) over time.

**Target features:**
- Goal hierarchy: goal_space → trigger_outcome → commitment (3-level)
- Goal space detail panel with progress indicators per trigger outcome
- Hunch-to-outcome linking in capture forms
- Extraction agent: inject active goal context, suggest goal relevance + expected signals
- Convergence scoring: positive/negative signal weighting per goal space
- Trajectory indicator badge (converging/neutral/drifting) on goal spaces
- Trajectory sparkline: convergence score over 30 days (inline SVG)
- Reflection agent: system-wide LLM pattern/contradiction/gap detection
- Reflection report UI: clickable node refs, action buttons per recommendation
- Commitment panel restructure: hierarchical tree (goal → outcome → commitment)
- /reflect page: periodic deep reflection ritual with guided questions and decisions log

## Requirements

### Validated (v0.1–v0.3)

- ✓ Graph canvas with force, tree, timeline, workflow views — v0.3
- ✓ Inline node capture from graph (hunch, assumption, signal, intervention, commitment) — v0.2
- ✓ Node detail panel (right sidebar) — v0.2
- ✓ Commitment panel (left sidebar) showing active commitments — v0.3
- ✓ Tension alerts with signal propagation (signal → assumption → commitment) — v0.3
- ✓ Intervention nodes with dual-linking (serves commitment + tests assumption) — v0.3
- ✓ Weekly review page with context health / commitment health columns — v0.3
- ✓ LLM-assisted node extraction from free text — v0.2
- ✓ Supabase backend with RLS, auth whitelist — v0.1

### Active (v0.4)

- [x] Goal hierarchy: goal_space → trigger_outcome → commitment — Phase 1
- [x] Commitment panel restructured as goal hierarchy tree — Phase 1
- [ ] Goal space detail panel with progress indicators
- [ ] Hunch-to-outcome linking in capture forms
- [ ] Extraction agent goal context injection and relevance suggestion
- [ ] Convergence scoring function per goal space
- [ ] convergence_snapshots table for time-series storage
- [ ] Trajectory indicator badge on goal spaces
- [ ] Trajectory sparkline (SVG, 30-day window)
- [ ] Reflection agent (system-wide analysis)
- [ ] Reflection report UI (weekly review integration)
- [ ] /reflect page with guided questions, decisions log, session storage
- [ ] reflection_sessions table

### Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile app | Web-first, team tool — defer indefinitely |
| Real-time collaboration / presence | v0.x is single-user usage pattern |
| Convergence score ML model | Deliberate rough scoring — tuning over human usage first |
| Spiral SVG animation (Option A) | Deferred to Martin's design pass; use badge (Option C) for v0.4 |
| OAuth / SSO | Auth whitelist model sufficient for small team |

## Context

- **Stack**: Next.js 15 (App Router), React, TypeScript, Supabase (Postgres + Auth + Edge Functions), Tailwind CSS
- **LLM**: Anthropic Claude via configurable agent slots (extraction, review, create, reflection-new in v0.4)
- **Graph**: react-force-graph or custom canvas; four views (force, tree, timeline, workflow)
- **Team**: Indy (framing/vision), Gurden (implementation), Robyn (stakeholder), Martin (design — future pass)
- **Deployment**: Vercel Pro
- **Auth**: Email whitelist (Supabase RLS permissive model)
- **v0.3 shipped**: Graph home screen, capture, commitment panel, tension alerts, signal propagation, intervention dual-linking, weekly review
- **v0.4 conceptual shift**: Reframe from workflow tool to trajectory management environment — two vectors (search + commitment) must spiral together visibly

## Constraints

- **Tech stack**: Next.js 15 App Router — breaking changes from earlier versions; read `node_modules/next/dist/docs/` before writing Next.js code
- **DB**: All schema changes via migration files; RLS policies may already exist (check before INSERT)
- **LLM cost**: Reflection agent runs on-demand + threshold (10+ new nodes) + weekly cron — not per-keystroke
- **Context window**: Reflection agent context must stay under 100k tokens — summarize older nodes, full recent ones

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Force graph as primary view | Most natural for emergent knowledge structure | ✓ Good |
| Left sidebar for commitments | Right sidebar used by node detail panel | ✓ Good |
| Permissive RLS with auth whitelist | Small known team, simplicity over granular permissions | ✓ Good |
| Configurable LLM agent slots | Allows model swapping without code changes | ✓ Good |
| Trajectory badge (Option C) over spiral SVG | Practical for v0.4; spiral deferred to design pass | — Pending |
| Rough convergence weights | Purpose is visibility not optimization; tune over real usage | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after milestone v0.4 initialization*
