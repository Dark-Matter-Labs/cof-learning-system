# Phase 7: Reflection Session Page — Research

**Researched:** 2026-03-30
**Domain:** Next.js 16 App Router page, Supabase JSONB persistence, React form state, convergence sparkline reuse
**Confidence:** HIGH

## Summary

Phase 7 delivers `/reflect` — a dedicated periodic reflection ritual page. It is the terminal phase of v0.4 and composes all prior infrastructure: convergence sparklines from Phase 5 and the reflection agent from Phase 6. The page has four concerns: (1) showing multi-goal-space sparklines over a user-selectable 30-90 day window, (2) presenting guided text-input questions whose answers persist to `reflection_sessions`, (3) a decisions log where team members record decisions with linked node effects, and (4) a DB migration that adds the missing columns to the existing `reflection_sessions` table.

The `reflection_sessions` table was created in Phase 6 (06-01) but is missing the SESS-05 columns: `human_responses`, `decisions`, `convergence_snapshot`, and `participants`. Phase 7 must add these via an `ALTER TABLE` migration — not recreate the table. The existing rows and indexes must be preserved.

The sparkline component (`ConvergenceSparkline`) and the snapshots API (`GET /api/convergence/snapshots`) already exist and are fully tested. Phase 7 uses them as-is, multiplexed across all goal spaces. The `/reflect` page does not need a new API route for reading data — it can fetch directly from the existing snapshots endpoint per goal space. It does need a new API route to POST (upsert) a reflection session record once the user submits answers and decisions.

**Primary recommendation:** Plan this as three sequential plans — (1) DB migration + session persistence types, (2) page skeleton with sparkline panel + window selector, (3) guided questions + decisions log + session POST wiring.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SESS-01 | /reflect page exists and is accessible | Next.js App Router: create `src/app/reflect/page.tsx` with auth gate; add nav link in NavBar |
| SESS-02 | /reflect shows convergence sparklines for all goal spaces over selectable 30-90 day window | Reuse `ConvergenceSparkline` + extend `GET /api/convergence/snapshots` to accept `days` param (or fetch per goal space client-side with date range); goal spaces fetched server-side |
| SESS-03 | /reflect shows guided reflection questions as text inputs with answers persisted | Client component with textarea per question; POST to `/api/reflect/session` on save |
| SESS-04 | /reflect shows decisions log where team records decisions with linked node effects | Client component: add-decision form (text + optional node_id); entries stored in `decisions` JSONB |
| SESS-05 | reflection_sessions table stores machine_reflection, human_responses, decisions, convergence_snapshot, participants | ALTER TABLE migration adding 4 JSONB columns to existing table |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.2.1 | Page routing, server components, API routes | Project standard |
| React | 19.2.4 | Client components, useState, useEffect | Project standard |
| Supabase JS | (existing) | DB reads/writes, auth | Project standard |
| d3 | ^7.9.0 | Sparkline area charts | Already used in ConvergenceSparkline |
| Tailwind CSS | (existing) | Styling | Project standard |
| Vitest + Testing Library | ^4.1.0 / ^16.3.2 | Unit tests | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/types/convergence` | internal | SparklinePoint, ConvergenceData types | For sparkline data shapes |
| `@/lib/agents/reflection` | internal | ReflectionReport type | For machine_reflection JSONB typing |
| `@/lib/supabase/server` | internal | Server-side Supabase client | In page.tsx server component |
| `@/lib/supabase/client` | internal | Client-side Supabase (not needed — use API routes) | Not needed directly in client components |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate POST route for session | Direct Supabase client in component | Route gives auth gate + validation; consistent with pattern |
| Extending existing snapshots route | New `/api/reflect/snapshots` route | Extending with `days` param is cleaner reuse |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/app/reflect/
├── page.tsx              # Server component: fetches goal spaces + last session
└── ReflectClient.tsx     # 'use client': sparklines, questions, decisions, session save

src/app/api/reflect/
└── session/
    └── route.ts          # POST: creates/updates reflection session record

supabase/
└── v0.4-reflect-session-columns.sql   # ALTER TABLE migration
```

### Pattern 1: Server + Client Split (Established in Phase 6)

**What:** Page server component fetches static/initial data, passes as props to a `'use client'` component that handles interactivity.
**When to use:** When the page needs both server-side data (goal spaces, last session) and client-side state (form inputs, fetch calls).
**Example (from review/page.tsx pattern):**
```typescript
// src/app/reflect/page.tsx  — server component
export default async function ReflectPage() {
  const supabase = await createClient();
  const { data: goalSpaces } = await supabase
    .from('nodes')
    .select('id, title')
    .eq('node_type', 'goal_space');

  const { data: lastSession } = await supabase
    .from('reflection_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return <ReflectClient goalSpaces={goalSpaces ?? []} lastSession={lastSession} />;
}
```

