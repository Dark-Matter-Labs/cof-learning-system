# Phase 6: Reflection Agent - Research

**Researched:** 2026-03-30
**Domain:** LLM agent architecture, streaming API routes, Supabase persistence, React UI integration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REFL-01 | Reflection agent runs system-wide analysis: pattern detection, contradictions, coverage gaps, author blind spots, stop/strengthen/reframe recommendations | Addressed by reflection agent function in `src/lib/agents/reflection.ts` following extraction.ts pattern; structured JSON output schema with five analysis sections |
| REFL-02 | Reflection agent assembles full system context (goals, outcomes, nodes, edges, convergence scores, tension alerts, activity by author) | Addressed by context assembler function that queries all tables in parallel; Supabase queries mirror snapshot route pattern |
| REFL-03 | Reflection agent runs on-demand from weekly review and on threshold (10+ new nodes since last reflection) | Addressed by `shouldTriggerReflection` reusing existing `shouldTriggerSnapshot` threshold pattern; on-demand triggered via POST to `/api/reflection/run`; streaming via Web Streams API in route handler |
| REFL-04 | Reflection report renders in weekly review as expandable section with Patterns, Contradictions, Coverage Gaps, Trajectory, Recommendations sections | Addressed by `ReflectionPanel` client component consuming SSE stream; expandable section renders five named sections; weekly review page gains Run Reflection button + panel |
| REFL-05 | Each recommendation in reflection report has an action button opening the appropriate form | Addressed by mapping recommendation `action_type` enum to existing capture/linking forms; action buttons open existing UI entry points (capture form, node review route) |
</phase_requirements>

---

## Summary

Phase 6 implements a system-wide LLM reflection agent that assembles the full graph context and surfaces patterns, contradictions, coverage gaps, trajectory observations, and actionable recommendations. It follows the extraction agent pattern already established in `src/lib/agents/extraction.ts` — a pure context-assembly function + a structured-JSON LLM call + a typed parser — with two significant additions: (1) streaming the LLM response to the client over a Next.js Route Handler using the Web Streams API, and (2) persisting completed reflection sessions to a new `reflection_sessions` table.

The weekly review page (`src/app/review/page.tsx`) gains a "Run Reflection" button that triggers the agent. Because the page is currently a Server Component, the button must be extracted into a thin `'use client'` component that fires a `fetch` against `/api/reflection/run` and renders the streamed result into an expandable `ReflectionPanel`. Rate-limiting (max 1 per 24h) is enforced server-side by checking `reflection_sessions` for a recent record before running.

The context window constraint documented in PROJECT.md (reflection agent context must stay under 100k tokens) drives the most important design decision: node content is summarized rather than passed verbatim. The context assembler includes full metadata for all nodes but truncates `description` fields to 200 characters. This keeps the assembled context well within Claude's context window even for large graphs.

**Primary recommendation:** Model the reflection agent on the extraction agent (`src/lib/agents/extraction.ts`). Add `'reflection'` to the `AgentName` union in `src/lib/llm/index.ts`, write a pure `buildReflectionContext` + `parseReflectionResponse` pair (TDD), then wire it to a streaming Route Handler at `/api/reflection/run`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.80.0 (already installed) | LLM calls and streaming | Already in use; `client.messages.stream()` available for SSE |
| Next.js Route Handler (Web Streams API) | 16.2.1 | Streaming SSE response to client | Official pattern in `node_modules/next/dist/docs/01-app/02-guides/streaming.md` §"Streaming in Route Handlers" |
| Supabase (existing client) | already installed | Context assembly queries + persistence | All data lives in Supabase; server client pattern established |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.1.0 (already installed) | TDD for pure functions | Same test setup as extraction.test.ts |
| React `useState` / `useEffect` | React 19.2.4 | Client component state for streaming panel | `ReflectionPanel` must be `'use client'` to manage stream state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Streams `ReadableStream` in route | `EventSource` / SSE text/event-stream | ReadableStream is simpler for one-shot LLM responses; EventSource requires persistent connection management |
| Server-side `client.messages.stream()` piped through | `create()` with `stream: true` flag on body | `client.messages.stream()` helper is cleaner and handles abort; prefer the named helper |

