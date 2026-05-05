# Field Intelligence Newsletter — Design Spec

## Overview

A generation UI at `/newsletter` that produces plain-text newsletters from the knowledge graph. Two formats, each sent on a 6-weekly cadence. User generates, copies, and sends manually — no email infrastructure.

---

## Formats

### Mission Pathways
**Audience:** Internal team — sent a few days before every second tri-weekly meeting.
**Purpose:** Status brief on live hunches + agenda-setting when something important needs discussion.

**Content selection (last 6 weeks):**
- Hunches by lifecycle stage — counts per stage, any that moved stages recently
- Active commitments and any completed in the window
- Tests with new signals received
- Any hunch stuck 30+ days in the same stage — flagged as a potential agenda item

**Tone:** Concise, factual, internal. Brief enough to read in 2 minutes.

---

### Close Contacts
**Audience:** People in the field — external contacts doing related work.
**Purpose:** Sharing learnings and findings outward.

**Content selection (last 6 weeks):**
- Learning nodes created in the window
- Test nodes linked to signal nodes created within the window
- Hunches that reached `coherence` or `holding` stage

**Tone:** Sharing, reflective, slightly warmer. Written as if from a colleague updating their network.

---

## Data Model

```sql
CREATE TABLE newsletters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL CHECK (type IN ('mission_pathways', 'close_contacts')),
  content    TEXT NOT NULL,
  author_id  UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

RLS: users can only read/insert their own rows.

---

## Content Selection Logic

Both formats look back exactly 6 weeks from NOW().

### selectMissionPathwaysNodes(userId)
Queries:
1. All hunch nodes — group by lifecycle_stage for counts; filter `updated_at > 6_weeks_ago` for recently moved
2. Commitments where `status = 'active'` OR `(status = 'complete' AND updated_at > 6_weeks_ago)`
3. Test nodes with at least one signal edge where `updated_at > 6_weeks_ago`
4. Hunches where `stage_transitioned_at < 30_days_ago AND lifecycle_stage NOT IN ('holding','archived')` — stuck flag

Returns a structured object the LLM prompt can consume directly.

### selectCloseContactsNodes(userId)
Queries:
1. Nodes of type `learning` where `created_at > 6_weeks_ago`
2. Test nodes linked (via edges) to signal nodes where `created_at > 6_weeks_ago`
3. Hunch nodes where `lifecycle_stage IN ('coherence','holding')` and `updated_at > 6_weeks_ago`

Returns a structured object for the LLM prompt.

---

## LLM Agent

**Agent name:** `'newsletter'` — registered in `src/lib/llm/index.ts` using `claude-sonnet-4-6`.

Two system prompts, one per format:

### Mission Pathways prompt
```
You are writing a plain-text field intelligence brief for an internal team meeting.
Write in a concise, factual style. No bullet overload — use short paragraphs.
Structure: Opening status line → Hunch movement → Active commitments → Tests with signals → [Optional] Agenda flag if anything is stuck or needs decision.
Do not include headers or markdown. Plain text only.
Length: 200–350 words.
```

### Close Contacts prompt
```
You are writing a plain-text field update for colleagues doing related work in the field.
Write as one practitioner sharing with another — warm, honest, reflective.
Structure: What we've been learning → What tested out → Where our thinking has landed.
Do not include headers or markdown. Plain text only.
Length: 250–400 words.
```

---

## API Routes

### `GET /api/newsletters?type=mission_pathways`
Returns the user's past newsletters of that type, ordered by `created_at DESC`.

### `POST /api/newsletters`
Body: `{ type: 'mission_pathways' | 'close_contacts' }`

1. Validate auth + body
2. Run the appropriate `select*Nodes()` function
3. Build LLM user message from selected nodes
4. Call `callLLM('newsletter', { systemPrompt, userMessage, maxTokens: 800 })`
5. Insert row into `newsletters` table
6. Return `{ id, content, created_at }`

---

## UI

### `/newsletter` — server page
Auth guard → renders `<NewsletterTabs />`.

### `NewsletterTabs` — client component
Two tabs: **Mission Pathways** | **Close Contacts**

Per tab:
- **Generate button** — POST to `/api/newsletters`, shows loading state during generation
- **Output area** — `<textarea>` (read-only, selectable), full-width, appears after generation with current content pre-filled
- **History list** — past newsletters, most recent first. Each row: formatted date + first 80 chars preview. Click expands to show full text inline.

State:
```typescript
const [activeTab, setActiveTab] = useState<'mission_pathways' | 'close_contacts'>('mission_pathways')
const [generating, setGenerating] = useState(false)
const [currentOutput, setCurrentOutput] = useState<string | null>(null)
const [history, setHistory] = useState<Newsletter[]>([])
```

On tab switch: load history for that type, clear currentOutput.
On generate: set currentOutput from response, prepend to history list.

---

## Navigation

Restore Capture to the nav (it was removed in v0.9 — add it back).
Add Newsletter alongside Portfolios.

Desktop nav order: Graph → Portfolios → Newsletter → Commitments → Reflect → Query → Review → Capture → Settings

Mobile nav: same additions.

---

## File Structure

| Action | Path |
|--------|------|
| Create | `supabase/v0.9-newsletters.sql` |
| Create | `src/lib/newsletter/select.ts` |
| Create | `src/lib/newsletter/agents.ts` |
| Create | `src/lib/newsletter/__tests__/select.test.ts` |
| Create | `src/app/api/newsletters/route.ts` |
| Create | `src/components/newsletter/NewsletterTabs.tsx` |
| Create | `src/app/newsletter/page.tsx` |
| Modify | `src/lib/llm/index.ts` (add newsletter agent) |
| Modify | `src/components/layout/NavBar.tsx` |
| Modify | `src/components/layout/MobileNav.tsx` |

---

## Testing

- Unit tests for `selectMissionPathwaysNodes` and `selectCloseContactsNodes` — mock Supabase, assert correct node types and date filters
- Unit tests for `NewsletterTabs` — tab switching, generate button state, history rendering
- API route tests — auth guard, invalid type rejection, successful generation mock