### Pattern 2: Window Selector for Date Range

**What:** A controlled select or button group on the client lets users pick 30/60/90 days. The selected value drives the date window passed to the sparkline fetch.
**When to use:** SESS-02 requires selectable window.
**Example:**
```typescript
const [days, setDays] = useState<30 | 60 | 90>(30);
// Derive date threshold: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
```
The existing `GET /api/convergence/snapshots` currently hardcodes a 30-day filter server-side. For the `/reflect` page to support 30-90 days, the snapshots route needs a `days` query parameter (default 30), or the `/reflect` page fetches with a custom `from` timestamp.

**Recommendation:** Add an optional `days` param to `GET /api/convergence/snapshots`. The existing GoalSpaceSection/GoalSpacePanel callers omit it and get the default 30-day behavior unchanged.

### Pattern 3: Guided Questions as Static Config

**What:** Questions are defined as a static const array (not stored in DB). The user's answers are collected into a `Record<string, string>` keyed by question ID.
**When to use:** SESS-03. Questions are stable per milestone and don't need to be DB-driven.
**Example:**
```typescript
// src/app/reflect/questions.ts
export const REFLECTION_QUESTIONS = [
  { id: 'q_trajectory', text: 'Is the trajectory of our most important goal space changing? Why?' },
  { id: 'q_surprises', text: 'What surprised you most since the last reflection?' },
  { id: 'q_decisions', text: 'What have you decided to stop or change?' },
] as const;
```

### Pattern 4: Decisions Log as Local State Array

**What:** Decisions are accumulated in component state as an array before the session is saved. Each decision entry has a `text` field and an optional `node_id` field.
**When to use:** SESS-04.
**Example:**
```typescript
interface DecisionEntry {
  readonly text: string;
  readonly node_id: string | null;
}
const [decisions, setDecisions] = useState<readonly DecisionEntry[]>([]);
// Add: setDecisions(prev => [...prev, newEntry])  // immutable append
```

### Pattern 5: Session POST Route (Matches /api/reflection/run pattern)

**What:** Auth-gated POST route. Validates body, inserts a new `reflection_sessions` row with all five fields from SESS-05.
**When to use:** SESS-03 + SESS-04 combined save.
**Example:**
```typescript
// src/app/api/reflect/session/route.ts
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  // Validate: human_responses, decisions, convergence_snapshot, participants
  await supabase.from('reflection_sessions').insert({
    machine_reflection: body.machine_reflection ?? {},
    human_responses: body.human_responses,
    decisions: body.decisions,
    convergence_snapshot: body.convergence_snapshot,
    participants: body.participants,
    node_count_at_reflection: body.node_count_at_reflection ?? 0,
    triggered_by: 'on_demand',
    run_by: user.id,
  });
  return Response.json({ success: true });
}
```

### Pattern 6: DB Migration — ALTER TABLE

**What:** The existing `reflection_sessions` table needs 4 new JSONB columns. This is an `ALTER TABLE ADD COLUMN IF NOT EXISTS` migration, not a new table.
**When to use:** SESS-05.

```sql
-- supabase/v0.4-reflect-session-columns.sql
ALTER TABLE reflection_sessions
  ADD COLUMN IF NOT EXISTS human_responses    JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decisions          JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS convergence_snapshot JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS participants       JSONB NOT NULL DEFAULT '[]';
```

CRITICAL: Use `IF NOT EXISTS` (PostgreSQL 9.6+). Do not DROP and recreate — existing Phase 6 session rows must survive.

### Anti-Patterns to Avoid

- **Recreating the reflection_sessions table:** Phase 6 already created it with RLS policies. Use `ALTER TABLE ADD COLUMN IF NOT EXISTS` only.
- **Fetching all snapshots in one query:** The snapshots API is per-goal-space. Loop over goal spaces, fetch each in parallel with `Promise.all`.
- **Storing questions in the DB:** Questions are static config. Only answers go to DB.
- **Using `supabase/client` directly in client components for writes:** Use the POST API route for session persistence — gives auth gate and validation.
- **Hardwiring 30-day window:** The requirement is 30-90 day selectable. Pass `days` param from client to API.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG area chart | Custom SVG path math | `ConvergenceSparkline` (already exists) | Tested, handles 3 edge cases, d3 domain fixed |
| Convergence data fetch | Custom Supabase query in component | `GET /api/convergence/snapshots` | Auth-gated, already handles latest + history |
| Streaming reflection text | New streaming setup | `ReflectionPanel` (already exists at `/review/ReflectionPanel.tsx`) | All streaming state machine logic is there |
| Auth guard | Manual session check | `createClient().auth.getUser()` in server component + redirect | Established pattern across all pages |

