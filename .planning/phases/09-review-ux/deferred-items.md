# Deferred Items — Phase 09-review-ux

## Pre-existing Failures (Out of Scope)

### ReviewPage.test.tsx — 6 tests failing

**Error:** `supabase.from(...).select(...).order(...).limit is not a function`
**File:** `src/app/review/__tests__/ReviewPage.test.tsx`
**Root cause:** Supabase mock in the test file does not chain `.limit()` method.
**The production code** `src/app/review/page.tsx` line 79 calls `.limit(1)`, but the mock
at time of testing does not implement this chained method.

**Status:** Pre-existing failure — present before Phase 09 work started (verified by git stash).
**Impact:** None on Phase 09 deliverables. ReviewCard changes are unrelated to the review page Supabase query.
**Recommended fix:** Update the Supabase mock in ReviewPage.test.tsx to return an object with a `.limit()` method.

**Discovered:** 2026-03-31 during Phase 09-01 full-suite run.
