---
phase: 4
slug: convergence-computation
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Quick run command** | `npx vitest run src/lib/graph/convergence.ts --reporter=verbose` |
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
| 04-01-01 | 01 | 1 | CONV-01 | unit | `npx vitest run src/lib/graph/__tests__/convergence.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CONV-02 | migration | verify supabase migration file exists + contains convergence_snapshots | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | CONV-03 | integration | `npx vitest run src/app/api/__tests__/convergence.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/graph/__tests__/convergence.test.ts` — failing unit tests for scoring function (CONV-01)
- [ ] `src/app/api/__tests__/convergence.test.ts` — failing tests for snapshot API + threshold trigger (CONV-03)
- [ ] Migration file stub — `supabase/v0.4-convergence-snapshots.sql` (CONV-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Snapshot auto-triggers after 10th node added | CONV-03 | Requires live Supabase + seeded graph data | Create 10 nodes via UI, verify convergence_snapshots row created |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
