# COF Learning System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a v1 sandbox of the COF Learning System — hunch capture, LLM extraction, human review, and graph visualization for the Civilization Options Fund.

**Architecture:** Next.js 14+ App Router with Supabase (Postgres + Auth + Storage + Realtime) on Vercel Pro. LLM calls routed through a provider-agnostic abstraction layer. D3.js force-directed graph for visualization.

**Tech Stack:** Next.js 14+, TypeScript, Supabase, Tailwind CSS, D3.js, Anthropic SDK, Vercel

**Spec:** `docs/superpowers/specs/2026-03-20-cof-learning-system-design.md`

---

## File Map

### Infrastructure
- `package.json` — dependencies
- `tsconfig.json` — TypeScript config
- `tailwind.config.ts` — design tokens (node type colors, fonts)
- `next.config.ts` — Next.js config
- `.env.local` — environment variables (not committed)
- `.env.example` — env var template
- `supabase/schema.sql` — full database schema
- `supabase/seed.sql` — taxonomy seed data
- `src/middleware.ts` — auth middleware (redirect unauthenticated users)

### Supabase Clients
- `src/lib/supabase/client.ts` — browser-side Supabase client
- `src/lib/supabase/server.ts` — server-side Supabase client (cookies)
- `src/lib/supabase/types.ts` — generated database types

### Domain Types
- `src/lib/types/nodes.ts` — Node, LlmExtraction, HumanReview interfaces
- `src/lib/types/edges.ts` — Edge, EdgeType interfaces
- `src/lib/types/activity.ts` — ActivityLog interface

### LLM Layer
- `src/lib/llm/index.ts` — LLM abstraction layer (callLLM, provider routing)
- `src/lib/llm/providers/anthropic.ts` — Anthropic provider implementation
- `src/lib/llm/providers/stub.ts` — Stub provider for testing
- `src/lib/agents/extraction.ts` — extraction agent prompt + response parsing
- `src/lib/agents/extraction.test.ts` — extraction agent tests

### API Routes
- `src/app/api/capture/route.ts` — POST: create node + upload file
- `src/app/api/capture/process/route.ts` — POST: run LLM extraction on a node
- `src/app/api/graph/nodes/route.ts` — GET: list nodes, POST: create node
- `src/app/api/graph/edges/route.ts` — GET: list edges, POST: create edge
- `src/app/api/auth/callback/route.ts` — Supabase OAuth callback handler

### Pages
- `src/app/layout.tsx` — root layout with auth provider, nav shell
- `src/app/page.tsx` — dashboard
- `src/app/capture/page.tsx` — capture form + hunch list
- `src/app/capture/[id]/page.tsx` — single hunch view
- `src/app/capture/[id]/review/page.tsx` — human review interface
- `src/app/graph/page.tsx` — interactive knowledge graph
- `src/app/graph/node/[id]/page.tsx` — node detail view
- `src/app/review/page.tsx` — weekly review ritual
- `src/app/settings/page.tsx` — taxonomy management
- `src/app/login/page.tsx` — login page

### Components
- `src/components/layout/NavBar.tsx` — top navigation with review badge
- `src/components/layout/AuthProvider.tsx` — Supabase auth context
- `src/components/capture/QuickCaptureForm.tsx` — structured capture form
- `src/components/capture/FileUpload.tsx` — drag-drop file upload
- `src/components/capture/ExternalLinkInput.tsx` — URL + label input
- `src/components/capture/HunchList.tsx` — list of captured hunches
- `src/components/capture/HunchCard.tsx` — single hunch card with status
- `src/components/review/ReviewCard.tsx` — THE critical component
- `src/components/review/ExtractionField.tsx` — single field with accept/edit/reject
- `src/components/review/ConfidenceSlider.tsx` — AI vs human confidence
- `src/components/review/ConnectionSuggestion.tsx` — accept/reject connection
- `src/components/review/DomainTagEditor.tsx` — tag management
- `src/components/review/WeeklyReview.tsx` — weekly review surfaces
- `src/components/graph/GraphCanvas.tsx` — D3 force-directed graph
- `src/components/graph/NodeDetailPanel.tsx` — slide-in node detail
- `src/components/graph/FilterBar.tsx` — type/domain/author filters
- `src/components/shared/NodeTypeBadge.tsx` — colored type badge
- `src/components/shared/ConfidenceIndicator.tsx` — confidence dots
- `src/components/shared/AuthorAvatar.tsx` — author display
- `src/components/shared/StatusBadge.tsx` — status pill
- `src/components/shared/EmptyState.tsx` — reusable empty state

### Graph Utilities
- `src/lib/graph/layout.ts` — D3 force layout config
- `src/lib/graph/queries.ts` — graph traversal helpers

---

## Task 1: Project Scaffold + Tailwind Config

**Files:**
- Create: `package.json`, `tailwind.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Create Next.js project**

```bash
cd /Users/gurden/Documents/code/cof-learning-system
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack
```

Select defaults when prompted. This creates the full Next.js scaffold.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk d3 uuid
npm install -D @types/d3 @types/uuid vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Tailwind with design tokens**

Replace `tailwind.config.ts` content:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'node-hunch': '#7F77DD',
        'node-assumption-bg': '#1D9E75',
        'node-assumption-fg': '#D85A30',
        'node-test': '#D4537E',
        'node-learning': '#378ADD',
        'node-option': '#BA7517',
        'node-entity': '#888780',
        'node-site': '#639922',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Create .env.example**

Create `.env.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LLM - Extraction Agent
EXTRACTION_LLM_PROVIDER=anthropic
EXTRACTION_LLM_MODEL=claude-sonnet-4-20250514
ANTHROPIC_API_KEY=

# LLM - Review Agent
REVIEW_LLM_PROVIDER=anthropic
REVIEW_LLM_MODEL=claude-sonnet-4-20250514

# LLM - Create Agent (v2)
CREATE_LLM_PROVIDER=anthropic
CREATE_LLM_MODEL=claude-opus-4-20250514

# Allowed emails (comma-separated)
ALLOWED_EMAILS=
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Create `src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

Add to `package.json` scripts:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 6: Update .gitignore**

Append to `.gitignore`:

```
.env.local
.env*.local
.superpowers/
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: successful build with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind design tokens and Vitest"
```

---

## Task 2: Database Schema + Supabase Types

**Files:**
- Create: `supabase/schema.sql`, `supabase/seed.sql`
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
- Create: `src/lib/types/nodes.ts`, `src/lib/types/edges.ts`, `src/lib/types/activity.ts`

- [ ] **Step 1: Create database schema file**

Create `supabase/schema.sql`:

```sql
-- Configurable taxonomy
CREATE TABLE node_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE edge_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  is_directional BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core nodes table
CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT NOT NULL REFERENCES node_types(id),
  title TEXT NOT NULL,
  description TEXT,
  content JSONB DEFAULT NULL,
  hunch_type TEXT CHECK (hunch_type IN ('new', 'feedback', 'test_result', 'external_validation')),
  confidence_level INT CHECK (confidence_level BETWEEN 1 AND 5),
  confidence_basis TEXT CHECK (confidence_basis IN ('intuition', 'analogy', 'observation', 'early_evidence', 'strong_evidence')),
  status TEXT DEFAULT 'raw' CHECK (status IN ('raw', 'processing', 'llm_reviewed', 'human_reviewed', 'promoted', 'error', 'archived', 'falsified', 'suspended')),
  llm_extraction JSONB,
  llm_review JSONB,
  human_review JSONB,
  author_id UUID REFERENCES auth.users(id),
  parent_node_id UUID REFERENCES nodes(id),
  domain_tags TEXT[] DEFAULT '{}',
  external_links JSONB DEFAULT '[]',
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edges between nodes
CREATE TABLE edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL REFERENCES edge_types(id),
  weight FLOAT DEFAULT 1.0,
  description TEXT,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, edge_type)
);

-- Assets (v2)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  medium TEXT NOT NULL,
  content TEXT,
  source_node_ids UUID[] DEFAULT '{}',
  llm_annotations JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'human_reviewed', 'published')),
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_node_id UUID REFERENCES nodes(id),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_nodes_type ON nodes(node_type);
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_author ON nodes(author_id);
CREATE INDEX idx_nodes_domain_tags ON nodes USING GIN(domain_tags);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);

-- RLS policies (permissive for authenticated users)
ALTER TABLE node_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read node_types" ON node_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage node_types" ON node_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read edge_types" ON edge_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage edge_types" ON edge_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read nodes" ON nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage nodes" ON nodes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read edges" ON edges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage edges" ON edges FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read assets" ON assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage assets" ON assets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read activity_log" ON activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage activity_log" ON activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE edges;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nodes_updated_at
  BEFORE UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2: Create seed data**

Create `supabase/seed.sql`:

