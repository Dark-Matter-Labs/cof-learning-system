# COF Learning System — Design Specification

## Overview

A web application serving as a visual operating system for the Civilization Options Fund (COF). It captures hunches and structured thinking, processes them through LLM extraction, enables human review and validation, and visualizes the resulting knowledge graph.

**Core users:** Indy (founder/prolific thinker), Robyn (operations lead), Gurden (technical), eventually Malik and partners.

**This is a thinking environment, not a productivity app.** No gamification, no streaks, no KPI dashboards.

## Design Principles

1. **Conscious capture** — every entry is intentional, not automated ingestion
2. **Visual interface is the winning/losing framework** — clean, minimal, precise
3. **Human validation is steering, not gating** — adjust, reclassify, draw connections, set confidence
4. **Model interchangeability** — all LLM calls through abstraction layer, swappable without refactoring
5. **Taxonomy is evolving** — node/edge types configurable via data, no migrations
6. **Author attribution always visible** — provenance of ideas never hidden
7. **Speed kills friction** — capture < 60s, review < 2min

## Tech Stack

- **Framework:** Next.js 14+ (App Router) with TypeScript
- **Hosting:** Vercel (Pro account, 60s function timeout)
- **Database:** Supabase (Postgres + Auth + Storage + Realtime)
- **Auth:** Supabase Auth with Google OAuth, email whitelist (invite-only)
- **LLM:** Anthropic API through abstraction layer (`lib/llm.ts`)
- **Graph:** D3.js force-directed layout
- **Styling:** Tailwind CSS with Inter + JetBrains Mono fonts

## Architecture

### System Layers

1. **Browser** — Next.js App Router with 5 views: Dashboard, Capture, Graph, Review, Settings
2. **API** — Vercel serverless routes: `/api/capture`, `/api/capture/process`, `/api/graph/*`, `/api/review`
3. **LLM** — Abstraction layer in `lib/llm.ts` with named agent slots (extraction, review, create)
4. **Data** — Supabase Postgres with Realtime subscriptions for live status updates

### LLM Abstraction Layer

All LLM calls go through `lib/llm.ts`. Two agent slots for v1:

- **extraction** — processes new hunches, defaults to Claude Sonnet 4
- **review** — evaluates against risk model (v2, deferred)

Each slot has independent provider/model/key configuration via environment variables. Anthropic provider implemented for v1, others stubbed.

### Processing Pipeline

1. User submits hunch via Capture Form
2. `/api/capture` saves node with `status='raw'` to Supabase, returns immediately
3. `/api/capture/process` called fire-and-forget, sets `status='processing'`
4. LLM extraction agent runs, writes `llm_extraction` JSONB, sets `status='llm_reviewed'`
5. Supabase Realtime pushes status change to UI

No external job queue — Vercel Pro 60s timeout sufficient for LLM calls.

## Data Model

### Tables

**node_types** — Configurable taxonomy. Adding a new node type = one INSERT, zero migrations.
- Fields: id (TEXT PK), label, description, color, icon, sort_order, is_active

**edge_types** — Configurable relationship vocabulary.
- Fields: id (TEXT PK), label, description, is_directional

**nodes** — Single table for all entity types (hunches, assumptions, tests, learnings, people, orgs, sites).
- Core: id (UUID), node_type (FK), title, description
- Flexible content: `content` JSONB with type-specific structure
- Hunch-specific: hunch_type, confidence_level, confidence_basis
- Processing: status (raw → processing → llm_reviewed → human_reviewed → promoted | archived | falsified | suspended)
- LLM pipeline: llm_extraction JSONB, llm_review JSONB, human_review JSONB (separate columns = full audit trail)
- Provenance: author_id, parent_node_id (self-referential for hunch chains)
- Tagging: domain_tags TEXT[], external_links JSONB

**edges** — Connects any two nodes with typed relationships.
- Fields: source_id, target_id, edge_type (FK), weight, description, author_id
- UNIQUE(source_id, target_id, edge_type)

**activity_log** — Powers dashboard and weekly review ritual.
- Fields: actor_id, action, target_node_id, details JSONB

**assets** — v2 (Create Mode output), deferred.

### Initial Taxonomy

Node types: hunch, assumption_background, assumption_foreground, test, learning, option, person, organisation, site

Edge types: supports, contradicts, requires, evolved_from, tested_by, produced, connected_to, works_at, authored_by, challenges

### Security

- RLS enabled on all tables with permissive policies for authenticated users
- Email whitelist for access control (no roles for v1)
- All LLM API keys server-side only

### Indexes

- nodes: node_type, status, author_id, domain_tags (GIN)
- edges: source_id, target_id
- activity_log: created_at DESC

### Realtime

Enabled on: nodes, edges, activity_log

## UI Flows

### 1. Hunch Capture (< 60 seconds)

**Quick entry (required):** title, description textarea, hunch type dropdown (new/feedback/test_result/external_validation), confidence dots (1-5)

**Optional extras:** file upload (PDF, audio, image) to Supabase Storage, external link (URL + label)

