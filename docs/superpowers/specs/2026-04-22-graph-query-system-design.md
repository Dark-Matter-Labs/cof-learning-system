# Graph Query System Design

## Overview

A `/query` page that lets team members with different backgrounds interrogate the knowledge graph in natural language. Two modes: **Ask** (iterative chat for targeted questions) and **Guided Tour** (LLM-narrated walkthrough for onboarding and orientation).

**Problem:** As the team grows beyond the founding core (Malik from finance, Michelle from learning), new members need ways to access the graph that match their mental models. The graph UI requires too much domain knowledge to cold-start. Existing LLM analysis APIs (/api/reflection/run, /api/reflect/analyse) are not surfaced as user-facing query tools.

**Users:**
- Core team (Gurden, Indy, Robyn) — targeted queries about specific nodes, assumptions, tests
- Malik Lakoubay (finance) — financial risk and commitment queries, e.g. "what are the financial aspects of our Madrid goal?"
- Michelle Zucker (learning) — orientation, "walk me through this"
- Future roles as team scales

All users are logged in. No external/public access in scope.

---

## Page & Navigation

New route: `/query`, added to the main nav alongside `/graph`, `/capture`, `/reflect`.

Two tabs at the top of the page: **Ask** and **Guided Tour**. Both tabs live on the same page — one destination for "I want to understand something." The graph stays on `/graph`; `/query` is a separate thinking tool.

Users naturally graduate: Michelle starts on Guided Tour, eventually moves to Ask.

---

## Ask Mode

### UX

A persistent chat thread supporting multiple Q&As in sequence. Layout:

- **Left/main column**: chat history — user questions and LLM answers displayed sequentially, with a text input pinned at the bottom
- **Right column (collapsible)**: "Referenced nodes" panel — shows node cards for all nodes cited in the current conversation, grouped by type. Collapses to an icon on narrow screens.

Each LLM answer may reference nodes inline (rendered as clickable chips that scroll the right panel to the relevant card). Node cards show: type badge, title, description snippet, link to open full detail panel.

Follow-up questions are supported — the LLM receives the full chat history as context, enabling drill-down ("which of those is most at risk?").

### Data flow

**New endpoint: `POST /api/query`**

Request:
```json
{
  "query": "What are the financial aspects of our Madrid goal?",
  "history": [{ "role": "user" | "assistant", "content": "..." }],
  "userId": "uuid"
}
```

Processing:
1. Keyword match against node `title` and `description` fields using Postgres `ILIKE '%term%'` (or `to_tsvector` full-text search if available) to find candidate nodes
2. BFS expansion one hop via `edges` to pull in connected context nodes
3. User profile lookup — fetch user's `name` and `background` field from `profiles` table
4. LLM call with:
   - System prompt: "You are a knowledge graph assistant for [org]. The user, [name], has a [background] background — frame answers accordingly."
   - Graph context: candidate nodes + edges as structured JSON
   - Full chat history
   - Current query
5. Stream response — text with node ID references marked as `[[node_id]]` tokens
6. Frontend parses tokens, resolves to node objects, renders inline chips and right-panel cards

Response: streaming text (SSE) + a `nodeIds` array in the final chunk.

### User role context

Each user has a `background` field in their profile (a short plain-text description, e.g. "finance and investment risk"). This field does not currently exist — implementation requires a migration to add `background text` to the `profiles` table (or equivalent auth metadata). It is set on the profile page — no separate role system. The LLM uses it only to frame language. If the field is empty, the system prompt omits the framing sentence entirely.

---

## Guided Tour Mode

### UX

A structured walkthrough of the current graph state, narrated by the LLM. Six chapters navigated via a left sidebar. Clicking Start generates all chapters in one LLM call; navigation between chapters is instant (client-side only after generation).

Each chapter:
- LLM-generated narrative paragraph at the top (2–4 sentences, plain English)
- Node cards below for the nodes referenced in that chapter
- "Next chapter" button at the bottom

**Chapters:**
1. **What is this system?** — fixed, human-written intro to the COF method and how the graph works. Does not change between generations.
2. **Our goals** — each `goal_space` node described in plain language, with its `trigger_outcome` nodes.
3. **Key assumptions** — `assumption_background` and `assumption_foreground` nodes grouped by goal space, framed as "things we're betting on."
4. **What we're testing** — active `test` nodes with their current status and the question each is trying to answer.
5. **What we've learned** — `learning` nodes at `promoted` status, written as insights.
6. **Where attention is needed** — nodes at `llm_reviewed` status awaiting human review; flagged `signal` nodes.

### Data flow

**New endpoint: `POST /api/query/tour`**

Request:
```json
{ "userId": "uuid" }
```

Processing:
1. Fetch all nodes and edges from Supabase
2. Single LLM call with full graph + prompt asking for structured JSON output:
```json
{
  "chapters": [
    { "title": "Our goals", "narrative": "...", "nodeIds": ["uuid1", "uuid2"] }
  ]
}
```
3. Chapter 1 ("What is this system?") is prepended client-side from a static string — not LLM-generated.

Response: JSON (non-streaming). Generation typically takes 5–10 seconds.

**Loading state:** skeleton placeholder per chapter section, revealed as JSON arrives. After generation, results are cached in component state for the session — navigating chapters makes no further API calls.

---

## Error Handling

| Scenario | Ask mode | Guided Tour |
|---|---|---|
| Empty graph (no nodes) | "I don't have enough data to answer that yet." | "Nothing here yet — start by capturing some thoughts." (static) |
| LLM timeout | Inline retry button in the chat thread | Error state on Start screen with Retry button |
| No relevant nodes found | Answer still generates; right panel hidden | N/A — tour uses full graph |
| Tour generation >5s | N/A | Loading skeleton per chapter |

---

## Out of Scope

- External / unauthenticated access
- Email or Slack delivery
- Saved query history (queries are session-only for now)
- Explicit role system (beyond free-text background field)
- Semantic / vector search (keyword BFS is sufficient for v1)
