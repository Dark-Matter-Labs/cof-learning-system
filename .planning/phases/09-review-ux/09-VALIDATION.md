---
phase: 9
slug: review-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/components/review/__tests__/ReviewCard.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/review/__tests__/ReviewCard.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-W0 | 01 | 0 | REVIEW-01, REVIEW-02, REVIEW-03 | unit stub | `npx vitest run src/components/review/__tests__/ReviewCard.test.tsx` | ❌ W0 | ⬜ pending |
| 09-01-01 | 01 | 1 | REVIEW-01 | unit | `npx vitest run src/components/review/__tests__/ReviewCard.test.tsx` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | REVIEW-02 | unit | `npx vitest run src/components/review/__tests__/ReviewCard.test.tsx` | ✅ | ⬜ pending |
| 09-01-03 | 01 | 1 | REVIEW-03 | unit | `npx vitest run src/components/review/__tests__/ReviewCard.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/review/__tests__/ReviewCard.test.tsx` — stubs for REVIEW-01, REVIEW-02, REVIEW-03

*Test file does not exist — Wave 0 must create it before implementation tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All fields appear pre-checked visually on page open | REVIEW-01 | Browser render required | Open /review, click a node, verify checkboxes are checked |
| Promote All button visible and active | REVIEW-03 | Browser render required | Verify button present without any interaction |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
