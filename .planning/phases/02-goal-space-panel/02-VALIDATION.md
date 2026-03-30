---
phase: 2
slug: goal-space-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1 + @testing-library/react |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm test -- --run src/components/graph/__tests__/GoalSpacePanel.test.tsx src/lib/graph/__tests__/queries.test.ts` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run src/components/graph/__tests__/GoalSpacePanel.test.tsx src/lib/graph/__tests__/queries.test.ts`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | GOAL-01/03 | unit | `npm test -- --run src/components/graph/__tests__/GoalSpacePanel.test.tsx src/lib/graph/__tests__/queries.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | GOAL-03 | unit | `npm test -- --run src/lib/graph/__tests__/queries.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | GOAL-01/02/04 | unit | `npm test -- --run src/components/graph/__tests__/GoalSpacePanel.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 2 | GOAL-01 | unit | `npm test -- --run src/components/graph/__tests__/GoalSpacePanel.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/graph/__tests__/GoalSpacePanel.test.tsx` — stubs for GOAL-01, GOAL-02, GOAL-04
- [ ] `src/lib/graph/__tests__/queries.test.ts` — stubs for GOAL-03 (`computeOutcomeStatus` pure function)

*Existing infrastructure covers all phase requirements — no framework install needed. `src/test-setup.ts` and vitest.config.ts already exist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GoalSpacePanel renders on right side without overlapping CommitmentPanel | GOAL-01 | Visual positioning check | Click a goal_space node; verify panel appears on right at correct z-level |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
