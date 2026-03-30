---
phase: 6
slug: reflection-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 6 — Validation Strategy

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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 6-01-01 | 01 | 1 | REFL-01 | unit | `npm run test -- --run reflection` | ⬜ pending |
| 6-01-02 | 01 | 1 | REFL-01 | unit | `npm run test -- --run reflection` | ⬜ pending |
| 6-02-01 | 02 | 1 | REFL-01,REFL-02 | integration | `npx tsc --noEmit` | ⬜ pending |
| 6-03-01 | 03 | 2 | REFL-02,REFL-03 | unit | `npm run test -- --run ReflectionPanel` | ⬜ pending |
| 6-03-02 | 03 | 2 | REFL-04,REFL-05 | unit | `npm run test -- --run ReflectionPanel` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/lib/agents/reflection.test.ts` — stubs for buildPrompt, parseResponse, context assembly (REFL-01)
- [ ] `__tests__/api/reflect.test.ts` — stubs for POST /api/reflect streaming endpoint (REFL-02)
- [ ] `__tests__/components/ReflectionPanel.test.tsx` — stubs for Run Reflection button, streaming display, action buttons (REFL-02, REFL-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streaming text appears progressively in panel | REFL-02 | UI streaming behavior | Trigger reflection, verify text streams live to panel |
| Action buttons appear after analysis | REFL-03 | Visual rendering | Verify create/review action buttons render with recommendations |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
