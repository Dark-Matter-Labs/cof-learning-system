---
phase: 7
slug: reflection-session-page
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 7 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + React Testing Library |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|------|------|------|-------------|-----------|-------------------|--------|
| DB migration + snapshots `?days` param | 01 | 1 | SESS-02,SESS-05 | type+grep | `npx tsc --noEmit` | ⬜ |
| ReflectClient skeleton + guided questions | 02 | 2 | SESS-01,SESS-03 | unit | `npx vitest run ...ReflectClient.test.tsx` | ⬜ |
| Decisions log + save handler | 02 | 2 | SESS-04 | unit | `npx vitest run ...ReflectClient.test.tsx` | ⬜ |
| Persist session to reflection_sessions | 03 | 3 | SESS-05 | type+grep | `npx tsc --noEmit` | ⬜ |

---

## Wave 0 Requirements

- [ ] `src/app/reflect/__tests__/ReflectClient.test.tsx` — stubs for sparkline window selector, guided questions, decisions log, save button

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual |
|----------|-------------|------------|
| NavBar Reflect link visible | SESS-01 | Visual layout |
| Sparklines render for 30/60/90 day windows | SESS-02 | Visual/interactive |
| Save persists to reflection_sessions | SESS-05 | Requires live Supabase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter
