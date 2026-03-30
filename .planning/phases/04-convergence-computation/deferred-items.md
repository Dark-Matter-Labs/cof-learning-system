# Phase 04 Deferred Items

## Pre-existing tsc errors (out of scope, not caused by Phase 04 changes)

**Files:** `src/components/graph/__tests__/DashboardSidebar.test.tsx`, `src/components/graph/__tests__/InlineCaptureCard.test.tsx`

**Error type:** TS2582 `Cannot find name 'it'`, TS2304 `Cannot find name 'expect'` / `Cannot find name 'vi'`

**Root cause:** Test files use Vitest globals (it, expect, vi) without explicit imports, and the TypeScript compiler doesn't have access to vitest global type definitions for these files. The vitest.config likely sets `globals: true` for the test runner, but tsc doesn't pick this up without the correct tsconfig include or `@vitest/globals` types.

**Impact:** tsc --noEmit reports errors in these files. Does NOT affect test execution or runtime.

**Recommended fix:** Add vitest globals types to tsconfig or add explicit imports `import { describe, it, expect, vi } from 'vitest'` to these test files.

**Logged:** 2026-03-27 during Phase 04-01 execution