**Submit:** saves node, fires extraction agent, redirects to list or shows processing indicator.

### 2. Human Review (the critical interface)

**Left panel — LLM extraction as editable fields:**
- Each extracted field (structured claim, assumption type, domain tags, entities, confidence) shown with accept (green) / edit (pencil) / reject (red) buttons
- Confidence slider: AI suggestion shown alongside human override
- Domain tags: accept/remove suggested tags, add new ones

**Right panel — connections and actions:**
- Suggested connections: accept/reject each, draw new connections
- Primary action: "Promote to Graph"
- Secondary: Save as Draft, Archive

**Status writes:** human_review JSONB records what was accepted/rejected/edited per field.

### 3. Graph Canvas

- D3 force-directed layout, nodes colored by type from node_types table
- Filter bar: toggle node types, dropdown filters for domain and author
- Click node → detail panel slides in from right (type badge, title, description, domain tags, connections, author)
- Directional arrows on edges
- Zoom/pan
- Legend

### 4. Dashboard

- Top nav: COF logo, 5 sections, review badge count, user avatar
- Status cards: awaiting review (count + breakdown), promoted this week (with author distribution), active tests (with site labels)
- Recent activity feed

### 5. Weekly Review Ritual

Surfaces: nodes awaiting promotion, stale hunches, assumption challenges, diverging chains. Designed for 30-min team session.

### 6. Settings

Manage: taxonomy (node types, edge types), agent configurations, external integrations (v2).

## Application Structure

```
src/
  app/
    layout.tsx                    # Root layout with auth + Supabase provider
    page.tsx                      # Dashboard
    capture/
      page.tsx                    # Capture form + hunch list
      [id]/page.tsx               # Single hunch view
      [id]/review/page.tsx        # Human review interface
    graph/
      page.tsx                    # Interactive knowledge graph
      node/[id]/page.tsx          # Node detail view
    review/page.tsx               # Weekly review ritual
    settings/page.tsx             # Taxonomy + config management
    api/
      capture/route.ts            # File upload + storage
      capture/process/route.ts    # LLM extraction pipeline
      review/route.ts             # LLM review agent (v2)
      graph/nodes/route.ts
      graph/edges/route.ts
      graph/query/route.ts
      llm/route.ts                # LLM proxy
  lib/
    llm.ts                        # LLM abstraction layer
    supabase/
      client.ts                   # Browser client
      server.ts                   # Server client
      types.ts                    # Generated types
    agents/
      extraction.ts               # Extraction agent prompt + parsing
      review.ts                   # Review agent (v2)
    graph/
      layout.ts                   # D3 force config
      queries.ts                  # Graph traversal helpers
    integrations/                 # v2: Folk CRM, Notion, Google Docs
  components/
    capture/
      QuickCaptureForm.tsx
      FileUpload.tsx
      ExternalLink.tsx
    review/
      ReviewCard.tsx              # The most important component
      WeeklyReview.tsx
    graph/
      GraphCanvas.tsx
      NodeCard.tsx
      FilterBar.tsx
      ChainView.tsx
    shared/
      NodeTypeBadge.tsx
      ConfidenceIndicator.tsx
      AuthorAvatar.tsx
      StatusBadge.tsx
```

## Design Tokens

```
Node type colors:
  hunch:            #7F77DD
  assumption_bg:    #1D9E75
  assumption_fg:    #D85A30
  test:             #D4537E
  learning:         #378ADD
  option:           #BA7517
  entity:           #888780
  site:             #639922

Fonts:
  sans: Inter, system-ui, sans-serif
  mono: JetBrains Mono, monospace
```

## LLM Agent Prompts

### Extraction Agent

Runs on every new hunch. Extracts: title, summary, structured claim (if/then/because), assumption type, entities, domain tags, suggested connections, confidence assessment, open questions. Returns JSON. All outputs are suggestions for human review.

### Review Agent (v2)

Evaluates hunches against COF's configurable risk model. Assesses: risk model fit, strategic relevance, assumption challenges, priority, cross-references. Deferred to v2.

## V1 Build Order (7-day sandbox)

1. **Scaffold + Auth** — Next.js project, Supabase setup, schema, Google OAuth, deploy to Vercel
2. **Capture Form + Storage** — QuickCaptureForm, file upload, external links, save to nodes
3. **LLM Processing** — lib/llm.ts abstraction, extraction agent, processing status
4. **Review Interface** — ReviewCard with per-field accept/reject/edit, confidence override, suggested connections, promote action
5. **Graph Visualization** — D3 force layout, node type colors, click-to-expand, filter bar
6. **Dashboard + Review Ritual** — Status cards, activity feed, weekly review surfaces
7. **Polish + Demo** — Mobile responsiveness, loading/error/empty states, demo recording

## Explicitly Deferred (v2+)

- Folk CRM / Notion / Google Docs API integrations
- Create Mode / asset generation
- Audio transcription
- Review agent with risk model
- Author diversity metrics
- Multi-agent review pipeline
- Public-facing views
- Self-hosted model support
- Beautiful graph design (when Martin joins)
