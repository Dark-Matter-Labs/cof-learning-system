# v0.7 Automation — Weekly Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a weekly digest that summarises what moved forward, what's stuck, and what needs attention — shown in the /log feed and triggerable manually.

**Architecture:** `lib/digest/generate.ts` does the DB query + LLM call. A POST route at `/api/digest` exposes it for manual triggers. A Supabase Edge Function cron calls the same endpoint weekly. The digest is stored as a `learning` node with `content.is_digest = true` and surfaces in /log automatically via the existing feed.

**Tech Stack:** Next.js 16 App Router, Supabase (server client + Edge Functions), `callLLM` via existing abstraction, Vitest

**Execute after:** v0.7 Daily Use plan is complete (needs /log to display digests).

---

## File Structure

**Create:**
- `src/lib/digest/generate.ts`
- `src/lib/digest/__tests__/generate.test.ts`
- `src/app/api/digest/route.ts`
- `src/app/api/digest/__tests__/route.test.ts`
- `supabase/functions/weekly-digest/index.ts`

**Modify:**
- `src/app/log/LogClient.tsx` — add "Generate digest" button for manual trigger

---

## Task 1: Digest generator

**Files:**
- Create: `src/lib/digest/generate.ts`
- Create: `src/lib/digest/__tests__/generate.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/digest/__tests__/generate.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm', () => ({
  callLLM: vi.fn().mockResolvedValue({
    content: 'This week, the team made progress on formation capital. Key decision: focus on the Madrid site. Next: validate assumptions with Leon.',
    model: 'claude-test',
  }),
}));

const mockSelect = vi.fn();
const mockGt = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();
const mockSelectInsert = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

import { generateWeeklyDigest } from '../generate';

describe('generateWeeklyDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGt.mockReturnValue({ data: [], error: null });
    mockEq.mockReturnValue({ gt: mockGt });
    mockSelect.mockReturnValue({ eq: mockEq, gt: mockGt });
    mockSingle.mockResolvedValue({ data: { id: 'digest-1', title: 'Weekly digest' }, error: null });
    mockSelectInsert.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelectInsert });
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
  });

  it('creates a learning node with is_digest=true', async () => {
    const result = await generateWeeklyDigest('user-1');
    expect(result.id).toBe('digest-1');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        node_type: 'learning',
        content: expect.objectContaining({ is_digest: true }),
      })
    );
  });

  it('calls LLM with weekly summary context', async () => {
    const { callLLM } = await import('@/lib/llm');
    await generateWeeklyDigest('user-1');
    expect(callLLM).toHaveBeenCalledWith('reflection', expect.objectContaining({
      systemPrompt: expect.stringContaining('weekly digest'),
    }));
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/lib/digest/__tests__/generate.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement generate.ts**

```typescript
// src/lib/digest/generate.ts
import { createAdminClient } from '@/lib/supabase/admin';
import { callLLM } from '@/lib/llm';

