# Requirements: COF OS v0.4

**Defined:** 2026-03-27
**Core Value:** The system must always tell you whether your exploration and your commitments are spiraling together toward your goals — or apart.

## v0.4 Requirements

### Goal Hierarchy

- [ ] **HIER-01**: User can create trigger_outcome nodes linked to a goal_space
- [x] **HIER-02**: Commitment panel renders goal_space → trigger_outcome → commitment as a 3-level collapsible tree
- [ ] **HIER-03**: DB schema has trigger_outcome node type and advances_goal / targets_outcome / indicates_progress edge types
- [x] **HIER-04**: Commitment panel header shows trajectory badge per goal space

### Goal Space Panel

- [ ] **GOAL-01**: User can select a goal_space node and see a dedicated detail panel (GoalSpacePanel)
- [ ] **GOAL-02**: Goal space panel shows all trigger outcomes with progress indicators (○ not started, ◐ in progress, ◉ met, ✕ blocked)
- [ ] **GOAL-03**: Progress indicators are computed from connected tests, signals, and commitments
- [ ] **GOAL-04**: Goal space panel shows commitment count and hunch count per trigger outcome

### Capture / Linking

- [ ] **CAPT-01**: Capture form shows "Which outcome does this target?" dropdown (optional, lists active trigger_outcomes)
- [ ] **CAPT-02**: Selecting an outcome auto-creates a targets_outcome edge on save
- [ ] **CAPT-03**: Capture form has "What signal would tell you this is working?" optional text field, saved as content.expected_signals
- [ ] **CAPT-04**: Weekly review surfaces undirected hunches (no targets_outcome edge) with "consider linking" prompt

### Extraction Agent

- [ ] **EXTR-01**: Extraction agent receives active goal spaces and trigger outcomes in system prompt context
- [ ] **EXTR-02**: Extraction agent suggests GOAL_RELEVANCE (which trigger outcome(s) the hunch targets)
- [ ] **EXTR-03**: Extraction agent suggests EXPECTED_SIGNALS (specific observable signals if this hunch is correct)
- [ ] **EXTR-04**: Review card shows suggested goal relevance with Accept / Reject / Link to different outcome actions

### Convergence

- [ ] **CONV-01**: System computes convergence score per goal space using defined positive/negative weight rules
- [ ] **CONV-02**: convergence_snapshots table stores scores with timestamp and factor breakdown (JSONB)
- [ ] **CONV-03**: Convergence snapshots taken on-demand and triggered when 10+ new nodes added since last snapshot
- [ ] **CONV-04**: Trajectory indicator badge shows converging (+) / neutral / drifting (-) with numeric score
- [ ] **CONV-05**: Clicking trajectory badge expands to show positive and negative factor breakdown
- [ ] **CONV-06**: Trajectory sparkline renders 30-day convergence history as inline SVG (200×40, teal/coral fill)

### Reflection Agent

- [ ] **REFL-01**: Reflection agent runs system-wide analysis: pattern detection, contradictions, coverage gaps, author blind spots, stop/strengthen/reframe recommendations
- [ ] **REFL-02**: Reflection agent assembles full system context (goals, outcomes, nodes, edges, convergence scores, tension alerts, activity by author)
- [ ] **REFL-03**: Reflection agent runs on-demand from weekly review and on threshold (10+ new nodes since last reflection)
- [ ] **REFL-04**: Reflection report renders in weekly review as expandable section with sections: Patterns, Contradictions, Coverage Gaps, Trajectory, Recommendations
- [ ] **REFL-05**: Each recommendation in reflection report has an action button opening the appropriate form

### Reflection Session

- [ ] **SESS-01**: /reflect page exists for periodic deep reflection ritual
- [ ] **SESS-02**: /reflect shows convergence sparklines for all goal spaces over 30-90 day window
- [ ] **SESS-03**: /reflect shows guided reflection questions as text inputs with answers persisted
- [ ] **SESS-04**: /reflect shows decisions log where team records decisions with linked node effects
- [ ] **SESS-05**: reflection_sessions table stores machine_reflection, human_responses, decisions, convergence_snapshot, participants

## v0.5 Requirements (deferred)

### Design Pass

- **DSNG-01**: Spiral SVG animation (Option A) as trajectory indicator — deferred to Martin's design pass
- **DSNG-02**: Two-line gauge visualization (Option B) — deferred to Martin's design pass

### Convergence Tuning

- **TUNE-01**: Admin UI for adjusting convergence score weights — defer until real usage reveals tuning needs
- **TUNE-02**: Per-goal-space weight overrides — defer

## Out of Scope

| Feature | Reason |
|---------|--------|
| Spiral SVG animation | Deferred to Martin's design pass; badge (Option C) ships in v0.4 |
| ML-based convergence scoring | Deliberate rough heuristic first — tune over real usage |
| Mobile app | Web-first, team tool |
| Real-time collaboration / presence | Single-user usage pattern in v0.x |
| OAuth / SSO | Auth whitelist sufficient for small team |
| Scheduled reflection cron (Supabase Edge Function) | On-demand + threshold sufficient for v0.4; cron is v0.5 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HIER-01 | Phase 1 | Pending |
| HIER-02 | Phase 1 | Complete |
| HIER-03 | Phase 1 | Pending |
| HIER-04 | Phase 1 | Complete |
| GOAL-01 | Phase 2 | Pending |
| GOAL-02 | Phase 2 | Pending |
| GOAL-03 | Phase 2 | Pending |
| GOAL-04 | Phase 2 | Pending |
| CAPT-01 | Phase 3 | Pending |
| CAPT-02 | Phase 3 | Pending |
| CAPT-03 | Phase 3 | Pending |
| CAPT-04 | Phase 3 | Pending |
| EXTR-01 | Phase 3 | Pending |
| EXTR-02 | Phase 3 | Pending |
| EXTR-03 | Phase 3 | Pending |
| EXTR-04 | Phase 3 | Pending |
| CONV-01 | Phase 4 | Pending |
| CONV-02 | Phase 4 | Pending |
| CONV-03 | Phase 4 | Pending |
| CONV-04 | Phase 5 | Pending |
| CONV-05 | Phase 5 | Pending |
| CONV-06 | Phase 5 | Pending |
| REFL-01 | Phase 6 | Pending |
| REFL-02 | Phase 6 | Pending |
| REFL-03 | Phase 6 | Pending |
| REFL-04 | Phase 6 | Pending |
| REFL-05 | Phase 6 | Pending |
| SESS-01 | Phase 7 | Pending |
| SESS-02 | Phase 7 | Pending |
| SESS-03 | Phase 7 | Pending |
| SESS-04 | Phase 7 | Pending |
| SESS-05 | Phase 7 | Pending |

**Coverage:**
- v0.4 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after initial definition*