**No new packages needed.** All requirements are met with existing dependencies.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── agents/
│   │   ├── extraction.ts        # existing
│   │   └── reflection.ts        # NEW — pure functions only, no I/O
│   └── llm/
│       └── index.ts             # extend AgentName union to include 'reflection'
├── app/
│   ├── api/
│   │   └── reflection/
│   │       └── run/
│   │           └── route.ts     # NEW — streaming POST handler
│   └── review/
│       ├── page.tsx             # extend: add ReflectionSection
│       └── ReflectionPanel.tsx  # NEW — 'use client', consumes stream
└── supabase/
    └── v0.4-reflection-sessions.sql  # NEW — migration file
```

### Pattern 1: Pure Agent Module (mirrors extraction.ts)

**What:** All context assembly and response parsing lives in a pure TypeScript module with no I/O. Only the route handler calls Supabase and the LLM.
**When to use:** Always for the agent logic layer. Enables unit testing without mocks for I/O.

```typescript
// src/lib/agents/reflection.ts (pattern — not complete implementation)
// Source: mirrors src/lib/agents/extraction.ts

export interface ReflectionContext {
  readonly goalSpaces: ReadonlyArray<{ id: string; title: string }>;
  readonly triggerOutcomes: ReadonlyArray<{ id: string; title: string }>;
  readonly nodes: ReadonlyArray<{ id: string; title: string; node_type: string; status: string; description: string | null }>;
  readonly convergenceSnapshots: ReadonlyArray<{ goal_space_id: string; score: number; computed_at: string }>;
  readonly activeTensions: ReadonlyArray<{ type: string; severity: string; description: string }>;
  readonly activityByAuthor: ReadonlyArray<{ author_id: string; node_count: number }>;
}

export interface ReflectionReport {
  readonly patterns: readonly string[];
  readonly contradictions: ReadonlyArray<{ description: string; node_ids: readonly string[] }>;
  readonly coverage_gaps: readonly string[];
  readonly trajectory: string;
  readonly recommendations: ReadonlyArray<{
    readonly text: string;
    readonly action_type: 'create_node' | 'link_node' | 'flag_tension' | 'review_node' | null;
    readonly target_node_id: string | null;
  }>;
}

export function buildReflectionPrompt(ctx: ReflectionContext): string { /* ... */ }
export function parseReflectionResponse(content: string): ReflectionReport { /* ... */ }
```

### Pattern 2: Streaming Route Handler (Web Streams API)

**What:** POST handler at `/api/reflection/run` that streams Anthropic token deltas as plain text chunks.
**When to use:** For the on-demand reflection trigger. Client reads chunks via `response.body.getReader()`.

```typescript
// src/app/api/reflection/run/route.ts
// Source: Next.js docs node_modules/next/dist/docs/01-app/02-guides/streaming.md §"Streaming in Route Handlers"

export async function POST(_request: Request): Promise<Response> {
  // 1. Auth check (supabase.auth.getUser())
  // 2. Rate-limit check (query reflection_sessions for last 24h)
  // 3. Assemble context (parallel Supabase queries)
  // 4. Start Anthropic stream

  const encoder = new TextEncoder();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = new ReadableStream({
    async start(controller) {
      const messageStream = anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: REFLECTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildReflectionPrompt(ctx) }],
      });

      let fullContent = '';

      for await (const chunk of messageStream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text;
          fullContent += text;
          controller.enqueue(encoder.encode(text));
        }
      }

      // After stream completes: persist to reflection_sessions
      await persistReflectionSession(supabase, userId, fullContent, nodeCountAtSnapshot);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  });
}
```

### Pattern 3: Client Component consuming stream

**What:** `ReflectionPanel` is a `'use client'` component that fetches `/api/reflection/run`, reads the response body as a stream, and accumulates text into state.

```typescript
// src/app/review/ReflectionPanel.tsx
'use client';

import { useState } from 'react';

