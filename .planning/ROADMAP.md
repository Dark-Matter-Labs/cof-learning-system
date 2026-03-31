# Roadmap: COF OS

## Milestones

- [x] **v0.3 Dual-Model Interface** - Phases 1-6 pre-GSD (shipped 2026-03-27)
- [x] **v0.4 Trajectory Management Environment** - Phases 1-7 (shipped 2026-03-31)
- [ ] **v0.5 UX Polish** - Phases 8-15 (in progress)

## Phases

<details>
<summary>v0.4 Trajectory Management Environment (Phases 1-7) — SHIPPED 2026-03-31</summary>

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
- [x] 02-02-PLAN.md — GoalSpacePanel component + GraphOSSurface routing

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
**Plans:** 3/3 plans complete

Plans:
- [x] 06-01-PLAN.md — Pure reflection agent functions (TDD) + DB migration + LLM slot extension
- [x] 06-02-PLAN.md — Streaming route handler + threshold trigger
- [x] 06-03-PLAN.md — ReflectionPanel UI component + weekly review integration

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
**Plans:** 2/2 plans complete

Plans:
- [x] 07-01-PLAN.md — DB migration + snapshots days param + types and questions config
- [x] 07-02-PLAN.md — /reflect page, ReflectClient UI, session POST route, NavBar link

</details>

---

### v0.5 UX Polish (In Progress)

**Milestone Goal:** Resolve all concrete usability blockers from Robyn's first real usage session so the system is comfortable to use daily.

### Phase 8: Layout & Theme
**Goal**: Every page renders correctly in both light and dark mode with no content obscured by the fixed navbar
**Depends on**: Phase 7 (v0.4 complete)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03
**Success Criteria** (what must be TRUE):
  1. Robyn can scroll the commitment panel and node detail panel without content disappearing behind the navbar
  2. Robyn can switch between light and dark mode and see no hardcoded colors — all text, backgrounds, and borders adapt correctly
  3. Graph canvas, node cards, commitment panel, and tension alerts are legible in both light and dark mode
**Plans:** 3/4 plans executed

Plans:
- [x] 08-01-PLAN.md — darkMode class config + system-preference script + layout padding + NavBar light/dark
- [x] 08-02-PLAN.md — Graph components dark mode (GraphCanvas SVG nodes, panels, TopBar)
- [x] 08-03-PLAN.md — Commitment panel and shared badges dark mode

### Phase 9: Review UX
**Goal**: The weekly review extraction workflow defaults to accepting all proposed fields so Robyn rejects bad suggestions rather than approving good ones
**Depends on**: Phase 8
**Requirements**: REVIEW-01, REVIEW-02, REVIEW-03
**Success Criteria** (what must be TRUE):
  1. Opening a ReviewCard shows all extraction fields pre-checked — Robyn does not have to check anything to proceed
  2. The Promote button is active immediately when all fields are checked (no extra interaction required)
  3. A single "Promote all" button accepts every field and promotes to the graph in one click
**Plans:** 1/1 plans complete

Plans:
- [x] 09-01-PLAN.md — ReviewCard opt-out defaults + Promote All button

### Phase 10: Capture Foundation
**Goal**: The capture page is renamed, has a shared type config used everywhere, and supports meeting notes as a capture type that extracts multiple nodes from a single transcript
**Depends on**: Phase 8
**Requirements**: CAPT-05, CAPT-06, CAPT-07, CAPT-08
**Success Criteria** (what must be TRUE):
  1. The capture page title reads "Capture" (not "Capture a Hunch")
  2. Selecting the capture type in the inline graph card and the capture page both draw from the same `CAPTURE_TYPES` config — adding a new type in one place updates both
  3. Robyn can select "Meeting Notes / Transcript" as a capture type and sees title, date, and participants fields
  4. Submitting a meeting transcript proposes multiple nodes — insights, actions, people, decisions, and open questions — as separate review cards
**Plans:** 2 plans

Plans:
- [ ] 10-01-PLAN.md — CAPTURE_TYPES shared config + capture page rename
- [ ] 10-02-PLAN.md — Meeting notes capture type + multi-node extraction

### Phase 11: Date & Timeline
**Goal**: Nodes have an insight date distinct from their creation timestamp, and the timeline view positions nodes by when the insight occurred rather than when it was entered
**Depends on**: Phase 10
**Requirements**: CAPT-09, CAPT-10
**Success Criteria** (what must be TRUE):
  1. The capture form shows a "When did this happen?" date field that defaults to today and is stored as `insight_date` on the node
  2. The timeline view positions nodes using `insight_date` when set, falling back to `created_at` — nodes entered today for events last month appear at last month's position
