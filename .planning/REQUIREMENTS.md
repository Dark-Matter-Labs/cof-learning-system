# Requirements: COF OS v0.5

**Defined:** 2026-03-31
**Core Value:** The system must always tell you whether your exploration and your commitments are spiraling together toward your goals — or apart.

## v0.5 Requirements

*All requirements in this milestone are UX fixes from Robyn's first real usage session (2026-03-28).*

### Layout & Theme

- [x] **LAYOUT-01**: Sidebar content (commitment panel, any left/right panel) starts below the navbar — not obscured by fixed nav
- [x] **LAYOUT-02**: All components use Tailwind `dark:` variants or CSS variables — no hardcoded colors remaining
- [x] **LAYOUT-03**: Graph canvas, node cards, commitment panel, and tension alerts are readable in both light and dark mode

### Review UX

- [x] **REVIEW-01**: ReviewCard extraction fields default to checked (opt-out model — user rejects bad ones, not approves good ones)
- [x] **REVIEW-02**: Promote button enabled by default when all fields are checked
- [x] **REVIEW-03**: "Promote all" one-click shortcut accepts all fields and promotes to graph immediately

### Capture Types

- [x] **CAPT-05**: Capture page title renamed from "Capture a Hunch" to "Capture"
- [x] **CAPT-06**: Shared `CAPTURE_TYPES` config (in `lib/config/captureTypes.ts`) used by both capture page and inline graph card
- [x] **CAPT-07**: Meeting notes / call transcript is a selectable capture type showing title, date, and participants fields
- [x] **CAPT-08**: Meeting transcript submission extracts and proposes multiple nodes (insights, actions, people, decisions, open questions)

### Date & People

- [ ] **CAPT-09**: Insight date field on capture form ("When did this happen?", defaults to today), stored as `insight_date` on node
- [ ] **CAPT-10**: Timeline view uses `insight_date` for node positioning when set, falling back to `created_at`
- [ ] **PEOP-01**: Capture form has people/participants field with autocomplete suggestions from existing person nodes
- [ ] **PEOP-02**: Selected participants create `authored_by` or `connected_to` edges to person nodes on save
- [ ] **PEOP-03**: Extraction agent detects people mentioned in text and suggests person node connections

### Edit Nodes & Connections

- [ ] **EDIT-01**: Node detail panel has Edit button that switches to edit mode (title, description, type, confidence, status, domain tags)
- [ ] **EDIT-02**: Node detail panel shows all current connections (edge type + connected node title) with a Remove button per connection
- [ ] **EDIT-03**: User can add a new connection from the detail panel: search existing nodes, select edge type and direction, confirm

### Options & Auto-Connect

- [ ] **OPT-01**: When an option node is created, extraction agent suggests `connected_to` edges to related existing nodes
- [ ] **OPT-02**: When any new node's text mentions an existing option node by name, extraction agent suggests a `connected_to` edge to that option

### File Upload

- [ ] **UPLOAD-01**: Capture page has a file upload zone accepting .pdf, .txt, and .md files
- [ ] **UPLOAD-02**: Uploaded PDFs are extracted server-side (pdf-parse); extracted text pre-populates the description field
- [ ] **UPLOAD-03**: Original file stored in Supabase Storage (`uploads` bucket); URL saved in `content.media_url` on the node

## v0.4 Requirements (archived)

*All v0.4 requirements are complete — see git history for REQUIREMENTS.md pre-2026-03-31.*

Key v0.4 completions: goal hierarchy, goal space panel, capture linking, extraction agent, convergence scoring, trajectory indicators, reflection agent, /reflect page.

## Deferred (from v0.4 → future)

### Design Pass

- **DSNG-01**: Spiral SVG animation (Option A) as trajectory indicator — deferred to Martin's design pass
- **DSNG-02**: Two-line gauge visualization (Option B) — deferred to Martin's design pass

### Convergence Tuning

- **TUNE-01**: Admin UI for adjusting convergence score weights — defer until real usage reveals tuning needs
- **TUNE-02**: Per-goal-space weight overrides — defer

### Scheduled Cron

- **CRON-01**: Scheduled reflection cron (Supabase Edge Function) — on-demand + threshold sufficient; defer to v0.6

## Out of Scope

| Feature | Reason |
|---------|--------|
| Spiral SVG animation | Deferred to Martin's design pass |
| ML-based convergence scoring | Deliberate rough heuristic first — tune over real usage |
| Mobile app | Web-first, team tool |
| Real-time collaboration / presence | Single-user usage pattern in v0.x |
| OAuth / SSO | Auth whitelist sufficient for small team |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | Phase 8 | Complete |
| LAYOUT-02 | Phase 8 | Complete |
| LAYOUT-03 | Phase 8 | Complete |
| REVIEW-01 | Phase 9 | Complete |
| REVIEW-02 | Phase 9 | Complete |
| REVIEW-03 | Phase 9 | Complete |
| CAPT-05 | Phase 10 | Pending |
| CAPT-06 | Phase 10 | Pending |
| CAPT-07 | Phase 10 | Complete |
| CAPT-08 | Phase 10 | Complete |
| CAPT-09 | Phase 11 | Pending |
| CAPT-10 | Phase 11 | Pending |
| PEOP-01 | Phase 12 | Pending |
| PEOP-02 | Phase 12 | Pending |
| PEOP-03 | Phase 12 | Pending |
| EDIT-01 | Phase 13 | Pending |
| EDIT-02 | Phase 13 | Pending |
| EDIT-03 | Phase 13 | Pending |
| OPT-01 | Phase 14 | Pending |
| OPT-02 | Phase 14 | Pending |
| UPLOAD-01 | Phase 15 | Pending |
| UPLOAD-02 | Phase 15 | Pending |
| UPLOAD-03 | Phase 15 | Pending |

**Coverage:**
- v0.5 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 — traceability filled after roadmap creation*