export function ReflectionPanel() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [rawOutput, setRawOutput] = useState('');

  async function runReflection() {
    setStatus('running');
    setRawOutput('');

    const response = await fetch('/api/reflection/run', { method: 'POST' });
    if (!response.ok) { setStatus('error'); return; }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setRawOutput(prev => prev + decoder.decode(value, { stream: true }));
    }
    setStatus('done');
  }

  // Parse rawOutput JSON when status === 'done' to render structured sections
  // ...
}
```

### Pattern 4: Threshold trigger (mirrors shouldTriggerSnapshot)

**What:** Reuse the `shouldTriggerSnapshot` function signature pattern for reflection.
**When to use:** In the nodes POST handler — already has snapshot threshold logic; add reflection check alongside it.

```typescript
// Source: src/lib/graph/convergence.ts (existing shouldTriggerSnapshot)
export function shouldTriggerReflection(input: TriggerSnapshotInput): boolean {
  // identical implementation to shouldTriggerSnapshot
  const threshold = input.threshold ?? 10;
  const lastCount = input.lastSnapshotCount ?? 0;
  return (input.currentCount - lastCount) >= threshold;
}
```

### Pattern 5: LLM agent slot extension

**What:** Add `'reflection'` to the `AgentName` union in `src/lib/llm/index.ts`.
**Why necessary:** `callLLM` is typed against `AgentName`. The reflection agent needs its own configurable model slot (`REFLECTION_LLM_PROVIDER`, `REFLECTION_LLM_MODEL`).

```typescript
// src/lib/llm/index.ts — modify line 21
type AgentName = 'extraction' | 'review' | 'create' | 'reflection';
```

### Anti-Patterns to Avoid
- **Streaming then throwing:** The HTTP 200 is sent with the first chunk. Validate auth, rate limit, and context assembly BEFORE starting the stream. If any pre-check fails, return a normal JSON error response (not a stream).
- **Awaiting the full LLM response before streaming:** Defeats the purpose of streaming; clients will see a long blank wait. Always use `client.messages.stream()` and pipe deltas immediately.
- **Persisting inside the loop:** Write the reflection_session record only after `controller.close()`, not on every chunk. Accumulate `fullContent` in a local variable during streaming.
- **Blocking the nodes POST handler:** The threshold reflection trigger must be fire-and-forget (do not `await` the full reflection run inside the nodes POST). Instead, trigger an async job or simply check the count and set a flag that the weekly review UI surfaces.
- **Parsing partial JSON mid-stream:** Do not try to parse structured sections until the stream is fully received. Show raw streaming text first; parse and render structured sections on `status === 'done'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming LLM tokens to client | Custom SSE framing with `data:` lines | `ReadableStream` + Web Streams API (Route Handler) | Already native in Next.js 16 route handlers; no additional framing needed for one-shot text output |
| LLM streaming iteration | Manual HTTP chunked response parsing | `anthropic.messages.stream()` async iterable | SDK handles SSE parsing, abort, error events |
| Rate limiting | Custom counter table | Query `reflection_sessions` by `created_at > now() - interval '24h'` | reflection_sessions table already serves dual purpose; no extra table |
| Token counting | Manual string length estimates | Trust the 100k token guideline; truncate descriptions to 200 chars | Simple, deterministic, verifiable |

**Key insight:** The streaming plumbing is 15 lines of Route Handler code. The complexity is in context assembly and the LLM prompt — not the transport layer.

---

## Common Pitfalls

### Pitfall 1: Streaming error after headers sent
**What goes wrong:** Auth or DB errors thrown after `new ReadableStream({ start() })` is returned result in a broken stream with no error status code to the client.
**Why it happens:** HTTP 200 + headers are committed when `new Response(stream, ...)` is returned. Errors inside `start()` close the stream with corrupted output.
**How to avoid:** Run all pre-flight checks (auth, rate limit, context assembly) synchronously before constructing the `ReadableStream`. Only create the stream after all checks pass.
**Warning signs:** Client sees partial text then abrupt stream end.

### Pitfall 2: Context window overflow
**What goes wrong:** Sending full node descriptions to the LLM causes token overflow and API errors.
**Why it happens:** The graph can have hundreds of nodes, each with multi-paragraph descriptions.
**How to avoid:** Truncate `description` to 200 characters in `buildReflectionPrompt`. Include `node_count` in context summary. PROJECT.md specifies 100k token limit.
**Warning signs:** Anthropic 400 error with `prompt_too_long` or similar.

### Pitfall 3: JSON parse failure on streaming output
**What goes wrong:** Parsing `rawOutput` as JSON mid-stream throws because the JSON is incomplete.
**Why it happens:** Client parses on every chunk event.
**How to avoid:** Only parse after `status === 'done'`. Show raw streaming text during `status === 'running'`.
**Warning signs:** Render showing "JSON parse error" mid-stream.