```sql
INSERT INTO node_types (id, label, description, color, sort_order) VALUES
  ('hunch', 'Hunch', 'A directional belief about how the world works', '#7F77DD', 1),
  ('assumption_background', 'Background Assumption', 'Contextual given — not directly testable, but challengeable', '#1D9E75', 2),
  ('assumption_foreground', 'Foreground Assumption', 'Testable if/then proposition derived from a hunch', '#D85A30', 3),
  ('test', 'Test', 'A specific action to validate or challenge an assumption', '#D4537E', 4),
  ('learning', 'Learning', 'What was learned from a test — may spawn new hunches', '#378ADD', 5),
  ('option', 'Option', 'A COF investment option or strategic bet', '#BA7517', 6),
  ('person', 'Person', 'An individual in the network', '#888780', 7),
  ('organisation', 'Organisation', 'An organisation, fund, or institution', '#888780', 8),
  ('site', 'Site', 'A geographical site or context', '#639922', 9);

INSERT INTO edge_types (id, label, is_directional) VALUES
  ('supports', 'Supports', true),
  ('contradicts', 'Contradicts', true),
  ('requires', 'Requires', true),
  ('evolved_from', 'Evolved from', true),
  ('tested_by', 'Tested by', true),
  ('produced', 'Produced', true),
  ('connected_to', 'Connected to', false),
  ('works_at', 'Works at', true),
  ('authored_by', 'Authored by', true),
  ('challenges', 'Challenges', true);
```

- [ ] **Step 3: Create TypeScript domain types**

Create `src/lib/types/nodes.ts`:

```typescript
export interface NodeType {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly icon: string | null;
  readonly sort_order: number;
  readonly is_active: boolean;
  readonly created_at: string;
}

export interface LlmExtraction {
  readonly title: string;
  readonly summary: string;
  readonly structured_claim: {
    readonly if: string;
    readonly then: string;
    readonly because: string;
  } | null;
  readonly assumption_type: 'background' | 'foreground' | null;
  readonly entities: ReadonlyArray<{
    readonly name: string;
    readonly type: 'person' | 'organisation' | 'site' | 'concept';
  }>;
  readonly domain_tags: readonly string[];
  readonly suggested_connections: ReadonlyArray<{
    readonly target_title: string;
    readonly edge_type: string;
    readonly rationale: string;
  }>;
  readonly confidence_assessment: {
    readonly level: 1 | 2 | 3 | 4 | 5;
    readonly basis: 'intuition' | 'analogy' | 'observation' | 'early_evidence' | 'strong_evidence';
  };
  readonly open_questions: readonly string[];
}

export interface HumanReview {
  readonly reviewed_at: string;
  readonly reviewer_id: string;
  readonly fields: Readonly<Record<string, {
    readonly action: 'accepted' | 'rejected' | 'edited';
    readonly original: unknown;
    readonly final: unknown;
  }>>;
  readonly connections_accepted: ReadonlyArray<{
    readonly target_node_id: string;
    readonly edge_type: string;
  }>;
  readonly connections_rejected: readonly string[];
  readonly connections_added: ReadonlyArray<{
    readonly target_node_id: string;
    readonly edge_type: string;
  }>;
}

export interface ExternalLink {
  readonly url: string;
  readonly label: string;
  readonly added_at: string;
}

export interface Attachment {
  readonly storage_path: string;
  readonly filename: string;
  readonly mime_type: string;
  readonly size: number;
}

export type NodeStatus = 'raw' | 'processing' | 'llm_reviewed' | 'human_reviewed' | 'promoted' | 'error' | 'archived' | 'falsified' | 'suspended';
export type HunchType = 'new' | 'feedback' | 'test_result' | 'external_validation';
export type ConfidenceBasis = 'intuition' | 'analogy' | 'observation' | 'early_evidence' | 'strong_evidence';

export interface Node {
  readonly id: string;
  readonly node_type: string;
  readonly title: string;
  readonly description: string | null;
  readonly content: unknown | null;
  readonly hunch_type: HunchType | null;
  readonly confidence_level: number | null;
  readonly confidence_basis: ConfidenceBasis | null;
  readonly status: NodeStatus;
  readonly llm_extraction: LlmExtraction | null;
  readonly llm_review: unknown | null;
  readonly human_review: HumanReview | null;
  readonly author_id: string | null;
  readonly parent_node_id: string | null;
  readonly domain_tags: readonly string[];
  readonly external_links: readonly ExternalLink[];
  readonly attachments: readonly Attachment[];
  readonly created_at: string;
  readonly updated_at: string;
}
```

Create `src/lib/types/edges.ts`:

```typescript
export interface EdgeType {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
  readonly is_directional: boolean;
  readonly created_at: string;
}

export interface Edge {
  readonly id: string;
  readonly source_id: string;
  readonly target_id: string;
  readonly edge_type: string;
  readonly weight: number;
  readonly description: string | null;
  readonly author_id: string | null;
  readonly created_at: string;
}
```

Create `src/lib/types/activity.ts`:

```typescript
export type ActivityAction =
  | 'created_hunch'
  | 'reviewed'
  | 'promoted'
  | 'connected'
  | 'challenged'
  | 'archived'
  | 'created_asset';

export interface ActivityLogEntry {
  readonly id: string;
  readonly actor_id: string | null;
  readonly action: ActivityAction;
  readonly target_node_id: string | null;
  readonly details: Record<string, unknown>;
  readonly created_at: string;
}
```

