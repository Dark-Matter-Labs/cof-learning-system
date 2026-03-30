# Roadmap: COF OS v0.4 — Trajectory Management Environment

## Overview

Seven phases transform COF OS from a workflow tool into a trajectory management environment. The foundation is a goal hierarchy (Phase 1) that all subsequent phases build on: a dedicated goal space panel (Phase 2), linking captures to outcomes and enriching extraction with goal context (Phase 3), computing convergence scores and storing them as time-series (Phase 4), rendering trajectory indicators in the UI (Phase 5), running a reflection agent that detects patterns and gaps system-wide (Phase 6), and delivering the /reflect page for periodic deep reflection rituals (Phase 7).

## Milestones

- [x] **v0.3 Dual-Model Interface** - Phases 1-6 pre-GSD (shipped 2026-03-27)
- [ ] **v0.4 Trajectory Management Environment** - Phases 1-7 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Goal Hierarchy** - DB schema and commitment panel restructured as 3-level goal tree
- [x] **Phase 2: Goal Space Panel** - Dedicated GoalSpacePanel with progress indicators per trigger outcome (completed 2026-03-27)
- [x] **Phase 3: Capture Linking + Extraction** - Outcome dropdown in capture forms and goal-aware extraction agent (completed 2026-03-30)
- [ ] **Phase 4: Convergence Computation** - Scoring function and convergence_snapshots time-series table
- [ ] **Phase 5: Trajectory Indicators** - Badge UI, factor breakdown, and 30-day sparkline SVG
- [ ] **Phase 6: Reflection Agent** - System-wide LLM analysis integrated into weekly review
- [ ] **Phase 7: Reflection Session Page** - /reflect page with guided questions, decisions log, and session persistence

## Phase Details

### Phase 1: Goal Hierarchy
**Goal**: The commitment panel renders the full 3-level goal hierarchy and the database supports trigger_outcome nodes and their connecting edge types
**Depends on**: Nothing (first phase)
**Requirements**: HIER-01, HIER-02, HIER-03, HIER-04
**Success Criteria** (what must be TRUE):
  1. User can create a trigger_outcome node that is linked to a goal_space in the graph
  2. Commitment panel displays goal_space → trigger_outcome → commitment as a collapsible 3-level tree
  3. DB schema contains trigger_outcome node type and advances_goal / targets_outcome / indicates_progress edge types (verifiable via migration file)
  4. Each goal space section in the commitment panel header shows a trajectory badge placeholder
**Plans:** 2 plans
Plans:
- [ ] 01-01-PLAN.md — DB migration + trigger_outcome in type selectors
- [ ] 01-02-PLAN.md — TrajectoryBadge + CommitmentPanel 3-level hierarchy restructure

### Phase 2: Goal Space Panel
**Goal**: Selecting a goal_space node opens a dedicated panel that shows all trigger outcomes with computed progress indicators and item counts
**Depends on**: Phase 1
**Requirements**: GOAL-01, GOAL-02, GOAL-03, GOAL-04
**Success Criteria** (what must be TRUE):
  1. Clicking a goal_space node opens a GoalSpacePanel instead of the generic node detail panel
  2. GoalSpacePanel lists every linked trigger outcome with a status indicator (not started, in progress, met, blocked)
  3. Status indicator for each trigger outcome is computed from connected tests, signals, and commitments — not a manual field
  4. Each trigger outcome row shows commitment count and hunch count
**Plans:** 2/2 plans complete
Plans:
- [x] 02-01-PLAN.md — Pure functions (computeOutcomeStatus + counts) with TDD
- [ ] 02-02-PLAN.md — GoalSpacePanel component + GraphOSSurface routing

### Phase 3: Capture Linking + Extraction
**Goal**: Users can link a capture directly to a trigger outcome at creation time, and the extraction agent suggests goal relevance and expected signals for new hunches
**Depends on**: Phase 1
**Requirements**: CAPT-01, CAPT-02, CAPT-03, CAPT-04, EXTR-01, EXTR-02, EXTR-03, EXTR-04
**Success Criteria** (what must be TRUE):
  1. Capture form shows an optional "Which outcome does this target?" dropdown populated with active trigger_outcomes
  2. Selecting an outcome and saving auto-creates a targets_outcome edge — no manual edge creation needed
  3. Capture form has an optional "What signal would tell you this is working?" text field whose value is stored in content.expected_signals
  4. Weekly review surfaces hunches with no targets_outcome edge and prompts the user to consider linking them
  5. Extraction agent review card shows suggested goal relevance with Accept / Reject / Link to different outcome actions