### Pitfall 4: Rate limit bypass via parallel requests
**What goes wrong:** Two users click "Run Reflection" simultaneously, both pass the 24h check (no record exists yet), and two reflections run.
**Why it happens:** Race condition between check and insert.
**How to avoid:** Use a Postgres unique constraint or `INSERT ... ON CONFLICT DO NOTHING` on reflection_sessions keyed on `date_trunc('day', created_at)`. For a small team, checking `COUNT(*) > 0` for the last 24h before inserting is acceptable — two reflections in a day is not harmful, just wasteful.
**Warning signs:** Multiple reflection_session rows within minutes of each other.

### Pitfall 5: review/page.tsx is a Server Component — cannot add onClick directly
**What goes wrong:** Adding a `<button onClick={runReflection}>` to the existing Server Component causes a build error.
**Why it happens:** Server Components cannot have event handlers.
**How to avoid:** Extract the button and panel into a `ReflectionPanel.tsx` with `'use client'` directive; import it into the page. Pattern is identical to `GoalSpacePanel` which got `'use client'` added in Phase 5 (see STATE.md decision log).
**Warning signs:** Build error: "Event handlers cannot be passed to Client Component props."

---

## Code Examples

### Assembling reflection context (parallel queries)
```typescript
// Source: mirrors src/app/api/convergence/snapshot/route.ts pattern
const [
  { data: nodesData },
  { data: edgesData },
  { data: tensionsData },
  { data: snapshotsData },
  { data: activityData },
] = await Promise.all([
  supabase.from('nodes').select('id, title, node_type, status, description, author_id').neq('status', 'archived'),
  supabase.from('edges').select('source_id, target_id, edge_type'),
  supabase.from('tension_alerts').select('type, severity, description').eq('status', 'active'),
  supabase.from('convergence_snapshots')
    .select('goal_space_id, score, computed_at')
    .order('computed_at', { ascending: false })
    .limit(50),
  supabase.from('activity_log')
    .select('actor_id')
    .order('created_at', { ascending: false })
    .limit(500),
]);
```

### Rate limit check
```typescript
// Source: Supabase query pattern from existing routes
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { count } = await supabase
  .from('reflection_sessions')
  .select('id', { count: 'exact', head: true })
  .gt('created_at', cutoff);

if ((count ?? 0) > 0) {
  return NextResponse.json(
    { error: 'Reflection already run in the last 24 hours' },
    { status: 429 }
  );
}
```

### Persisting a reflection session
```typescript
// Source: mirrors convergence snapshot insert pattern
await supabase.from('reflection_sessions').insert({
  machine_reflection: parsedReport,
  node_count_at_reflection: nodeCount,
  triggered_by: 'on_demand', // or 'threshold'
  run_by: userId,
});
```

---

## Database Migration

### New table: `reflection_sessions`