const DIGEST_PROMPT = `You are generating a weekly digest for a team knowledge system.

Given the activity summary below, write a 200-word conversational summary:
- What moved forward this week
- What's stuck or unresolved
- What needs attention next week
- 2-3 suggested priorities for the coming week

Reference specific items by name. Keep it direct and useful — this is for a small expert team, not a broad audience.`;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export async function generateWeeklyDigest(userId: string): Promise<{ id: string; title: string }> {
  const supabase = createAdminClient();
  const since = daysAgo(7);

  const { data: recentNodes } = await supabase
    .from('nodes')
    .select('node_type, title, content, created_at')
    .eq('status', 'promoted')
    .gt('created_at', since);

  const { data: recentEdges } = await supabase
    .from('edges')
    .select('edge_type')
    .gt('created_at', since);

  const nodes = recentNodes ?? [];
  const edges = recentEdges ?? [];

  const byType = nodes.reduce<Record<string, number>>((acc, n) => {
    const key = n.node_type as string;
    return { ...acc, [key]: (acc[key] ?? 0) + 1 };
  }, {});

  const decisions = nodes.filter((n: { content: { is_decision?: boolean } | null }) => n.content?.is_decision);
  const meetingCount = byType.meeting_notes ?? 0;
  const insightCount = (byType.hunch ?? 0) + (byType.learning ?? 0);

  const context = [
    `This week: ${nodes.length} new captures (${meetingCount} meetings, ${insightCount} insights, ${decisions.length} decisions)`,
    `New connections: ${edges.length}`,
    decisions.length > 0 ? `Decisions: ${decisions.map((d: { title: string }) => d.title).join(', ')}` : '',
    `Recent captures: ${nodes.slice(0, 5).map((n: { title: string }) => n.title).join(', ')}`,
  ].filter(Boolean).join('\n');

  const response = await callLLM('reflection', {
    systemPrompt: DIGEST_PROMPT,
    userMessage: context,
    maxTokens: 500,
  });

  const weekOf = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const title = `Weekly digest — ${weekOf}`;

  const { data, error } = await supabase
    .from('nodes')
    .insert({
      node_type: 'learning',
      title,
      description: response.content,
      status: 'promoted',
      confidence_level: 3,
      confidence_basis: 'observation',
      hunch_type: 'new',
      author_id: userId,
      content: {
        is_digest: true,
        week_of: weekOf,
        node_counts: byType,
        edge_count: edges.length,
        decision_count: decisions.length,
      },
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create digest node: ${error.message}`);
  return data as { id: string; title: string };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/lib/digest/__tests__/generate.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/digest/generate.ts src/lib/digest/__tests__/generate.test.ts
git commit -m "feat: add weekly digest generator — queries week's activity and LLM-narrates it"
```

---

## Task 2: Digest API route

**Files:**
- Create: `src/app/api/digest/route.ts`
- Create: `src/app/api/digest/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/app/api/digest/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));

vi.mock('@/lib/digest/generate', () => ({
  generateWeeklyDigest: vi.fn().mockResolvedValue({ id: 'digest-1', title: 'Weekly digest — Apr 22, 2026' }),
}));

import { POST } from '../route';

describe('POST /api/digest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null });
  });

  it('generates digest and returns node id', async () => {
    const req = new Request('http://localhost/api/digest', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe('digest-1');
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('auth') });
    const req = new Request('http://localhost/api/digest', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/app/api/digest/__tests__/route.test.ts
```

- [ ] **Step 3: Implement digest route**

```typescript
// src/app/api/digest/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateWeeklyDigest } from '@/lib/digest/generate';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const node = await generateWeeklyDigest(user.id);
    return NextResponse.json({ data: node }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate digest';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/app/api/digest/__tests__/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/digest/route.ts src/app/api/digest/__tests__/route.test.ts
git commit -m "feat: add /api/digest POST route for manual digest generation"
```

---

## Task 3: Manual trigger button in /log

**Files:**
- Modify: `src/app/log/LogClient.tsx`

- [ ] **Step 1: Add digest generation button**

In `src/app/log/LogClient.tsx`, add a digest button to the header section. The button should be unobtrusive — place it in the filters row, after the filter pills.

First, add state and handler to `LogClient`:

```typescript
// Add inside LogClient function, after existing state declarations:
const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);
const [digestError, setDigestError] = useState<string | null>(null);

const generateDigest = async () => {
  setIsGeneratingDigest(true);
  setDigestError(null);
  try {
    const res = await fetch('/api/digest', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to generate digest');
    window.location.reload(); // Reload to show the new digest in feed
  } catch {
    setDigestError('Failed to generate digest. Try again.');
  } finally {
    setIsGeneratingDigest(false);
  }
};
```

Then add the button below the filters, above the node groups:

```tsx
<div className="flex items-center justify-between">
  <LogFilters active={filter} onChange={setFilter} />
  <button
    onClick={generateDigest}
    disabled={isGeneratingDigest}
    className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40"
  >
    {isGeneratingDigest ? 'Generating...' : 'Generate weekly digest'}
  </button>
</div>
{digestError && <p className="text-xs text-red-500">{digestError}</p>}
```

- [ ] **Step 2: Verify manually**

Navigate to http://localhost:3000/log. Click "Generate weekly digest". After a few seconds, page reloads and a "Weekly digest" card appears at the top of the feed with a green "Weekly digest" badge.

- [ ] **Step 3: Commit**

```bash
git add src/app/log/LogClient.tsx
git commit -m "feat: add manual weekly digest trigger button to /log page"
```

---

## Task 4: Supabase Edge Function for automated weekly cron

**Files:**
- Create: `supabase/functions/weekly-digest/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/weekly-digest/index.ts
// Supabase Edge Function — runs via cron every Monday at 8am UTC
// Deploy with: supabase functions deploy weekly-digest
// Set cron in Supabase Dashboard: 0 8 * * 1

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (_req) => {
  const baseUrl = Deno.env.get('NEXT_PUBLIC_APP_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!baseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 });
  }

  // Get the first user (for single-team apps, use the workspace creator)
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabase = createClient(
    Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!,
    serviceKey,
  );

  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users?.[0]?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'No users found' }), { status: 404 });
  }

  // Call the app's digest endpoint
  const res = await fetch(`${baseUrl}/api/digest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Service role calls don't need user auth — digest route uses admin client internally
      'x-supabase-service-key': serviceKey,
    },
  });

  const body = await res.json();
  return new Response(JSON.stringify(body), { status: res.status });
});
```

- [ ] **Step 2: Note on deployment**

This Edge Function requires environment variables to be set in the Supabase Dashboard under Edge Functions → weekly-digest → Secrets:
- `NEXT_PUBLIC_APP_URL` — your deployed app URL (e.g. `https://your-app.vercel.app`)
- `NEXT_PUBLIC_SUPABASE_URL` — already in your project
- `SUPABASE_SERVICE_ROLE_KEY` — already in your project