**Key insight:** Phase 7 is predominantly composition. The sparkline component, snapshot API, and reflection panel are all built. The work is layout, forms, DB migration, and wiring.

---

## Common Pitfalls

### Pitfall 1: Attempting to extend `reflection_sessions` columns without `IF NOT EXISTS`
**What goes wrong:** Migration fails if run twice, or if columns were partially added.
**Why it happens:** `ALTER TABLE ADD COLUMN` without `IF NOT EXISTS` throws in PostgreSQL when the column already exists.
**How to avoid:** Always use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in this codebase's migration pattern.
**Warning signs:** Migration SQL errors on re-run.

### Pitfall 2: Hardcoding 30-day window in snapshots endpoint
**What goes wrong:** SESS-02 requires selectable 30-90 day window, but the existing `GET /api/convergence/snapshots` hardcodes 30 days.
**Why it happens:** The endpoint was built for Phase 5 use cases only.
**How to avoid:** Add an optional `days` query param (default `30`) to the snapshots route. Clamp to valid range (1-90).
**Warning signs:** Changing the window in the UI has no effect on the data shown.

### Pitfall 3: Treating the `/reflect` page as a server-only render
**What goes wrong:** Form inputs and the window selector require client-side state; a pure server component cannot handle them.
**Why it happens:** The page fetches initial data server-side, which tempts making the whole page a server component.
**How to avoid:** Follow the server + client split: page.tsx is a server component for initial data fetch; ReflectClient.tsx is `'use client'` for interactivity.
**Warning signs:** TypeScript error: "useState is not defined" in a server component.

### Pitfall 4: Race condition in parallel goal-space sparkline fetches
**What goes wrong:** Rendering a sparkline per goal space with individual `useEffect` calls causes cascading re-renders.
**Why it happens:** Each goal space's fetch completes at different times, each triggering state update.
**How to avoid:** Fetch all goal spaces' snapshots in a single `Promise.all` in one `useEffect`, then set state once with all results.
**Warning signs:** Flicker / multiple re-renders on page load.

### Pitfall 5: NavBar nav link missing for /reflect
**What goes wrong:** SESS-01 says the page "is accessible" — if the NavBar doesn't include a Reflect link, it's only accessible by URL.
**Why it happens:** NavBar.tsx has a static `links` array that must be manually updated.
**How to avoid:** Add `{ href: '/reflect', label: 'Reflect' }` to the links array in `src/components/layout/NavBar.tsx`.
**Warning signs:** Page exists but is unreachable from the UI.

### Pitfall 6: Pre-existing TypeScript errors in DashboardSidebar.test.tsx / InlineCaptureCard.test.tsx
**What goes wrong:** `npx tsc --noEmit` exits non-zero due to vitest globals not imported in those pre-existing test files. This is not caused by Phase 7 but will appear in build validation.
**Why it happens:** Pre-existing issue documented in Phase 6 summaries.
**How to avoid:** Note in plan that TSC failure is pre-existing; validate that Phase 7 new files compile cleanly.

---

## Code Examples

Verified patterns from Phase 5/6 codebase:

### Multi-goal-space sparkline fetch (parallel)
```typescript
// Source: GoalSpaceSection.tsx pattern
useEffect(() => {
  Promise.all(
    goalSpaces.map(gs =>
      fetch(`/api/convergence/snapshots?goal_space_id=${gs.id}&days=${days}`)
        .then(r => r.json())
        .then(json => ({ goalSpaceId: gs.id, data: json.data ?? null }))
        .catch(() => ({ goalSpaceId: gs.id, data: null }))
    )
  ).then(results => {
    const map: Record<string, ConvergenceData> = {};
    for (const r of results) {
      if (r.data) map[r.goalSpaceId] = r.data;
    }
    setSparklineData(map);
  });
}, [goalSpaces, days]);
```

### Immutable decisions append (from coding-style requirement)
```typescript
// CORRECT — creates new array
setDecisions(prev => [...prev, { text: newText, node_id: selectedNodeId }]);

// WRONG — mutates
decisions.push({ text: newText, node_id: selectedNodeId });
```

### Reflection session INSERT
```typescript
// Source: /api/reflection/run/route.ts pattern
await supabase.from('reflection_sessions').insert({
  machine_reflection: lastMachineReflection ?? {},
  human_responses: answers,  // Record<string, string>
  decisions: decisions,       // DecisionEntry[]
  convergence_snapshot: currentSnapshots,
  participants: [user.id],
  node_count_at_reflection: nodeCount,
  triggered_by: 'on_demand',
  run_by: user.id,
});
```