- [ ] **Step 4: Create Supabase browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 5: Create Supabase server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add supabase/ src/lib/types/ src/lib/supabase/
git commit -m "feat: add database schema, seed data, domain types, and Supabase clients"
```

---

## Task 3: Auth + Middleware + Login Page

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/api/auth/callback/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/components/layout/AuthProvider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create auth callback route**

Create `src/app/api/auth/callback/route.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check email whitelist
      const { data: { user } } = await supabase.auth.getUser();
      const allowedEmails = (process.env.ALLOWED_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

      if (allowedEmails.length > 0 && user?.email && !allowedEmails.includes(user.email)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=unauthorized`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

- [ ] **Step 2: Create middleware for auth protection**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/api/auth')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 3: Create login page**

Create `src/app/login/page.tsx`:

```tsx
'use client';

import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="max-w-sm w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-wider">COF</h1>
          <p className="mt-2 text-sm text-gray-400">Civilization Options Fund Learning System</p>
        </div>

        {error === 'unauthorized' && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-400">
            Your email is not authorized to access this system.
          </div>
        )}

        {error === 'auth_failed' && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-400">
            Authentication failed. Please try again.
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 4: Create AuthProvider component**

Create `src/components/layout/AuthProvider.tsx`:

```tsx
'use client';

import { createClient } from '@/lib/supabase/client';
import { type User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface AuthContextValue {
  readonly user: User | null;
  readonly loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 5: Create NavBar component**

Create `src/components/layout/NavBar.tsx`:

```tsx
'use client';

import { useAuth } from './AuthProvider';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface NavBarProps {
  readonly reviewCount: number;
}

export function NavBar({ reviewCount }: NavBarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/capture', label: 'Capture' },
    { href: '/graph', label: 'Graph' },
    { href: '/review', label: 'Review' },
    { href: '/settings', label: 'Settings' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-950">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-sm font-bold text-gray-300 tracking-widest">
          COF
        </Link>
        <div className="flex gap-4">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-xs transition-colors ${
                isActive(link.href)
                  ? 'text-node-hunch border-b-2 border-node-hunch pb-1'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {reviewCount > 0 && (
          <Link
            href="/review"
            className="bg-node-assumption-fg text-white text-xs px-2.5 py-0.5 rounded-full"
          >
            {reviewCount} awaiting review
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-300 hover:bg-gray-700 transition-colors"
          title={user?.email ?? 'Sign out'}
        >
          {user?.email?.charAt(0).toUpperCase() ?? '?'}
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 6: Update root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { NavBar } from '@/components/layout/NavBar';
import { createClient } from '@/lib/supabase/server';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'COF Learning System',
  description: 'Visual operating system for the Civilization Options Fund',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get review count for nav badge
  let reviewCount = 0;
  if (user) {
    const { count } = await supabase
      .from('nodes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'llm_reviewed');
    reviewCount = count ?? 0;
  }

  const isLoginPage = false; // Will be determined by middleware

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-gray-950 text-gray-100`}>
        <AuthProvider initialUser={user}>
          {user && <NavBar reviewCount={reviewCount} />}
          <main className="min-h-[calc(100vh-49px)]">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create placeholder dashboard page**

Replace `src/app/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-49px)]">
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-300">COF Learning System</h1>
        <p className="mt-2 text-sm text-gray-500">Dashboard coming soon</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verify build**

```bash
npm run build
```

Expected: successful build (auth won't work until Supabase is configured, but the build should pass).

- [ ] **Step 9: Commit**

```bash
git add src/middleware.ts src/app/api/auth/ src/app/login/ src/components/layout/ src/app/layout.tsx src/app/page.tsx
git commit -m "feat: add auth middleware, login page, nav bar, and auth provider"
```

---

## Task 4: Capture Form + File Upload

**Files:**
- Create: `src/components/capture/QuickCaptureForm.tsx`
- Create: `src/components/capture/FileUpload.tsx`
- Create: `src/components/capture/ExternalLinkInput.tsx`
- Create: `src/components/capture/HunchCard.tsx`
- Create: `src/components/capture/HunchList.tsx`
- Create: `src/components/shared/NodeTypeBadge.tsx`
- Create: `src/components/shared/ConfidenceIndicator.tsx`
- Create: `src/components/shared/StatusBadge.tsx`
- Create: `src/components/shared/EmptyState.tsx`
- Create: `src/app/api/capture/route.ts`
- Create: `src/app/capture/page.tsx`

- [ ] **Step 1: Write test for QuickCaptureForm validation**

Create `src/components/capture/__tests__/QuickCaptureForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickCaptureForm } from '../QuickCaptureForm';

describe('QuickCaptureForm', () => {
  it('disables submit when title is empty', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} />);
    const submitButton = screen.getByRole('button', { name: /submit for processing/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit when title is provided', () => {
    render(<QuickCaptureForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Test hunch' } });
    const submitButton = screen.getByRole('button', { name: /submit for processing/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('calls onSubmit with form data', () => {
    const onSubmit = vi.fn();
    render(<QuickCaptureForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Test hunch' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A test description' } });
    fireEvent.click(screen.getByRole('button', { name: /submit for processing/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Test hunch',
      description: 'A test description',
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/capture/__tests__/QuickCaptureForm.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create shared components**

Create `src/components/shared/NodeTypeBadge.tsx`:

```tsx
const NODE_TYPE_COLORS: Record<string, string> = {
  hunch: 'bg-node-hunch',
  assumption_background: 'bg-node-assumption-bg',
  assumption_foreground: 'bg-node-assumption-fg',
  test: 'bg-node-test',
  learning: 'bg-node-learning',
  option: 'bg-node-option',
  person: 'bg-node-entity',
  organisation: 'bg-node-entity',
  site: 'bg-node-site',
};

interface NodeTypeBadgeProps {
  readonly nodeType: string;
  readonly label?: string;
}

export function NodeTypeBadge({ nodeType, label }: NodeTypeBadgeProps) {
  const colorClass = NODE_TYPE_COLORS[nodeType] ?? 'bg-gray-600';
  const displayLabel = label ?? nodeType.replace(/_/g, ' ');

  return (
    <span className={`${colorClass} text-white text-xs px-2 py-0.5 rounded-full capitalize`}>
      {displayLabel}
    </span>
  );
}
```

Create `src/components/shared/ConfidenceIndicator.tsx`:

```tsx
interface ConfidenceIndicatorProps {
  readonly level: number | null;
  readonly max?: number;
  readonly color?: string;
}

export function ConfidenceIndicator({ level, max = 5, color = 'bg-node-hunch' }: ConfidenceIndicatorProps) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full ${
            level !== null && i < level ? color : 'border border-gray-600'
          }`}
        />
      ))}
    </div>
  );
}
```

Create `src/components/shared/StatusBadge.tsx`:

```tsx
import type { NodeStatus } from '@/lib/types/nodes';

const STATUS_STYLES: Record<NodeStatus, string> = {
  raw: 'bg-gray-600 text-gray-200',
  processing: 'bg-node-option text-white',
  llm_reviewed: 'bg-node-test text-white',
  human_reviewed: 'bg-node-hunch text-white',
  promoted: 'bg-node-assumption-bg text-white',
  error: 'bg-red-600 text-white',
  archived: 'bg-gray-700 text-gray-300',
  falsified: 'bg-node-assumption-fg text-white',
  suspended: 'bg-node-option text-white',
};

interface StatusBadgeProps {
  readonly status: NodeStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`${STATUS_STYLES[status]} text-xs px-2 py-0.5 rounded-full`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
```

Create `src/components/shared/EmptyState.tsx`:

```tsx
import Link from 'next/link';

interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly actionHref?: string;
}

export function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-gray-300 font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 bg-node-hunch text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create QuickCaptureForm**

Create `src/components/capture/QuickCaptureForm.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import type { HunchType } from '@/lib/types/nodes';

export interface CaptureFormData {
  readonly title: string;
  readonly description: string;
  readonly hunch_type: HunchType;
  readonly confidence_level: number;
  readonly external_link_url?: string;
  readonly external_link_label?: string;
}

interface QuickCaptureFormProps {
  readonly onSubmit: (data: CaptureFormData) => void;
  readonly isSubmitting?: boolean;
}

const HUNCH_TYPES: { value: HunchType; label: string }[] = [
  { value: 'new', label: 'New hunch' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'test_result', label: 'Test result' },
  { value: 'external_validation', label: 'External validation' },
];

export function QuickCaptureForm({ onSubmit, isSubmitting = false }: QuickCaptureFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hunchType, setHunchType] = useState<HunchType>('new');
  const [confidence, setConfidence] = useState(3);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');

  const canSubmit = title.trim().length > 0 && !isSubmitting;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      hunch_type: hunchType,
      confidence_level: confidence,
      ...(linkUrl.trim() ? { external_link_url: linkUrl.trim(), external_link_label: linkLabel.trim() || linkUrl.trim() } : {}),
    });

    setTitle('');
    setDescription('');
    setHunchType('new');
    setConfidence(3);
    setLinkUrl('');
    setLinkLabel('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="What's the hunch?"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Context, reasoning, source..."
          rows={4}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch resize-none"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor="hunch-type" className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
            Type
          </label>
          <select
            id="hunch-type"
            value={hunchType}
            onChange={e => setHunchType(e.target.value as HunchType)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-node-hunch"
          >
            {HUNCH_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
            Confidence
          </label>
          <div className="flex gap-1.5 pt-1.5">
            {[1, 2, 3, 4, 5].map(level => (
              <button
                key={level}
                type="button"
                onClick={() => setConfidence(level)}
                className={`w-6 h-6 rounded-full transition-colors ${
                  level <= confidence ? 'bg-node-hunch' : 'border border-gray-600 hover:border-gray-500'
                }`}
                aria-label={`Confidence level ${level}`}
              />
            ))}
          </div>
        </div>
      </div>

      <details className="group">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
          + Add external link
        </summary>
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch"
          />
          <input
            type="text"
            value={linkLabel}
            onChange={e => setLinkLabel(e.target.value)}
            placeholder="Label"
            className="w-32 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-node-hunch"
          />
        </div>
      </details>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-node-assumption-bg text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Submitting...' : 'Submit for Processing'}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/components/capture/__tests__/QuickCaptureForm.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 6: Create capture API route**

Create `src/app/api/capture/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, hunch_type, confidence_level, external_link } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const externalLinks = external_link?.url
    ? [{ url: external_link.url, label: external_link.label || external_link.url, added_at: new Date().toISOString() }]
    : [];

  const { data: node, error } = await supabase
    .from('nodes')
    .insert({
      node_type: 'hunch',
      title: title.trim(),
      description: description?.trim() || null,
      hunch_type: hunch_type || 'new',
      confidence_level: confidence_level || 3,
      confidence_basis: 'intuition',
      status: 'raw',
      author_id: user.id,
      external_links: externalLinks,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await supabase.from('activity_log').insert({
    actor_id: user.id,
    action: 'created_hunch',
    target_node_id: node.id,
    details: { title: node.title, hunch_type: node.hunch_type },
  });

  // Fire-and-forget: trigger LLM extraction
  const processUrl = new URL('/api/capture/process', request.url);
  fetch(processUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({ node_id: node.id }),
  }).catch(() => {
    // Fire-and-forget — errors handled by the process route
  });

  return NextResponse.json({ data: node }, { status: 201 });
}
```

- [ ] **Step 7: Create HunchCard and HunchList**

Create `src/components/capture/HunchCard.tsx`:

```tsx
import type { Node } from '@/lib/types/nodes';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfidenceIndicator } from '@/components/shared/ConfidenceIndicator';
import Link from 'next/link';

interface HunchCardProps {
  readonly node: Node;
}

export function HunchCard({ node }: HunchCardProps) {
  const reviewLink = node.status === 'llm_reviewed'
    ? `/capture/${node.id}/review`
    : `/capture/${node.id}`;

  return (
    <Link
      href={reviewLink}
      className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-200 truncate">{node.title}</h3>
          {node.description && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-2">{node.description}</p>
          )}
        </div>
        <StatusBadge status={node.status} />
      </div>
      <div className="mt-3 flex items-center gap-4">
        <ConfidenceIndicator level={node.confidence_level} />
        <span className="text-xs text-gray-600">
          {new Date(node.created_at).toLocaleDateString()}
        </span>
      </div>
      {node.status === 'error' && node.llm_extraction && typeof node.llm_extraction === 'object' && 'error' in node.llm_extraction && (
        <div className="mt-2 text-xs text-red-400">
          Processing failed — click to retry
        </div>
      )}
    </Link>
  );
}
```

Create `src/components/capture/HunchList.tsx`:

```tsx
import type { Node } from '@/lib/types/nodes';
import { HunchCard } from './HunchCard';
import { EmptyState } from '@/components/shared/EmptyState';

interface HunchListProps {
  readonly nodes: readonly Node[];
}

export function HunchList({ nodes }: HunchListProps) {
  if (nodes.length === 0) {
    return (
      <EmptyState
        title="No hunches yet"
        description="Capture your first hunch to get started"
      />
    );
  }

  return (
    <div className="space-y-3">
      {nodes.map(node => (
        <HunchCard key={node.id} node={node} />
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Create capture page**

Create `src/app/capture/page.tsx`:

```tsx
'use client';

import { QuickCaptureForm, type CaptureFormData } from '@/components/capture/QuickCaptureForm';
import { HunchList } from '@/components/capture/HunchList';
import type { Node } from '@/lib/types/nodes';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function CapturePage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchNodes = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('nodes')
      .select('*')
      .eq('node_type', 'hunch')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNodes(data as unknown as Node[]);
  };

  useEffect(() => {
    fetchNodes();

    // Subscribe to realtime changes
    const supabase = createClient();
    const channel = supabase
      .channel('nodes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, () => {
        fetchNodes();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async (formData: CaptureFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          hunch_type: formData.hunch_type,
          confidence_level: formData.confidence_level,
          external_link: formData.external_link_url
            ? { url: formData.external_link_url, label: formData.external_link_label }
            : undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Failed to capture hunch');
      }

      await fetchNodes();
    } catch (error) {
      console.error('Capture failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-lg font-bold text-gray-200 mb-6">Capture a Hunch</h1>
      <QuickCaptureForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      <div className="mt-10">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Recent Hunches</h2>
        <HunchList nodes={nodes} />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Verify build**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 10: Commit**

```bash
git add src/components/capture/ src/components/shared/ src/app/api/capture/route.ts src/app/capture/
git commit -m "feat: add hunch capture form, API route, hunch list with realtime updates"
```

---

## Task 5: LLM Abstraction Layer + Extraction Agent

**Files:**
- Create: `src/lib/llm/index.ts`, `src/lib/llm/providers/anthropic.ts`, `src/lib/llm/providers/stub.ts`
- Create: `src/lib/agents/extraction.ts`, `src/lib/agents/extraction.test.ts`
- Create: `src/app/api/capture/process/route.ts`

- [ ] **Step 1: Write test for extraction agent response parsing**

Create `src/lib/agents/__tests__/extraction.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseExtractionResponse, buildExtractionPrompt } from '../extraction';

describe('extraction agent', () => {
  it('builds prompt with title and description', () => {
    const prompt = buildExtractionPrompt('Test title', 'Test description');
    expect(prompt).toContain('Test title');
    expect(prompt).toContain('Test description');
  });

  it('parses valid extraction JSON', () => {
    const validResponse = JSON.stringify({
      title: 'Extracted title',
      summary: 'A summary',
      structured_claim: { if: 'X', then: 'Y', because: 'Z' },
      assumption_type: 'foreground',
      entities: [{ name: 'Indy', type: 'person' }],
      domain_tags: ['capital_strategy'],
      suggested_connections: [],
      confidence_assessment: { level: 3, basis: 'observation' },
      open_questions: ['What about X?'],
    });

    const result = parseExtractionResponse(validResponse);
    expect(result.title).toBe('Extracted title');
    expect(result.entities).toHaveLength(1);
    expect(result.confidence_assessment.level).toBe(3);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseExtractionResponse('not json')).toThrow();
  });

  it('throws on missing required fields', () => {
    expect(() => parseExtractionResponse(JSON.stringify({ title: 'only title' }))).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/agents/__tests__/extraction.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create LLM abstraction layer**

Create `src/lib/llm/index.ts`:

```typescript
export interface LLMConfig {
  readonly provider: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
}

export interface LLMRequest {
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly usage?: { readonly input_tokens: number; readonly output_tokens: number };
}

type AgentName = 'extraction' | 'review' | 'create';

function getAgentConfig(agent: AgentName): LLMConfig {
  const prefix = agent.toUpperCase();
  return {
    provider: process.env[`${prefix}_LLM_PROVIDER`] ?? 'anthropic',
    model: process.env[`${prefix}_LLM_MODEL`] ?? 'claude-sonnet-4-20250514',
    apiKey: process.env[`${prefix}_LLM_API_KEY`] ?? process.env.ANTHROPIC_API_KEY,
    baseUrl: process.env[`${prefix}_LLM_BASE_URL`],
  };
}

export async function callLLM(agent: AgentName, request: LLMRequest): Promise<LLMResponse> {
  const config = getAgentConfig(agent);

  switch (config.provider) {
    case 'anthropic':
      const { callAnthropic } = await import('./providers/anthropic');
      return callAnthropic(config, request);
    default:
      const { callStub } = await import('./providers/stub');
      return callStub(config, request);
  }
}
```

Create `src/lib/llm/providers/anthropic.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { LLMConfig, LLMRequest, LLMResponse } from '../index';

export async function callAnthropic(config: LLMConfig, request: LLMRequest): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const message = await client.messages.create({
    model: config.model,
    max_tokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0.3,
    system: request.systemPrompt,
    messages: [{ role: 'user', content: request.userMessage }],
  });

  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Anthropic');
  }

  return {
    content: textBlock.text,
    model: message.model,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    },
  };
}
```

Create `src/lib/llm/providers/stub.ts`:

```typescript
import type { LLMConfig, LLMRequest, LLMResponse } from '../index';

export async function callStub(config: LLMConfig, _request: LLMRequest): Promise<LLMResponse> {
  return {
    content: JSON.stringify({
      title: 'Stub extraction',
      summary: 'This is a stub response for development.',
      structured_claim: null,
      assumption_type: null,
      entities: [],
      domain_tags: [],
      suggested_connections: [],
      confidence_assessment: { level: 3, basis: 'intuition' },
      open_questions: [],
    }),
    model: config.model,
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}
```

- [ ] **Step 4: Create extraction agent**

Create `src/lib/agents/extraction.ts`:

```typescript
import type { LlmExtraction } from '@/lib/types/nodes';
import { callLLM } from '@/lib/llm';

const SYSTEM_PROMPT = `You are an extraction system for the Civilization Options Fund (COF), a formation studio working at the intersection of civilisational risk, institutional design, and transition finance.

Given input text (which may be a rough note, call transcript, document excerpt, or transcribed audio), extract the following and return ONLY valid JSON with no other text:

{
  "title": "Concise title (max 10 words)",
  "summary": "2-3 sentence summary of the core insight or claim",
  "structured_claim": { "if": "condition", "then": "consequence", "because": "reasoning" } or null if no clear causal claim,
  "assumption_type": "background" or "foreground" or null,
  "entities": [{ "name": "...", "type": "person|organisation|site|concept" }],
  "domain_tags": ["dartmoor", "madrid", "copenhagen", "antarctica", "capital_strategy", "formation", "demand_architecture", "philanthropy", "natural_assets", "carbon", "water"],
  "suggested_connections": [{ "target_title": "existing concept name", "edge_type": "supports|contradicts|requires|challenges", "rationale": "why" }],
  "confidence_assessment": { "level": 1-5, "basis": "intuition|analogy|observation|early_evidence|strong_evidence" },
  "open_questions": ["question 1", "question 2"]
}

Mark uncertain extractions appropriately. All outputs are suggestions for human review.`;

export function buildExtractionPrompt(title: string, description: string): string {
  return `Title: ${title}\n\nDescription: ${description}`;
}

export function parseExtractionResponse(content: string): LlmExtraction {
  // Strip markdown code fences if present
  const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  const parsed = JSON.parse(cleaned);

  // Validate required fields
  const required = ['title', 'summary', 'entities', 'domain_tags', 'suggested_connections', 'confidence_assessment', 'open_questions'];
  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return parsed as LlmExtraction;
}

export async function runExtraction(title: string, description: string): Promise<LlmExtraction> {
  const response = await callLLM('extraction', {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: buildExtractionPrompt(title, description),
    maxTokens: 2048,
    temperature: 0.3,
  });

  return parseExtractionResponse(response.content);
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/lib/agents/__tests__/extraction.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Create process API route**

Create `src/app/api/capture/process/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { runExtraction } from '@/lib/agents/extraction';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { node_id } = await request.json();

  if (!node_id) {
    return NextResponse.json({ error: 'node_id is required' }, { status: 400 });
  }

  // Set status to processing
  await supabase
    .from('nodes')
    .update({ status: 'processing' })
    .eq('id', node_id);

  try {
    // Fetch the node
    const { data: node, error: fetchError } = await supabase
      .from('nodes')
      .select('title, description')
      .eq('id', node_id)
      .single();

    if (fetchError || !node) {
      throw new Error(`Node not found: ${node_id}`);
    }

    // Run extraction
    const extraction = await runExtraction(node.title, node.description ?? '');

    // Update node with extraction results
    await supabase
      .from('nodes')
      .update({
        llm_extraction: extraction,
        status: 'llm_reviewed',
      })
      .eq('id', node_id);

    // Log activity
    await supabase.from('activity_log').insert({
      actor_id: user.id,
      action: 'reviewed',
      target_node_id: node_id,
      details: { type: 'llm_extraction', model: 'extraction' },
    });

    return NextResponse.json({ data: { node_id, status: 'llm_reviewed' } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Set error status
    await supabase
      .from('nodes')
      .update({
        status: 'error',
        llm_extraction: { error: errorMessage, failed_at: new Date().toISOString() },
      })
      .eq('id', node_id);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 8: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/llm/ src/lib/agents/ src/app/api/capture/process/
git commit -m "feat: add LLM abstraction layer, extraction agent, and processing API route"
```

---

## Task 6: Review Interface

**Files:**
- Create: `src/components/review/ExtractionField.tsx`
- Create: `src/components/review/ConfidenceSlider.tsx`
- Create: `src/components/review/ConnectionSuggestion.tsx`
- Create: `src/components/review/DomainTagEditor.tsx`
- Create: `src/components/review/ReviewCard.tsx`
- Create: `src/app/capture/[id]/page.tsx`
- Create: `src/app/capture/[id]/review/page.tsx`

- [ ] **Step 1: Write test for ExtractionField**

Create `src/components/review/__tests__/ExtractionField.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExtractionField } from '../ExtractionField';

describe('ExtractionField', () => {
  it('renders field label and value', () => {
    render(
      <ExtractionField
        label="Summary"
        value="Test summary"
        onAction={vi.fn()}
      />
    );
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Test summary')).toBeInTheDocument();
  });

  it('calls onAction with accept', () => {
    const onAction = vi.fn();
    render(<ExtractionField label="Summary" value="Test" onAction={onAction} />);
    fireEvent.click(screen.getByLabelText('Accept'));
    expect(onAction).toHaveBeenCalledWith('accepted', 'Test');
  });

  it('calls onAction with reject', () => {
    const onAction = vi.fn();
    render(<ExtractionField label="Summary" value="Test" onAction={onAction} />);
    fireEvent.click(screen.getByLabelText('Reject'));
    expect(onAction).toHaveBeenCalledWith('rejected', 'Test');
  });

  it('enters edit mode and saves', () => {
    const onAction = vi.fn();
    render(<ExtractionField label="Summary" value="Original" onAction={onAction} />);
    fireEvent.click(screen.getByLabelText('Edit'));
    const input = screen.getByDisplayValue('Original');
    fireEvent.change(input, { target: { value: 'Edited' } });
    fireEvent.click(screen.getByLabelText('Save edit'));
    expect(onAction).toHaveBeenCalledWith('edited', 'Edited');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/review/__tests__/ExtractionField.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create ExtractionField component**

Create `src/components/review/ExtractionField.tsx`:

```tsx
'use client';

import { useState } from 'react';

type FieldAction = 'accepted' | 'rejected' | 'edited';

interface ExtractionFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onAction: (action: FieldAction, finalValue: string) => void;
  readonly currentAction?: FieldAction;
}

export function ExtractionField({ label, value, onAction, currentAction }: ExtractionFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSaveEdit = () => {
    setIsEditing(false);
    onAction('edited', editValue);
  };

  const borderColor = currentAction === 'accepted'
    ? 'border-l-green-500'
    : currentAction === 'rejected'
    ? 'border-l-red-500'
    : currentAction === 'edited'
    ? 'border-l-node-hunch'
    : 'border-l-gray-700';

  return (
    <div className={`bg-gray-900 rounded-lg p-3 border-l-4 ${borderColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
          {isEditing ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-node-hunch"
              />
              <button
                onClick={handleSaveEdit}
                className="bg-node-hunch text-white text-xs px-2 py-1 rounded"
                aria-label="Save edit"
              >
                Save
              </button>
              <button
                onClick={() => { setIsEditing(false); setEditValue(value); }}
                className="text-gray-500 text-xs px-2 py-1"
                aria-label="Cancel edit"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-300">{value}</div>
          )}
        </div>
        {!isEditing && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => onAction('accepted', value)}
              className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
                currentAction === 'accepted' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-green-400'
              }`}
              aria-label="Accept"
            >
              ✓
            </button>
            <button
              onClick={() => { setIsEditing(true); setEditValue(value); }}
              className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
                currentAction === 'edited' ? 'bg-node-hunch text-white' : 'bg-gray-800 text-gray-500 hover:text-node-hunch'
              }`}
              aria-label="Edit"
            >
              ✎
            </button>
            <button
              onClick={() => onAction('rejected', value)}
              className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
                currentAction === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-red-400'
              }`}
              aria-label="Reject"
            >
              ✗
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/review/__tests__/ExtractionField.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Create ConfidenceSlider**

Create `src/components/review/ConfidenceSlider.tsx`:

```tsx
'use client';

interface ConfidenceSliderProps {
  readonly aiLevel: number;
  readonly humanLevel: number;
  readonly onChange: (level: number) => void;
}

export function ConfidenceSlider({ aiLevel, humanLevel, onChange }: ConfidenceSliderProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 border-l-4 border-l-node-option">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Confidence</div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">AI:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(level => (
              <div
                key={level}
                className={`w-3 h-3 rounded-full ${
                  level <= aiLevel ? 'bg-node-option opacity-50' : 'border border-gray-600 opacity-50'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-200 font-medium">You:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(level => (
              <button
                key={level}
                onClick={() => onChange(level)}
                className={`w-4 h-4 rounded-full transition-colors ${
                  level <= humanLevel ? 'bg-node-option' : 'border border-gray-600 hover:border-gray-500'
                }`}
                aria-label={`Set confidence to ${level}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create DomainTagEditor**

Create `src/components/review/DomainTagEditor.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface DomainTagEditorProps {
  readonly tags: readonly string[];
  readonly onChange: (tags: readonly string[]) => void;
}

export function DomainTagEditor({ tags, onChange }: DomainTagEditorProps) {
  const [newTag, setNewTag] = useState('');

  const handleRemove = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const handleAdd = () => {
    const trimmed = newTag.trim().toLowerCase().replace(/\s+/g, '_');
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setNewTag('');
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-3 border-l-4 border-l-node-site">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Domain Tags</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 bg-node-site text-white text-xs px-2 py-0.5 rounded-full">
            {tag}
            <button
              onClick={() => handleRemove(tag)}
              className="hover:text-red-300 ml-0.5"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <div className="flex gap-1">
          <input
            type="text"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            placeholder="+ add"
            className="bg-transparent border border-dashed border-node-site rounded-full text-xs text-node-site px-2 py-0.5 w-20 focus:outline-none placeholder-node-site/50"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create ConnectionSuggestion**

Create `src/components/review/ConnectionSuggestion.tsx`:

```tsx
'use client';

interface ConnectionSuggestionProps {
  readonly targetTitle: string;
  readonly edgeType: string;
  readonly rationale: string;
  readonly status?: 'accepted' | 'rejected';
  readonly onAccept: () => void;
  readonly onReject: () => void;
}

export function ConnectionSuggestion({
  targetTitle,
  edgeType,
  rationale,
  status,
  onAccept,
  onReject,
}: ConnectionSuggestionProps) {
  return (
    <div className={`bg-gray-900 rounded-lg p-3 ${
      status === 'accepted' ? 'border-l-4 border-l-green-500' :
      status === 'rejected' ? 'border-l-4 border-l-red-500 opacity-50' :
      ''
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-300">
            → <span className="text-gray-400">{edgeType}</span> &quot;{targetTitle}&quot;
          </div>
          <div className="text-xs text-gray-500 mt-1">{rationale}</div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onAccept}
            className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
              status === 'accepted' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-green-400'
            }`}
            aria-label={`Accept connection to ${targetTitle}`}
          >
            ✓
          </button>
          <button
            onClick={onReject}
            className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
              status === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-red-400'
            }`}
            aria-label={`Reject connection to ${targetTitle}`}
          >
            ✗
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create ReviewCard (the critical component)**

Create `src/components/review/ReviewCard.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';
import type { Node, LlmExtraction, HumanReview } from '@/lib/types/nodes';
import { ExtractionField } from './ExtractionField';
import { ConfidenceSlider } from './ConfidenceSlider';
import { DomainTagEditor } from './DomainTagEditor';
import { ConnectionSuggestion } from './ConnectionSuggestion';

interface ReviewCardProps {
  readonly node: Node;
  readonly onPromote: (review: HumanReview) => void;
  readonly onSaveDraft: (review: HumanReview) => void;
  readonly onArchive: () => void;
  readonly isSubmitting?: boolean;
}

type FieldAction = 'accepted' | 'rejected' | 'edited';

interface FieldState {
  readonly action: FieldAction;
  readonly original: unknown;
  readonly final: unknown;
}

export function ReviewCard({ node, onPromote, onSaveDraft, onArchive, isSubmitting = false }: ReviewCardProps) {
  const extraction = node.llm_extraction;

  const [fields, setFields] = useState<Record<string, FieldState>>({});
  const [confidence, setConfidence] = useState(extraction.confidence_assessment?.level ?? 3);
  const [domainTags, setDomainTags] = useState<readonly string[]>(extraction.domain_tags ?? []);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<number, 'accepted' | 'rejected'>>({});

  if (!extraction) return null;

  const handleFieldAction = useCallback((fieldName: string, action: FieldAction, finalValue: unknown, originalValue: unknown) => {
    setFields(prev => ({
      ...prev,
      [fieldName]: { action, original: originalValue, final: finalValue },
    }));
  }, []);

  const handleConnectionAction = useCallback((index: number, status: 'accepted' | 'rejected') => {
    setConnectionStatuses(prev => ({ ...prev, [index]: status }));
  }, []);

  const buildReview = (): HumanReview => ({
    reviewed_at: new Date().toISOString(),
    reviewer_id: node.author_id ?? '',
    fields: {
      ...fields,
      confidence: { action: confidence !== extraction.confidence_assessment?.level ? 'edited' : 'accepted', original: extraction.confidence_assessment?.level, final: confidence },
      domain_tags: { action: JSON.stringify(domainTags) !== JSON.stringify(extraction.domain_tags) ? 'edited' : 'accepted', original: extraction.domain_tags, final: domainTags },
    },
    connections_accepted: (extraction.suggested_connections ?? [])
      .filter((_, i) => connectionStatuses[i] === 'accepted')
      .map(c => ({ target_node_id: '', edge_type: c.edge_type })),
    connections_rejected: (extraction.suggested_connections ?? [])
      .filter((_, i) => connectionStatuses[i] === 'rejected')
      .map(c => c.target_title),
    connections_added: [],
  });

  return (
    <div className="flex gap-6">
      {/* Left: extraction fields */}
      <div className="flex-1 space-y-3">
        <ExtractionField
          label="Title"
          value={extraction.title}
          currentAction={fields.title?.action}
          onAction={(action, value) => handleFieldAction('title', action, value, extraction.title)}
        />
        <ExtractionField
          label="Summary"
          value={extraction.summary}
          currentAction={fields.summary?.action}
          onAction={(action, value) => handleFieldAction('summary', action, value, extraction.summary)}
        />
        {extraction.structured_claim && (
          <ExtractionField
            label="Structured Claim"
            value={`If ${extraction.structured_claim.if}, then ${extraction.structured_claim.then}, because ${extraction.structured_claim.because}`}
            currentAction={fields.structured_claim?.action}
            onAction={(action, value) => handleFieldAction('structured_claim', action, value, extraction.structured_claim)}
          />
        )}
        {extraction.assumption_type && (
          <ExtractionField
            label="Assumption Type"
            value={extraction.assumption_type === 'background' ? 'Background (contextual given)' : 'Foreground (testable proposition)'}
            currentAction={fields.assumption_type?.action}
            onAction={(action, value) => handleFieldAction('assumption_type', action, value, extraction.assumption_type)}
          />
        )}
        <ConfidenceSlider
          aiLevel={extraction.confidence_assessment?.level ?? 3}
          humanLevel={confidence}
          onChange={setConfidence}
        />
        <DomainTagEditor tags={domainTags} onChange={setDomainTags} />
      </div>

      {/* Right: connections + actions */}
      <div className="w-80 space-y-4">
        <div>
          <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-2">Suggested Connections</h3>
          <div className="space-y-2">
            {(extraction.suggested_connections ?? []).map((conn, i) => (
              <ConnectionSuggestion
                key={i}
                targetTitle={conn.target_title}
                edgeType={conn.edge_type}
                rationale={conn.rationale}
                status={connectionStatuses[i]}
                onAccept={() => handleConnectionAction(i, 'accepted')}
                onReject={() => handleConnectionAction(i, 'rejected')}
              />
            ))}
            {(extraction.suggested_connections ?? []).length === 0 && (
              <p className="text-xs text-gray-600">No connections suggested</p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-800 pt-4 space-y-2">
          <button
            onClick={() => onPromote(buildReview())}
            disabled={isSubmitting}
            className="w-full bg-node-assumption-bg text-white rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Promote to Graph
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => onSaveDraft(buildReview())}
              disabled={isSubmitting}
              className="flex-1 text-node-option text-sm py-2 hover:underline disabled:opacity-40"
            >
              Save as Draft
            </button>
            <button
              onClick={onArchive}
              disabled={isSubmitting}
              className="flex-1 text-node-assumption-fg text-sm py-2 hover:underline disabled:opacity-40"
            >
              Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create review page**

Create `src/app/capture/[id]/review/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ReviewCard } from '@/components/review/ReviewCard';
import type { Node, HumanReview } from '@/lib/types/nodes';

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [node, setNode] = useState<Node | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchNode = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('nodes')
        .select('*')
        .eq('id', params.id)
        .single();
      if (data) setNode(data as unknown as Node);
    };
    fetchNode();
  }, [params.id]);

  const handlePromote = async (review: HumanReview) => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      await supabase
        .from('nodes')
        .update({
          human_review: review,
          status: 'promoted',
          confidence_level: review.fields.confidence?.final as number,
          domain_tags: review.fields.domain_tags?.final as string[],
        })
        .eq('id', params.id);

      await supabase.from('activity_log').insert({
        action: 'promoted',
        target_node_id: params.id as string,
        details: { from_status: node?.status },
      });

      router.push('/capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async (review: HumanReview) => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      await supabase
        .from('nodes')
        .update({ human_review: review, status: 'human_reviewed' })
        .eq('id', params.id);
      router.push('/capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      await supabase
        .from('nodes')
        .update({ status: 'archived' })
        .eq('id', params.id);

      await supabase.from('activity_log').insert({
        action: 'archived',
        target_node_id: params.id as string,
      });

      router.push('/capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!node) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-48" />
          <div className="h-32 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (!node.llm_extraction || node.status === 'raw' || node.status === 'processing') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-400">This hunch is still being processed by the AI.</p>
        <p className="text-sm text-gray-600 mt-1">Check back in a moment.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-200">{node.title}</h1>
        {node.description && (
          <p className="mt-1 text-sm text-gray-500">{node.description}</p>
        )}
      </div>
      <ReviewCard
        node={node}
        onPromote={handlePromote}
        onSaveDraft={handleSaveDraft}
        onArchive={handleArchive}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
```

- [ ] **Step 10: Create single hunch view page**

Create `src/app/capture/[id]/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Node } from '@/lib/types/nodes';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfidenceIndicator } from '@/components/shared/ConfidenceIndicator';
import Link from 'next/link';

export default function HunchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [node, setNode] = useState<Node | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const fetchNode = async () => {
      const { data } = await supabase
        .from('nodes')
        .select('*')
        .eq('id', params.id)
        .single();
      if (data) setNode(data as unknown as Node);
    };
    fetchNode();

    // Subscribe to updates for this node
    const channel = supabase
      .channel(`node-${params.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'nodes',
        filter: `id=eq.${params.id}`,
      }, (payload) => {
        setNode(payload.new as unknown as Node);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  const handleRetry = async () => {
    const response = await fetch('/api/capture/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: params.id }),
    });
    if (response.ok) {
      router.refresh();
    }
  };

  if (!node) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-48" />
          <div className="h-24 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-gray-200">{node.title}</h1>
          {node.description && (
            <p className="mt-1 text-sm text-gray-500">{node.description}</p>
          )}
        </div>
        <StatusBadge status={node.status} />
      </div>

      <div className="flex items-center gap-4 mb-6">
        <ConfidenceIndicator level={node.confidence_level} />
        <span className="text-xs text-gray-600">
          {new Date(node.created_at).toLocaleDateString()}
        </span>
      </div>

      {node.status === 'processing' && (
        <div className="bg-node-option/10 border border-node-option/30 rounded-lg p-4 text-center">
          <p className="text-sm text-node-option">Processing with AI...</p>
          <div className="mt-2 w-full bg-gray-800 rounded-full h-1">
            <div className="bg-node-option h-1 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {node.status === 'error' && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-400">Processing failed</p>
          {node.llm_extraction && typeof node.llm_extraction === 'object' && 'error' in node.llm_extraction && (
            <p className="text-xs text-red-500 mt-1">{String((node.llm_extraction as Record<string, unknown>).error)}</p>
          )}
          <button
            onClick={handleRetry}
            className="mt-3 bg-red-600 text-white text-sm px-4 py-1.5 rounded hover:bg-red-500"
          >
            Retry Processing
          </button>
        </div>
      )}

      {node.status === 'llm_reviewed' && (
        <Link
          href={`/capture/${node.id}/review`}
          className="block bg-node-assumption-bg text-white text-center rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Review AI Extraction
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 11: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 12: Verify build**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 13: Commit**

```bash
git add src/components/review/ src/app/capture/
git commit -m "feat: add review interface with per-field accept/reject/edit and promote action"
```

---

## Task 7: Graph Visualization

**Files:**
- Create: `src/lib/graph/layout.ts`
- Create: `src/lib/graph/queries.ts`
- Create: `src/components/graph/GraphCanvas.tsx`
- Create: `src/components/graph/NodeDetailPanel.tsx`
- Create: `src/components/graph/FilterBar.tsx`
- Create: `src/app/graph/page.tsx`
- Create: `src/app/api/graph/nodes/route.ts`
- Create: `src/app/api/graph/edges/route.ts`

- [ ] **Step 1: Create graph API routes**

Create `src/app/api/graph/nodes/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from('nodes')
    .select('*')
    .in('status', ['promoted', 'human_reviewed']);

  const nodeType = searchParams.get('node_type');
  if (nodeType) query = query.eq('node_type', nodeType);

  const authorId = searchParams.get('author_id');
  if (authorId) query = query.eq('author_id', authorId);

  const domain = searchParams.get('domain');
  if (domain) query = query.contains('domain_tags', [domain]);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from('nodes')
    .insert({ ...body, author_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
```

Create `src/app/api/graph/edges/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('edges')
    .select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from('edges')
    .insert({ ...body, author_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('activity_log').insert({
    actor_id: user.id,
    action: 'connected',
    target_node_id: body.source_id,
    details: { edge_type: body.edge_type, target_id: body.target_id },
  });

  return NextResponse.json({ data }, { status: 201 });
}
```

- [ ] **Step 2: Create graph layout utilities**

Create `src/lib/graph/layout.ts`:

```typescript
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

export interface GraphNode extends SimulationNodeDatum {
  readonly id: string;
  readonly node_type: string;
  readonly title: string;
  readonly color: string;
  readonly radius: number;
  readonly data: Node;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  readonly id: string;
  readonly edge_type: string;
  readonly data: Edge;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  hunch: '#7F77DD',
  assumption_background: '#1D9E75',
  assumption_foreground: '#D85A30',
  test: '#D4537E',
  learning: '#378ADD',
  option: '#BA7517',
  person: '#888780',
  organisation: '#888780',
  site: '#639922',
};

const NODE_TYPE_RADII: Record<string, number> = {
  hunch: 20,
  assumption_background: 16,
  assumption_foreground: 16,
  test: 14,
  learning: 14,
  option: 18,
  person: 12,
  organisation: 12,
  site: 12,
};

export function toGraphNode(node: Node): GraphNode {
  return {
    id: node.id,
    node_type: node.node_type,
    title: node.title,
    color: NODE_TYPE_COLORS[node.node_type] ?? '#888',
    radius: NODE_TYPE_RADII[node.node_type] ?? 14,
    data: node,
  };
}

export function toGraphLink(edge: Edge): GraphLink {
  return {
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    edge_type: edge.edge_type,
    data: edge,
  };
}

export const FORCE_CONFIG = {
  charge: -200,
  linkDistance: 100,
  collideRadius: 30,
  centerStrength: 0.05,
} as const;
```

Create `src/lib/graph/queries.ts`:

```typescript
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

export function getNodeConnections(nodeId: string, edges: readonly Edge[]): readonly Edge[] {
  return edges.filter(e => e.source_id === nodeId || e.target_id === nodeId);
}

export function getConnectedNodeIds(nodeId: string, edges: readonly Edge[]): readonly string[] {
  const connections = getNodeConnections(nodeId, edges);
  const ids = new Set<string>();
  for (const edge of connections) {
    if (edge.source_id !== nodeId) ids.add(edge.source_id);
    if (edge.target_id !== nodeId) ids.add(edge.target_id);
  }
  return Array.from(ids);
}

export function getChain(
  startNodeId: string,
  nodes: readonly Node[],
  edges: readonly Edge[]
): readonly Node[] {
  const visited = new Set<string>();
  const chain: Node[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) chain.push(node);

    const outgoing = edges.filter(e => e.source_id === nodeId);
    for (const edge of outgoing) {
      traverse(edge.target_id);
    }
  }

  traverse(startNodeId);
  return chain;
}
```

- [ ] **Step 3: Create FilterBar**

Create `src/components/graph/FilterBar.tsx`:

```tsx
'use client';

interface FilterBarProps {
  readonly activeTypes: readonly string[];
  readonly onToggleType: (type: string) => void;
  readonly nodeTypes: ReadonlyArray<{ readonly id: string; readonly label: string; readonly color: string | null }>;
}

export function FilterBar({ activeTypes, onToggleType, nodeTypes }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 flex-wrap">
      <span className="text-xs text-gray-600 uppercase">Filter:</span>
      {nodeTypes.map(type => {
        const isActive = activeTypes.includes(type.id);
        return (
          <button
            key={type.id}
            onClick={() => onToggleType(type.id)}
            className="text-xs px-2.5 py-0.5 rounded-full transition-colors"
            style={{
              backgroundColor: isActive ? (type.color ?? '#888') : '#1f2937',
              color: isActive ? '#fff' : '#6b7280',
            }}
          >
            {type.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create NodeDetailPanel**

Create `src/components/graph/NodeDetailPanel.tsx`:

```tsx
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { NodeTypeBadge } from '@/components/shared/NodeTypeBadge';
import { getNodeConnections } from '@/lib/graph/queries';

interface NodeDetailPanelProps {
  readonly node: Node;
  readonly edges: readonly Edge[];
  readonly allNodes: readonly Node[];
  readonly onClose: () => void;
}

export function NodeDetailPanel({ node, edges, allNodes, onClose }: NodeDetailPanelProps) {
  const connections = getNodeConnections(node.id, edges);
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 bg-gray-950 border-l border-gray-800 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <NodeTypeBadge nodeType={node.node_type} />
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-lg">×</button>
      </div>

      <h3 className="text-sm font-bold text-gray-200 mb-2">{node.title}</h3>

      {node.description && (
        <p className="text-xs text-gray-500 mb-3">{node.description}</p>
      )}

      {node.domain_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {node.domain_tags.map(tag => (
            <span key={tag} className="bg-node-site text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {connections.length > 0 && (
        <div className="border-t border-gray-800 pt-3">
          <div className="text-xs text-gray-600 mb-2">CONNECTIONS ({connections.length})</div>
          {connections.map(edge => {
            const isSource = edge.source_id === node.id;
            const otherNodeId = isSource ? edge.target_id : edge.source_id;
            const otherNode = nodeMap.get(otherNodeId);
            return (
              <div key={edge.id} className="text-xs text-gray-400 mb-1">
                {isSource ? '→' : '←'} {edge.edge_type} {otherNode?.title ?? 'Unknown'}
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-gray-800 pt-3 mt-3">
        <div className="text-xs text-gray-600">CREATED</div>
        <div className="text-xs text-gray-400 mt-1">
          {new Date(node.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create GraphCanvas**

Create `src/components/graph/GraphCanvas.tsx`:

```tsx
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { toGraphNode, toGraphLink, FORCE_CONFIG, type GraphNode, type GraphLink } from '@/lib/graph/layout';

interface GraphCanvasProps {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly activeTypes: readonly string[];
  readonly onSelectNode: (node: Node | null) => void;
}

export function GraphCanvas({ nodes, edges, activeTypes, onSelectNode }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  const filteredNodes = nodes.filter(n => activeTypes.includes(n.node_type));
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = edges.filter(e => filteredNodeIds.has(e.source_id) && filteredNodeIds.has(e.target_id));

  const graphNodes = filteredNodes.map(toGraphNode);
  const graphLinks = filteredEdges.map(toGraphLink);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#444');

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(graphLinks)
      .join('line')
      .attr('stroke', '#333')
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#arrowhead)');

    // Nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(graphNodes)
      .join('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', 'none')
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => onSelectNode(d.data))
      .call(d3.drag<SVGCircleElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulationRef.current?.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Labels
    const label = g.append('g')
      .selectAll('text')
      .data(graphNodes)
      .join('text')
      .text(d => d.title.length > 20 ? d.title.substring(0, 20) + '...' : d.title)
      .attr('font-size', 9)
      .attr('fill', '#888')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.radius + 12);

    // Simulation
    const simulation = d3.forceSimulation(graphNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphLinks).id(d => d.id).distance(FORCE_CONFIG.linkDistance))
      .force('charge', d3.forceManyBody().strength(FORCE_CONFIG.charge))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(FORCE_CONFIG.centerStrength))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.radius + 5))
      .on('tick', () => {
        link
          .attr('x1', d => (d.source as GraphNode).x ?? 0)
          .attr('y1', d => (d.source as GraphNode).y ?? 0)
          .attr('x2', d => (d.target as GraphNode).x ?? 0)
          .attr('y2', d => (d.target as GraphNode).y ?? 0);
        node
          .attr('cx', d => d.x ?? 0)
          .attr('cy', d => d.y ?? 0);
        label
          .attr('x', d => d.x ?? 0)
          .attr('y', d => d.y ?? 0);
      });

    simulationRef.current = simulation;

    return () => { simulation.stop(); };
  }, [filteredNodes.length, filteredEdges.length, activeTypes]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-gray-950"
      style={{ minHeight: '500px' }}
    />
  );
}
```

- [ ] **Step 6: Create graph page**

Create `src/app/graph/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Node, NodeType } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { NodeDetailPanel } from '@/components/graph/NodeDetailPanel';
import { FilterBar } from '@/components/graph/FilterBar';
import { EmptyState } from '@/components/shared/EmptyState';

export default function GraphPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const fetchData = async () => {
      const [nodesRes, edgesRes, typesRes] = await Promise.all([
        supabase.from('nodes').select('*').in('status', ['promoted', 'human_reviewed']),
        supabase.from('edges').select('*'),
        supabase.from('node_types').select('*').eq('is_active', true).order('sort_order'),
      ]);

      if (nodesRes.data) setNodes(nodesRes.data as unknown as Node[]);
      if (edgesRes.data) setEdges(edgesRes.data as unknown as Edge[]);
      if (typesRes.data) {
        const types = typesRes.data as unknown as NodeType[];
        setNodeTypes(types);
        setActiveTypes(types.map(t => t.id));
      }
    };

    fetchData();
  }, []);

  const handleToggleType = (typeId: string) => {
    setActiveTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  };

  if (nodes.length === 0) {
    return (
      <EmptyState
        title="Capture your first hunch to start building the graph"
        actionLabel="Go to Capture"
        actionHref="/capture"
      />
    );
  }

  return (
    <div className="h-[calc(100vh-49px)] flex flex-col relative">
      <FilterBar
        activeTypes={activeTypes}
        onToggleType={handleToggleType}
        nodeTypes={nodeTypes}
      />
      <div className="flex-1 relative">
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          activeTypes={activeTypes}
          onSelectNode={setSelectedNode}
        />
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            edges={edges}
            allNodes={nodes}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
      {/* Legend */}
      <div className="flex gap-4 px-4 py-2 border-t border-gray-800 justify-center">
        {nodeTypes.map(type => (
          <div key={type.id} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: type.color ?? '#888' }}
            />
            <span className="text-[10px] text-gray-500">{type.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 8: Commit**

```bash
git add src/lib/graph/ src/components/graph/ src/app/graph/ src/app/api/graph/
git commit -m "feat: add D3 force-directed graph with filtering, node detail panel, and graph API routes"
```

---

## Task 8: Dashboard + Weekly Review

**Files:**
- Create: `src/components/review/WeeklyReview.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/review/page.tsx`

- [ ] **Step 1: Create dashboard page**

Replace `src/app/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/shared/EmptyState';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [awaitingRes, promotedRes, testsRes, recentRes] = await Promise.all([
    supabase
      .from('nodes')
      .select('id, node_type, title, status, created_at')
      .eq('status', 'llm_reviewed')
      .order('created_at', { ascending: true }),
    supabase
      .from('nodes')
      .select('id, title, author_id, created_at')
      .eq('status', 'promoted')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('nodes')
      .select('id, title, domain_tags')
      .eq('node_type', 'test')
      .eq('status', 'promoted'),
    supabase
      .from('activity_log')
      .select('id, action, target_node_id, created_at, details')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const awaiting = awaitingRes.data ?? [];
  const promoted = promotedRes.data ?? [];
  const tests = testsRes.data ?? [];
  const recent = recentRes.data ?? [];

  const hasData = awaiting.length > 0 || promoted.length > 0 || tests.length > 0;

  if (!hasData && recent.length === 0) {
    return (
      <EmptyState
        title="Welcome to COF Learning System"
        description="Start by capturing your first hunch"
        actionLabel="Capture a Hunch"
        actionHref="/capture"
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-lg font-bold text-gray-200 mb-6">Dashboard</h1>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-600 uppercase tracking-wider">Awaiting Review</div>
          <div className="text-2xl font-bold text-node-assumption-fg mt-1">{awaiting.length}</div>
          {awaiting.length > 0 && (
            <Link href="/review" className="text-xs text-gray-500 hover:text-gray-400 mt-1 block">
              View queue →
            </Link>
          )}
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-600 uppercase tracking-wider">Promoted This Week</div>
          <div className="text-2xl font-bold text-node-assumption-bg mt-1">{promoted.length}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-600 uppercase tracking-wider">Active Tests</div>
          <div className="text-2xl font-bold text-node-test mt-1">{tests.length}</div>
        </div>
      </div>

      {/* Recent activity */}
      {recent.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {recent.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 text-xs text-gray-500 py-1.5 border-b border-gray-800/50">
                <span className="text-gray-400 capitalize">{entry.action.replace(/_/g, ' ')}</span>
                <span className="text-gray-600">
                  {new Date(entry.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create weekly review page**

Create `src/app/review/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import Link from 'next/link';
import type { Node } from '@/lib/types/nodes';

export default async function ReviewPage() {
  const supabase = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [awaitingRes, staleRes, challengesRes] = await Promise.all([
    // Awaiting promotion
    supabase
      .from('nodes')
      .select('*')
      .eq('status', 'llm_reviewed')
      .order('created_at', { ascending: true }),
    // Stale hunches (llm_reviewed for >7 days)
    supabase
      .from('nodes')
      .select('*')
      .eq('status', 'llm_reviewed')
      .lt('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true }),
    // Recent challenges
    supabase
      .from('edges')
      .select('id, source_id, target_id, edge_type, created_at')
      .eq('edge_type', 'challenges')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false }),
  ]);

  const awaiting = (awaitingRes.data ?? []) as unknown as Node[];
  const stale = (staleRes.data ?? []) as unknown as Node[];
  const challenges = challengesRes.data ?? [];

  if (awaiting.length === 0 && challenges.length === 0) {
    return (
      <EmptyState
        title="All caught up — no hunches awaiting review"
        description="New hunches will appear here after AI processing"
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-lg font-bold text-gray-200 mb-6">Weekly Review</h1>

      {/* Stale hunches warning */}
      {stale.length > 0 && (
        <div className="bg-node-option/10 border border-node-option/30 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-medium text-node-option mb-2">
            {stale.length} stale hunch{stale.length > 1 ? 'es' : ''} (>7 days)
          </h2>
          <p className="text-xs text-gray-500">These have been waiting for human review for over a week.</p>
        </div>
      )}

      {/* Awaiting promotion */}
      {awaiting.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Awaiting Review ({awaiting.length})
          </h2>
          <div className="space-y-2">
            {awaiting.map(node => (
              <Link
                key={node.id}
                href={`/capture/${node.id}/review`}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-200 truncate">{node.title}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {new Date(node.created_at).toLocaleDateString()}
                  </div>
                </div>
                <StatusBadge status={node.status} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Assumption challenges */}
      {challenges.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Recent Challenges ({challenges.length})
          </h2>
          <div className="space-y-2">
            {challenges.map(edge => (
              <div key={edge.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-gray-400">
                <span className="text-node-assumption-fg">challenges</span> connection created {new Date(edge.created_at).toLocaleDateString()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/review/
git commit -m "feat: add dashboard with status cards and weekly review page"
```

---

## Task 9: Settings Page + Polish

**Files:**
- Create: `src/app/settings/page.tsx`
- Modify: various files for polish

- [ ] **Step 1: Create settings page**

Create `src/app/settings/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NodeType } from '@/lib/types/nodes';
import type { EdgeType } from '@/lib/types/edges';

export default function SettingsPage() {
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
  const [edgeTypes, setEdgeTypes] = useState<EdgeType[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const fetchTypes = async () => {
      const [nodesRes, edgesRes] = await Promise.all([
        supabase.from('node_types').select('*').order('sort_order'),
        supabase.from('edge_types').select('*').order('id'),
      ]);
      if (nodesRes.data) setNodeTypes(nodesRes.data as unknown as NodeType[]);
      if (edgesRes.data) setEdgeTypes(edgesRes.data as unknown as EdgeType[]);
    };

    fetchTypes();
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-lg font-bold text-gray-200 mb-6">Settings</h1>

      {/* Node Types */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Node Types</h2>
        <div className="space-y-2">
          {nodeTypes.map(type => (
            <div key={type.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: type.color ?? '#888' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200">{type.label}</div>
                <div className="text-xs text-gray-500">{type.description}</div>
              </div>
              <span className="text-xs text-gray-600 font-mono">{type.id}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edge Types */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Edge Types</h2>
        <div className="space-y-2">
          {edgeTypes.map(type => (
            <div key={type.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200">{type.label}</div>
              </div>
              <span className="text-xs text-gray-600">
                {type.is_directional ? 'directional' : 'bidirectional'}
              </span>
              <span className="text-xs text-gray-600 font-mono">{type.id}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Config (read-only for v1) */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Agent Configuration</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-3">LLM agent settings are configured via environment variables. Contact your admin to change these.</p>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Extraction model:</span>
              <span className="text-gray-300">{process.env.NEXT_PUBLIC_EXTRACTION_MODEL ?? 'claude-sonnet-4'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add global CSS polish**

Add to `src/app/globals.css` (after the existing Tailwind directives):

```css
/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

/* Skeleton animation */
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
.animate-skeleton {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
```

- [ ] **Step 3: Verify complete build**

```bash
npm run build
```

Expected: successful build with no errors.

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/ src/app/globals.css
git commit -m "feat: add settings page and CSS polish"
```

---

## Task 10: Supabase Setup + First Deploy

This task requires manual Supabase configuration. Follow these steps exactly.

- [ ] **Step 1: Create Supabase project**

1. Go to https://supabase.com/dashboard and create a new project named "cof-learning-system"
2. Select a region close to your users
3. Save the project URL and anon key

- [ ] **Step 2: Run database schema**

1. In Supabase dashboard → SQL Editor
2. Paste contents of `supabase/schema.sql` and execute
3. Paste contents of `supabase/seed.sql` and execute
4. Verify tables exist in Table Editor

- [ ] **Step 3: Configure Google OAuth**

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
4. In Supabase dashboard → Auth → Providers → Google: enable and paste Client ID + Secret

- [ ] **Step 4: Create Storage bucket**

1. In Supabase dashboard → Storage
2. Create a new bucket named "attachments"
3. Set it to private (authenticated access only)

- [ ] **Step 5: Create .env.local**

```bash
cp .env.example .env.local
```

Fill in the values from steps 1-3.

- [ ] **Step 6: Test locally**

```bash
npm run dev
```

1. Open http://localhost:3000
2. Should redirect to /login
3. Click "Sign in with Google"
4. After auth, should land on dashboard
5. Navigate to /capture, create a test hunch
6. Verify it appears in the list with "processing" status
7. Wait for extraction to complete (status changes to "llm_reviewed")
8. Click the hunch → Review → test accept/reject/edit/promote

- [ ] **Step 7: Deploy to Vercel**

```bash
npx vercel --prod
```

Or connect the Git repository in Vercel dashboard and add environment variables.

- [ ] **Step 8: Add ALLOWED_EMAILS**

In Vercel environment variables, set `ALLOWED_EMAILS` to the comma-separated list of authorized emails (Indy, Robyn, Gurden).

- [ ] **Step 9: Verify production deployment**

1. Open the Vercel URL
2. Login with an authorized Google account
3. Create a hunch, verify extraction pipeline works
4. Check the graph page

- [ ] **Step 10: Commit any deploy fixes**

```bash
git add -A
git commit -m "chore: deployment configuration fixes"
```
