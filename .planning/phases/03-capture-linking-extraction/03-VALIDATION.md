---
phase: 3
slug: capture-linking-extraction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | CAPT-04, EXTR-04 | unit | `npx vitest run src/app/review/__tests__/ReviewPage.test.tsx src/components/review/__tests__/GoalRelevanceField.test.tsx` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | CAPT-01/02/03 | unit | `npx vitest run src/components/graph/__tests__/InlineCaptureCard.test.tsx` | ✅ extend | ⬜ pending |
| 3-01-03 | 01 | 1 | EXTR-01/02/03 | unit | `npx vitest run src/lib/agents/__tests__/extraction.test.ts` | ✅ extend | ⬜ pending |
| 3-02-01 | 02 | 2 | CAPT-04 | unit | `npx vitest run src/app/review/__tests__/ReviewPage.test.tsx` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 2 | EXTR-04 | unit | `npx vitest run src/components/review/__tests__/GoalRelevanceField.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/review/__tests__/ReviewPage.test.tsx` — stubs for CAPT-04 (undirected hunches section)
- [ ] `src/components/review/__tests__/GoalRelevanceField.test.tsx` — stubs for EXTR-04 (Accept/Reject/Link actions)

*All other test files exist and can be extended in-place (InlineCaptureCard.test.tsx, extraction.test.ts)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Extraction agent returns goal_relevance suggestions in real app | EXTR-01/02 | Requires live Anthropic API call | Create a hunch via capture form, trigger extraction, verify review card shows GoalRelevanceField |
| targets_outcome edge visible in graph after capture with outcome selected | CAPT-02 | Visual graph state | Create hunch with outcome selected, check force graph shows edge |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