```sql
-- supabase/v0.4-reflection-sessions.sql
CREATE TABLE IF NOT EXISTS reflection_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_reflection      JSONB NOT NULL DEFAULT '{}',
  node_count_at_reflection INT NOT NULL DEFAULT 0,
  triggered_by            TEXT DEFAULT 'on_demand' CHECK (triggered_by IN ('on_demand', 'threshold')),
  run_by                  UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reflection_sessions_created
  ON reflection_sessions(created_at DESC);

ALTER TABLE reflection_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reflection_sessions"
  ON reflection_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage reflection_sessions"
  ON reflection_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

**Note:** Phase 7 extends this table with `human_responses`, `decisions`, `convergence_snapshot`, and `participants` columns. Design the Phase 6 migration to add only the columns needed now. Avoid adding Phase 7 columns early — they would be empty for all Phase 6 records.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Non-streaming LLM call (collect full response, return JSON) | Streaming via `client.messages.stream()` + Web Streams API Route Handler | Anthropic SDK ≥0.20, Next.js App Router | Reflection feels live; users see output as it generates rather than waiting 10-30s for full response |
| Full node content in prompt | Truncated descriptions (200 chars), summary counts | Project constraint (100k token limit) | Avoids token overflow on large graphs |

**Deprecated/outdated:**
- `stream: true` body flag: The older pattern of passing `stream: true` in the `create()` body works but `client.messages.stream()` is the current idiomatic API (source: SDK src/resources/messages/messages.ts line 154).

---

## Open Questions

1. **Should the threshold trigger (10+ new nodes) fire the full streaming reflection or just set a badge?**
   - What we know: The convergence snapshot threshold fires a background API call from the nodes POST route. The same pattern is available for reflection.
   - What's unclear: A streaming response cannot be consumed from a background POST — the caller (nodes POST) would need to fire-and-forget without reading the stream. The reflection is better triggered on next page load (show "reflection due" badge) rather than silently in the background.
   - Recommendation: Implement threshold as a badge/prompt in the weekly review UI. When node_count delta >= 10 since last reflection, show "New activity since last reflection — run now?" rather than auto-triggering. This avoids silent background LLM costs and keeps the streaming UX consistent.

2. **How should action buttons map to existing UI entry points?**
   - What we know: The capture form lives at `/capture/new`, node review at `/capture/{id}/review`, and graph at `/graph`. No dedicated "link node" modal exists yet.
   - What's unclear: A "link nodes" action from a recommendation has no existing form.
   - Recommendation: For Phase 6, limit action types to `create_node` (opens `/capture/new` with pre-filled title) and `review_node` (opens `/capture/{id}/review`). Defer `link_node` action buttons to Phase 7 or later when a dedicated linking UI exists.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/lib/agents/__tests__/reflection.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REFL-01 | `buildReflectionPrompt` includes all context sections | unit | `npx vitest run src/lib/agents/__tests__/reflection.test.ts` | ❌ Wave 0 |
| REFL-01 | `parseReflectionResponse` returns typed ReflectionReport | unit | `npx vitest run src/lib/agents/__tests__/reflection.test.ts` | ❌ Wave 0 |
| REFL-01 | `parseReflectionResponse` throws on missing required fields | unit | `npx vitest run src/lib/agents/__tests__/reflection.test.ts` | ❌ Wave 0 |
| REFL-02 | Context assembler includes all data tables (verified via prompt output) | unit | `npx vitest run src/lib/agents/__tests__/reflection.test.ts` | ❌ Wave 0 |
| REFL-03 | `shouldTriggerReflection` returns true when delta >= threshold | unit | `npx vitest run src/lib/graph/__tests__/convergence.test.ts` or dedicated file | ❌ Wave 0 |
| REFL-03 | `shouldTriggerReflection` returns false when delta < threshold | unit | same | ❌ Wave 0 |
| REFL-04 | ReflectionPanel renders "Run Reflection" button | unit (component) | `npx vitest run src/components/review/__tests__/ReflectionPanel.test.tsx` | ❌ Wave 0 |
| REFL-04 | ReflectionPanel shows loading state during stream | unit (component) | same | ❌ Wave 0 |
| REFL-05 | Recommendation with action_type renders action button | unit (component) | same | ❌ Wave 0 |
| REFL-05 | Action button navigates to correct route | unit (component) | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/agents/__tests__/reflection.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/agents/__tests__/reflection.test.ts` — covers REFL-01, REFL-02 (pure function tests)
- [ ] `src/components/review/__tests__/ReflectionPanel.test.tsx` — covers REFL-04, REFL-05 (component tests)
- [ ] `src/lib/graph/__tests__/reflection-threshold.test.ts` or extend `convergence.test.ts` — covers REFL-03

---

## Sources

### Primary (HIGH confidence)
- `src/lib/agents/extraction.ts` — agent module pattern to follow exactly
- `src/lib/llm/index.ts` — AgentName union, callLLM signature
- `src/app/api/convergence/snapshot/route.ts` — route handler pattern (auth, parallel queries, insert)
- `src/lib/graph/convergence.ts` — `shouldTriggerSnapshot` pattern for threshold logic
- `node_modules/next/dist/docs/01-app/02-guides/streaming.md` §"Streaming in Route Handlers" — Web Streams API in route handlers
- `node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts` line 154 — `client.messages.stream()` API
- `supabase/v0.4-convergence-snapshots.sql` — migration file pattern and RLS policy pattern
- `src/app/review/page.tsx` — weekly review page structure to extend
- PROJECT.md — 100k token constraint for reflection context

### Secondary (MEDIUM confidence)
- `node_modules/@anthropic-ai/sdk/src/core/streaming.ts` — `content_block_delta` + `text_delta` event types for streaming iteration

### Tertiary (LOW confidence)
- None — all findings verified against codebase source files

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in codebase, no new installs
- Architecture: HIGH — directly modeled on established patterns in extraction.ts and snapshot route
- Streaming: HIGH — verified against Next.js 16 docs and Anthropic SDK source
- Pitfalls: HIGH — derived from existing code patterns and HTTP streaming constraints (documented in Next.js guide)
- DB migration: HIGH — mirrors v0.4-convergence-snapshots.sql pattern exactly

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable stack; Anthropic SDK streaming API is stable)
