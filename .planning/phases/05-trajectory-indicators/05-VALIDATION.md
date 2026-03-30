---
phase: 5
slug: trajectory-indicators
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + React Testing Library |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | CONV-04 | unit | `npm run test -- --run convergence-snapshots` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | CONV-04 | integration | `npm run test -- --run convergence-snapshots` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 2 | CONV-05 | unit | `npm run test -- --run TrajectoryBadge` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 2 | CONV-05 | unit | `npm run test -- --run TrajectoryBadge` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 2 | CONV-06 | unit | `npm run test -- --run ConvergenceSparkline` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 2 | CONV-06 | unit | `npm run test -- --run ConvergenceSparkline` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/api/convergence-snapshots-get.test.ts` — stubs for GET /api/convergence/snapshots endpoint (CONV-04)
- [ ] `__tests__/components/TrajectoryBadge.test.tsx` — stubs for badge rendering, click-expand, factor breakdown (CONV-05)
- [ ] `__tests__/components/ConvergenceSparkline.test.tsx` — stubs for SVG sparkline rendering, teal/coral fill (CONV-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Badge visible in goal space header | CONV-05 | Visual layout verification | Open goal space, confirm badge shows converging(+)/neutral/drifting(-) with score |
| Sparkline displays in expanded panel | CONV-06 | Visual rendering | Expand goal space panel, verify 200x40 SVG sparkline with correct fill color |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