**Plans:** 2/2 plans complete
Plans:
- [x] 03-01-PLAN.md — Capture form outcome dropdown + expected signals + extraction agent goal context (completed 2026-03-30)
- [x] 03-02-PLAN.md — Weekly review undirected hunches + GoalRelevanceField in ReviewCard (completed 2026-03-27)

### Phase 4: Convergence Computation
**Goal**: The system computes a convergence score per goal space using defined weight rules, stores snapshots as a time series, and triggers snapshots automatically on threshold
**Depends on**: Phase 1
**Requirements**: CONV-01, CONV-02, CONV-03
**Success Criteria** (what must be TRUE):
  1. A convergence score can be computed for any goal space using the defined positive/negative weight rules (verifiable via API or function call)
  2. convergence_snapshots table exists and stores scores with timestamp and factor breakdown as JSONB
  3. A snapshot is taken automatically when 10 or more new nodes have been added since the last snapshot
**Plans:** 2 plans
Plans:
- [x] 04-01-PLAN.md — Pure convergence scoring function (TDD) + convergence_snapshots migration (completed 2026-03-27)
- [ ] 04-02-PLAN.md — Snapshot API route + threshold trigger in nodes POST

### Phase 5: Trajectory Indicators
**Goal**: Every goal space displays a live trajectory badge and a 30-day convergence sparkline so users can see at a glance whether they are converging or drifting
**Depends on**: Phase 4
**Requirements**: CONV-04, CONV-05, CONV-06
**Success Criteria** (what must be TRUE):
  1. Each goal space shows a trajectory badge labeled converging (+) / neutral / drifting (-) with the numeric score
  2. Clicking the trajectory badge expands an inline breakdown listing positive and negative contributing factors
  3. Goal space displays an inline SVG sparkline (200x40, teal/coral fill) showing convergence score over the last 30 days
**Plans:** 1/2 plans executed
Plans:
- [x] 05-01-PLAN.md — GET snapshot endpoint + ConvergenceSparkline component
- [ ] 05-02-PLAN.md — TrajectoryBadge upgrade + data wiring into panels

### Phase 6: Reflection Agent
**Goal**: The weekly review page can trigger a system-wide LLM reflection that detects patterns, contradictions, and gaps, and surfaces actionable recommendations with direct action buttons
**Depends on**: Phase 4
**Requirements**: REFL-01, REFL-02, REFL-03, REFL-04, REFL-05
**Success Criteria** (what must be TRUE):
  1. Reflection agent assembles full system context (goals, outcomes, nodes, edges, convergence scores, tension alerts, activity by author) and runs analysis
  2. Reflection can be triggered on-demand from the weekly review page
  3. Reflection auto-triggers when 10 or more new nodes have been added since the last reflection run
  4. Weekly review page renders the reflection report as an expandable section with Patterns, Contradictions, Coverage Gaps, Trajectory, and Recommendations sections
  5. Each recommendation in the report has an action button that opens the appropriate form or panel
**Plans**: TBD

### Phase 7: Reflection Session Page
**Goal**: /reflect is a dedicated page for periodic deep reflection rituals where users view trajectory over time, answer guided questions, and log decisions — all persisted to a reflection_sessions record
**Depends on**: Phase 5, Phase 6
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05
**Success Criteria** (what must be TRUE):
  1. /reflect page exists and is accessible
  2. /reflect shows convergence sparklines for all goal spaces over a selectable 30-90 day window
  3. /reflect presents guided reflection questions as text inputs and persists answers
  4. /reflect shows a decisions log where team members can record decisions with linked node effects
  5. reflection_sessions table stores machine_reflection, human_responses, decisions, convergence_snapshot, and participants for each session
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Goal Hierarchy | 0/2 | Not started | - |
| 2. Goal Space Panel | 1/2 | Complete    | 2026-03-27 |
| 3. Capture Linking + Extraction | 0/2 | Not started | - |
| 4. Convergence Computation | 1/2 | In progress | - |
| 5. Trajectory Indicators | 1/2 | In Progress|  |
| 6. Reflection Agent | 0/TBD | Not started | - |
| 7. Reflection Session Page | 0/TBD | Not started | - |
