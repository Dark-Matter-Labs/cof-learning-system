---
phase: 4
slug: convergence-computation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-30
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/lib/graph/__tests__/convergence.test.ts --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/graph/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green + `npx tsc --noEmit` passes
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CONV-01 | unit | `npx vitest run src/lib/graph/__tests__/convergence.test.ts` | Created in Plan 01 Task 1 (TDD) | ⬜ pending |
| 04-01-02 | 01 | 1 | CONV-02 | migration | verify supabase migration file exists + contains convergence_snapshots | Created in Plan 01 Task 2 | ⬜ pending |
| 04-02-01 | 02 | 2 | CONV-03 (on-demand) | type-check | `npx tsc --noEmit` + grep verification | N/A (route, no unit test) | ⬜ pending |
| 04-02-02 | 02 | 2 | CONV-03 (threshold) | unit | `npx vitest run src/lib/graph/__tests__/convergence.test.ts` | Extended in Plan 02 Task 2 (TDD) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/lib/graph/__tests__/convergence.test.ts` — created in Plan 01 Task 1 (TDD RED phase) with 15 scoring tests, extended in Plan 02 Task 2 (TDD RED phase) with 7 threshold tests
- [ ] `supabase/v0.4-convergence-snapshots.sql` — convergence_snapshots DDL (Plan 01 Task 2)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Snapshot auto-triggers after 10th node added | CONV-03 | Requires live Supabase + seeded graph data | Create 10 nodes via UI, verify convergence_snapshots row created |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