**Plans**: TBD

Plans:
- [ ] 11-01-PLAN.md — insight_date DB migration + capture form field + timeline view update

### Phase 12: People & Participants
**Goal**: Robyn can tag people who participated in or are mentioned by a capture, with autocomplete from existing person nodes, and the extraction agent detects people from raw text automatically
**Depends on**: Phase 10
**Requirements**: PEOP-01, PEOP-02, PEOP-03
**Success Criteria** (what must be TRUE):
  1. The capture form has a participants field that autocompletes from existing person nodes as Robyn types
  2. Selecting a participant and saving the capture creates an edge linking the new node to that person node
  3. When Robyn submits text that mentions a person's name, the extraction agent surfaces a suggested connection to that person's node in the review card
**Plans**: TBD

Plans:
- [ ] 12-01-PLAN.md — Participants autocomplete field + edge creation on save
- [ ] 12-02-PLAN.md — Extraction agent person detection + connection suggestions

### Phase 13: Edit Nodes & Connections
**Goal**: Robyn can edit any node's fields and manage its connections directly from the node detail panel without going to a separate page
**Depends on**: Phase 12
**Requirements**: EDIT-01, EDIT-02, EDIT-03
**Success Criteria** (what must be TRUE):
  1. The node detail panel has an Edit button that switches to edit mode, allowing Robyn to change title, description, type, confidence, status, and domain tags and save
  2. The node detail panel lists all current connections with their edge type and connected node title, each with a Remove button that deletes the edge
  3. Robyn can add a new connection from the detail panel by searching existing nodes, picking an edge type and direction, and confirming
**Plans**: TBD

Plans:
- [ ] 13-01-PLAN.md — Node edit mode (fields) in detail panel
- [ ] 13-02-PLAN.md — Connection list with remove + add connection UI

### Phase 14: Options Auto-Connect
**Goal**: When an option node is created or text mentions an existing option node, the extraction agent proactively suggests connections so option nodes accumulate links automatically
**Depends on**: Phase 12
**Requirements**: OPT-01, OPT-02
**Success Criteria** (what must be TRUE):
  1. When Robyn creates an option node, the extraction agent review card includes suggested `connected_to` edges to related existing nodes
  2. When Robyn submits any capture whose text mentions an option node by name, the review card includes a suggested edge to that option node
**Plans**: TBD

Plans:
- [ ] 14-01-PLAN.md — Extraction agent option-node connection suggestions

### Phase 15: File Upload
**Goal**: Robyn can drop a PDF, text, or markdown file onto the capture page and have its content extracted into the description field, with the original file stored for reference
**Depends on**: Phase 10
**Requirements**: UPLOAD-01, UPLOAD-02, UPLOAD-03
**Success Criteria** (what must be TRUE):
  1. The capture page shows a file upload zone that accepts .pdf, .txt, and .md files
  2. Uploading a PDF extracts its text server-side and pre-populates the description field — Robyn does not need to copy-paste
  3. The original file is stored in Supabase Storage and its URL is saved on the node, so Robyn can retrieve the source file later
**Plans**: TBD

Plans:
- [ ] 15-01-PLAN.md — File upload zone + server-side PDF extraction
- [ ] 15-02-PLAN.md — Supabase Storage integration + media_url on node

## Progress

**Execution Order:**
Phases execute in numeric order: 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Goal Hierarchy | v0.4 | 0/2 | Not started | - |
| 2. Goal Space Panel | v0.4 | 2/2 | Complete | 2026-03-27 |
| 3. Capture Linking + Extraction | v0.4 | 2/2 | Complete | 2026-03-30 |
| 4. Convergence Computation | v0.4 | 1/2 | In progress | - |
| 5. Trajectory Indicators | v0.4 | 1/2 | In progress | - |
| 6. Reflection Agent | v0.4 | 3/3 | Complete | 2026-03-30 |
| 7. Reflection Session Page | v0.4 | 2/2 | Complete | 2026-03-30 |
| 8. Layout & Theme | v0.5 | 3/4 | In Progress|  |
| 9. Review UX | v0.5 | 1/1 | Complete   | 2026-03-31 |
| 10. Capture Foundation | v0.5 | 0/2 | Not started | - |
| 11. Date & Timeline | v0.5 | 0/1 | Not started | - |
| 12. People & Participants | v0.5 | 0/2 | Not started | - |
| 13. Edit Nodes & Connections | v0.5 | 0/2 | Not started | - |
| 14. Options Auto-Connect | v0.5 | 0/1 | Not started | - |
| 15. File Upload | v0.5 | 0/2 | Not started | - |