### `days` param extension to existing snapshots route
```typescript
// src/app/api/convergence/snapshots/route.ts — EXTEND, not replace
const daysParam = searchParams.get('days');
const days = Math.min(90, Math.max(1, parseInt(daysParam ?? '30', 10)));
const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
// Replace hardcoded `thirtyDaysAgo` with `windowStart`
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `searchParams` as sync object | `searchParams: Promise<{...}>` | Next.js 15+ | Must `await searchParams` in server components |
| `single()` for optional Supabase row | `maybeSingle()` | Phase 5 decision | Avoids throw when no rows exist |
| Global RLS policies | Permissive authenticated policies on all tables | v0.1 | All tables use same pattern; Phase 7 migration must include RLS |

---

## Open Questions

1. **Should `/reflect` auto-run reflection or only show prior session?**
   - What we know: The reflection agent is rate-limited (1 per 24h). The `/reflect` page is for periodic ritual, not continuous use.
   - What's unclear: Should the page trigger a new reflection on load (if threshold met), or only show the most recent saved session?
   - Recommendation: Show the most recent `reflection_sessions` record on load. Include a "Run Reflection" button (reuse ReflectionPanel) if `reflectionDue` is true. Do not auto-trigger on page load.

2. **What guided questions to use?**
   - What we know: SESS-03 says "guided reflection questions" but does not specify the questions.
   - What's unclear: Are questions hardcoded or user-defined?
   - Recommendation: Define 3-5 static questions as a `REFLECTION_QUESTIONS` const in `src/app/reflect/questions.ts`. Questions are milestone-specific. Examples: trajectory assessment, biggest surprise, decision about what to stop. Keep it a Claude's Discretion choice.

3. **What is the shape of `convergence_snapshot` in reflection_sessions?**
   - What we know: SESS-05 lists it as a JSONB column. The snapshots API returns `{ latest, history }` per goal space.
   - What's unclear: Should it store the full history or just latest scores?
   - Recommendation: Store a map of `Record<goal_space_id, { score, computed_at }>` — the latest score per goal space at session time. This is sufficient for historical comparison without duplicating the full sparkline history.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 + @testing-library/react ^16.3.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | /reflect page renders without crashing, auth-gated | unit | `npx vitest run src/app/reflect` | ❌ Wave 0 |
| SESS-02 | Sparklines shown per goal space; window selector changes data range | unit | `npx vitest run src/app/reflect` | ❌ Wave 0 |
| SESS-03 | Guided question inputs render and capture text; answers included in session save | unit | `npx vitest run src/app/reflect` | ❌ Wave 0 |
| SESS-04 | Decisions log: can add entry with text + optional node_id; persisted in save | unit | `npx vitest run src/app/reflect` | ❌ Wave 0 |
| SESS-05 | reflection_sessions INSERT includes all 5 SESS-05 fields | unit (API route) | `npx vitest run src/app/api/reflect` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/app/reflect/__tests__/ReflectClient.test.tsx` — covers SESS-01 through SESS-04
- [ ] `src/app/api/reflect/session/__tests__/route.test.ts` — covers SESS-05 (POST session insert)
- [ ] `src/app/reflect/questions.ts` — REFLECTION_QUESTIONS const (not a test file, but needed by tests)

---

## Sources

### Primary (HIGH confidence)

- Direct codebase reads: `src/lib/agents/reflection.ts`, `src/app/api/reflection/run/route.ts`, `src/app/review/ReflectionPanel.tsx`, `supabase/v0.4-reflection-sessions.sql` — existing schema, types, and patterns
- Direct codebase reads: `src/app/api/convergence/snapshots/route.ts`, `src/components/graph/convergence/ConvergenceSparkline.tsx` — existing sparkline infrastructure
- Direct codebase reads: `src/components/commitment/GoalSpaceSection.tsx` — established fetch-per-goal-space pattern
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` — Next.js 16.2.1 page conventions
- Phase summaries: `05-01-SUMMARY.md`, `05-02-SUMMARY.md`, `06-01-SUMMARY.md`, `06-02-SUMMARY.md`, `06-03-SUMMARY.md` — key decisions and established patterns

### Secondary (MEDIUM confidence)

- `vitest.config.ts` + `package.json` — confirmed test framework versions
- `.planning/config.json` — confirmed `nyquist_validation: true`

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages already in use; no new dependencies
- Architecture: HIGH — all patterns established by Phases 5 and 6; Phase 7 is composition
- DB migration: HIGH — pattern matches existing v0.4 migrations; ALTER TABLE is standard PostgreSQL
- Pitfalls: HIGH — derived directly from Phase 6 post-mortems and decisions log

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable stack)