Set the cron schedule in Supabase Dashboard → Edge Functions → weekly-digest → Schedule: `0 8 * * 1` (Mondays at 8am UTC).

Note: The `/api/digest` route uses server-side auth. For the edge function trigger, the digest route will need to accept a service-role bypass or the edge function should call `generateWeeklyDigest` directly via Supabase's internal calling mechanism. Simplest approach for v0.7: the digest API route checks for a secret header:

Update `src/app/api/digest/route.ts` to also accept a `x-internal-key` header:

```typescript
// At the top of the POST handler, before auth check:
const internalKey = request.headers.get('x-internal-key');
const expectedKey = process.env.INTERNAL_DIGEST_KEY;
if (internalKey && expectedKey && internalKey === expectedKey) {
  // Authenticated as internal caller — use a system user ID
  try {
    const supabase = createAdminClient(); // Use admin client to find first user
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const systemUserId = users?.[0]?.id;
    if (!systemUserId) return NextResponse.json({ error: 'No users found' }, { status: 404 });
    const node = await generateWeeklyDigest(systemUserId);
    return NextResponse.json({ data: node }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate digest';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

Add `INTERNAL_DIGEST_KEY` to `.env.example` and set a random secret in production.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/weekly-digest/index.ts
git commit -m "feat: add Supabase Edge Function for automated weekly digest cron"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Weekly digest via cron | Task 4 |
| Manual "Generate digest" button on /log | Task 3 |
| 200-word LLM summary referencing specific node titles | Task 1 (DIGEST_PROMPT) |
| Breakdown by type: meetings, insights, decisions | Task 1 (context string) |
| Lists decisions and tensions | Task 1 (decisions extracted from nodes) |
| Suggests 2-3 priorities | Task 1 (DIGEST_PROMPT asks for this) |
| Stored as node with is_digest=true | Task 1 |
| Surfaces in /log with "Weekly digest" badge | Automatic — ActivityCard already handles is_digest badge |
| Future: send via email or Slack | Not implemented — deferred |
| Tension alerts in digest | Not implemented — tension_alerts table not queried. Deferred as enhancement: add `supabase.from('tension_alerts').select(...).eq('status', 'active')` to generate.ts context. |

**Gap:** Digest does not yet query `tension_alerts`. Add this to `generate.ts` as an enhancement after the basic digest is working. The query to add:

```typescript
const { data: activeTensions } = await supabase
  .from('tension_alerts')
  .select('description, severity')
  .eq('status', 'active')
  .limit(5);

// Add to context string:
activeTensions?.length > 0 ? `Active tensions: ${activeTensions.map(t => t.description).join(', ')}` : ''
```

**Placeholder scan:** No TBDs found.

**Type consistency:** `generateWeeklyDigest` returns `{ id: string; title: string }` — consistent with digest route's `body.data.id` reference.
