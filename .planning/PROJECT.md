# COF OS — Civilization Options Fund Operating System

## What This Is

COF OS is a trajectory management environment for the Civilization Options Fund — a small team doing civilizational-scale thinking work. It turns unstructured exploration (hunches, assumptions, signals) into a structured knowledge graph that shows whether the team's search and commitment vectors are converging or drifting. Built as a Next.js web app with Supabase backend and LLM-assisted extraction.

## Core Value

The system must always tell you whether your exploration and your commitments are spiraling together toward your goals — or apart.

## Current Milestone: v0.5 UX Polish — Real Usage Fixes

**Goal:** Resolve all concrete usability blockers surfaced in Robyn's first real usage session so the system is comfortable to use daily.

**Target features:**
- Nav panel overlap fix (sidebar content hidden behind fixed navbar)
- Light/dark mode consistency audit across all components
- Review card: checkboxes default to checked (opt-out model)
- Consistent capture types config shared across full page + inline graph card
- Rename capture page; add meeting notes/transcript type with multi-node extraction
- Insight date field ("when did this happen?" vs when entered)
- People/participants field with person-node autocomplete
- Edit nodes + manage connections from node detail panel
- Option nodes auto-connect via extraction agent suggestions
- PDF/file upload with server-side text extraction

## Previous Milestone: v0.4 Trajectory Management Environment (shipped 2026-03-31)

**Goal:** Transform COF OS from a workflow tool into a trajectory management environment where search and commitment vectors visibly spiral together (or apart) over time.

**Shipped:**
- Goal hierarchy: goal_space → trigger_outcome → commitment (3-level)
- Goal space detail panel with progress indicators per trigger outcome
- Convergence scoring + time-series snapshots
- Trajectory indicator badge + sparkline (SVG, 30-day window)
- Reflection agent (system-wide LLM analysis)
- Reflection report UI integrated into weekly review
- /reflect page with guided questions, decisions log, session persistence

## Requirements


### Active (v0.5)

- [ ] Nav panel content no longer obscured by fixed navbar (padding fix)
- [ ] Full light/dark mode consistency — no hardcoded colors
- [ ] Review card defaults all fields to checked (opt-out model)
- [ ] Shared CAPTURE_TYPES config used by both capture page and inline graph card
- [ ] Capture page renamed; meeting notes/transcript type added with multi-node extraction
- [ ] Insight date field on nodes (insight_date column, timeline uses it)
- [ ] People/participants field with person-node autocomplete + edge creation
- [ ] Node detail panel has edit mode + connection management
- [ ] Option nodes get extraction-suggested connections automatically
- [ ] PDF/file upload on capture page with server-side text extraction

### Validated (v0.1–v0.4)

- ✓ Graph canvas with force, tree, timeline, workflow views — v0.3
- ✓ Inline node capture from graph — v0.2
- ✓ Node detail panel (right sidebar) — v0.2
- ✓ Commitment panel (left sidebar) — v0.3
- ✓ Tension alerts with signal propagation — v0.3
- ✓ Intervention nodes with dual-linking — v0.3
- ✓ Weekly review page — v0.3
- ✓ LLM-assisted node extraction — v0.2
- ✓ Supabase backend with RLS, auth whitelist — v0.1
- ✓ Goal hierarchy (3-level) — v0.4 Phase 1
- ✓ Goal space detail panel — v0.4 Phase 2
- ✓ Convergence scoring + snapshots — v0.4 Phase 4
- ✓ Trajectory badge + sparkline — v0.4 Phase 5
- ✓ Reflection agent + report UI — v0.4 Phase 6
- ✓ /reflect page with session persistence — v0.4 Phase 7

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
| Trajectory badge (Option C) over spiral SVG | Practical for v0.4; spiral deferred to design pass | ✓ Shipped Phase 5 |
| Rough convergence weights | Purpose is visibility not optimization; tune over real usage | ✓ Shipped Phase 4 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

Last updated: 2026-03-31 — milestone v0.5 started

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
*Last updated: 2026-03-27 after Phase 2 completion*
