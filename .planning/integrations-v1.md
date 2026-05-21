# Integrations v1 — Plan

Slack (end-to-end), Notion (stub), Folk (stub)

---

## 1. Shared data model

### Decision: extend `nodes` table vs. separate staging table

**Decision: extend the `nodes` table with `source`, `source_ref`, and `source_payload` columns.**

Rationale: Every integration-created item is immediately a first-class node — it goes through the same LLM extraction pipeline (via `/api/capture/process`) and appears in the graph just like any other node. A separate staging table would require a "promote to node" step that adds complexity for no benefit in v1; the team's workflow is to capture first and review later, not to triage before nodes enter the graph. The `source` + `source_ref` pair provides a unique dedup key for idempotent writes (same Slack message shortcut clicked twice = same `source_ref`), and `source_payload` preserves the raw webhook payload for audit/replay without a second table join. The rejected alternative — a `pending_captures` staging table — would be appropriate if we needed to support bulk review before nodes enter the graph, which is explicitly out of scope for v1.

### New tables

#### `source_integrations` — OAuth tokens per user

Stores one row per user per integration. Tokens are encrypted in the application layer before storage (see §4 security decision).

```
source_integrations(
  id              UUID PK
  user_id         UUID FK auth.users
  provider        TEXT  -- 'slack' | 'notion' | 'folk'
  access_token    TEXT  -- AES-256-GCM encrypted
  refresh_token   TEXT  -- nullable, AES-256-GCM encrypted
  token_iv        TEXT  -- base64 IV for the encrypted columns
  scope           TEXT
  team_id         TEXT  -- Slack workspace ID / Notion workspace ID
  team_name       TEXT  -- human-readable label
  bot_user_id     TEXT  -- Slack bot user ID (nullable)
  raw_response    JSONB -- encrypted full OAuth response for debugging
  expires_at      TIMESTAMPTZ nullable
  created_at      TIMESTAMPTZ DEFAULT NOW()
  updated_at      TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(user_id, provider, team_id)
)
```

#### `folk_contacts` — mirror of Folk contact records

```
folk_contacts(
  id              UUID PK (gen_random_uuid)
  folk_id         TEXT NOT NULL UNIQUE  -- Folk's own ID
  name            TEXT NOT NULL
  email           TEXT
  company         TEXT
  role            TEXT
  folk_groups     TEXT[] DEFAULT '{}'
  raw_data        JSONB DEFAULT '{}'
  last_synced_at  TIMESTAMPTZ DEFAULT NOW()
  created_at      TIMESTAMPTZ DEFAULT NOW()
)
```

#### `folk_contact_node_links` — join table

```
folk_contact_node_links(
  id              UUID PK
  folk_contact_id UUID FK folk_contacts
  node_id         UUID FK nodes
  link_type       TEXT DEFAULT 'mentioned'  -- 'mentioned' | 'authored' | 'participant'
  created_at      TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(folk_contact_id, node_id)
)
```

---

## 2. Per-integration flow diagrams

### Slack slash command — `/capture`

```
User types /capture [text]
       │
       ▼
Slack POST /api/integrations/slack/events
  Content-Type: application/x-www-form-urlencoded
  Headers: X-Slack-Request-Timestamp, X-Slack-Signature
       │
       ▼
verify.ts — HMAC-SHA256(SLACK_SIGNING_SECRET, "v0:{ts}:{rawBody}")
  ├── FAIL → 403
  ├── timestamp stale (>5 min) → 403
  └── OK ↓
       │
       ▼
handler.ts — dispatch on payload.type === 'slash_command'
       │
       ▼
Open modal via views.open (Slack Web API)
  Modal fields: title, node_type (select), description, source_url
       │
       ▼
User fills modal, clicks Submit
       │
       ▼
Slack POST /api/integrations/slack/events (view_submission)
       │
       ▼
Parse modal state values
       │
       ▼
supabase.from('nodes').insert({
  ...capturePayload,
  source: 'slack',
  source_ref: `slack:cmd:{workspace}:{channel_id}:{message_ts}`,
  source_payload: rawSlackPayload
})
       │
       ▼
Trigger /api/capture/process (via after())
       │
       ▼
Slack API: chat.postEphemeral → "Captured ✓"
       │
       ▼
Return 200 { response_action: 'clear' }
```

### Slack message shortcut — "Capture to COF"

```
User right-clicks message → "Capture to COF"
       │
       ▼
Slack POST /api/integrations/slack/events
  payload JSON field (application/x-www-form-urlencoded wrapper)
  type: message_action
       │
       ▼
Signature verification (same as slash command)
       │
       ▼
handler.ts — dispatch on payload.type === 'message_action'
  Pre-fill: title from message text (truncated), source_url = message permalink
       │
       ▼
Open modal (same Block Kit definition, pre-filled)
       │
       ▼
(same view_submission flow as above)
  source_ref = `slack:shortcut:{workspace}:{channel_id}:{message_ts}`
```

### Notion — planned

```
User connects Notion via OAuth
       │
       ▼
GET /api/integrations/notion/oauth → redirect to Notion OAuth
       │
       ▼
Notion redirects → GET /api/integrations/notion/callback?code=...
  Exchange code for token
  Store in source_integrations
       │
       ▼
User adds button/template to Notion DB page
       │
       ▼
Notion webhook POST /api/integrations/notion/webhook
  Verify HMAC signature (NOTION_WEBHOOK_SECRET)
       │
       ▼
Parse page data → insert node (source: 'notion')
       │
       ▼
Optional: write "Captured ✓" property back to Notion page
```

### Folk — planned

```
IF Folk has OAuth:
  GET /api/integrations/folk/oauth → redirect to Folk OAuth
  GET (callback) → store token in source_integrations

IF Folk is API-key-only (likely — see §6 open questions):
  User pastes FOLK_API_KEY in settings page
  Settings page saves to source_integrations (provider='folk', encrypted)

Periodic sync:
  POST /api/integrations/folk/sync → fetch contacts from Folk API
  Upsert folk_contacts (ON CONFLICT folk_id DO UPDATE)
  Optionally link to existing person nodes by email match
```

---

## 3. Security checklist with file locations

| Item | File | Header / Env Var |
|------|------|-----------------|
| Slack signature verification | `src/lib/integrations/slack/verify.ts` | `X-Slack-Signature`, `X-Slack-Request-Timestamp` / `SLACK_SIGNING_SECRET` |
| Slack OAuth state parameter | `src/app/api/integrations/slack/oauth/route.ts` | state stored in cookie, verified in callback |
| Notion webhook signature | `src/app/api/integrations/notion/webhook/route.ts` | `X-Notion-Signature` (or equivalent) / `NOTION_WEBHOOK_SECRET` |
| Notion OAuth state parameter | `src/app/api/integrations/notion/oauth/route.ts` | state cookie |
| Token storage | `src/app/api/integrations/slack/callback/route.ts`, `src/app/api/integrations/notion/callback/route.ts` | `INTEGRATION_TOKEN_ENCRYPTION_KEY` |
| RLS on source_integrations | `supabase/v1.0-integrations.sql` | user_id = auth.uid() |
| RLS on folk_contacts | `supabase/v1.0-integrations.sql` | authenticated USING (true) |
| Timing-safe comparison | `src/lib/integrations/slack/verify.ts` | crypto.timingSafeEqual |

### Token storage decision: encrypted column (chosen) vs Supabase Vault

**Decision: encrypt tokens in the application layer before storing in the `source_integrations` table.**

Supabase Vault (pgsodium) is the correct long-term answer, but it requires a Vault-enabled Supabase project, a key management step, and the `vault.create_secret()` / `vault.decrypted_secrets` API that adds operational complexity and is not yet set up in this project. For v1 we use AES-256-GCM in a small `src/lib/integrations/crypto.ts` utility: encrypt on write using `INTEGRATION_TOKEN_ENCRYPTION_KEY` (32-byte hex), decrypt on read. The `token_iv` column stores the base64-encoded IV per row. This is a well-understood pattern that can be migrated to Vault in a future migration without changing the application's read/write interface.

### New env vars

```
SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
SLACK_SIGNING_SECRET
SLACK_BOT_TOKEN
NOTION_CLIENT_ID
NOTION_CLIENT_SECRET
NOTION_WEBHOOK_SECRET
FOLK_API_KEY           (API-key-only if no OAuth)
FOLK_CLIENT_ID         (if OAuth available)
FOLK_CLIENT_SECRET     (if OAuth available)
INTEGRATION_TOKEN_ENCRYPTION_KEY   (32-byte hex, e.g. openssl rand -hex 32)
```

---

## 4. Scope boundaries — explicit out-of-scopes for v1

1. **Notion write-back**: Updating a captured Notion page with a "Captured ✓" property is out of scope. The webhook can receive and store; writing back requires a Notion update call that adds complexity and surface area.
2. **Folk OAuth flow**: If Folk exposes a public OAuth API, the full flow is out of scope. v1 supports API-key authentication only. The stub route exists to be filled when Folk's API is confirmed.
3. **Slack channel monitoring**: Auto-ingesting every message from a nominated channel is out of scope. v1 is explicit-capture only (slash command + message shortcut).
4. **Multi-workspace Slack**: v1 supports one Slack workspace per user. The `source_integrations` table supports multiple rows, but the UI and token-selection logic are not built.
5. **Folk contact picker in node editor**: Linking folk contacts to nodes via the node editor UI is out of scope. The `folk_contact_node_links` table exists for future use; v1 only syncs contacts.
6. **Slack interactive components beyond modal**: Buttons in Slack messages, Home tab, App Mentions are all out of scope.
7. **Periodic Folk sync cron**: The sync endpoint exists but no Vercel Cron or scheduled trigger is wired up in v1. Sync must be triggered manually or via Vercel Cron configuration outside this PR.
8. **Token refresh flows**: For integrations with expiring tokens (Notion), automatic refresh is out of scope. The `expires_at` column is stored; a future task can add a refresh-before-use wrapper.

---

## 5. Open questions

1. **Folk API**: Folk's developer portal (`https://developers.folk.app/`) could not be verified (WebFetch unavailable during planning). It is unknown whether Folk has a public OAuth API or is API-key only. The stub routes assume API-key only. **Human review required before implementing Folk routes.**
2. **Notion webhook verification header name**: Notion's current webhook signature header was not verified against live docs. The stub uses `X-Notion-Signature`; this must be confirmed against Notion docs before the webhook route is completed.
3. **Slack `response_url` vs `views.open` for slash command**: Slash commands without existing channel context may need to use `response_url` instead of `views.open`. The current plan uses `views.open` (requires `chat:write` scope and a `trigger_id`); confirmed valid from training data but should be smoke-tested.
4. **Supabase admin client for OAuth token writes**: OAuth callbacks happen outside a user session (the user is redirected back, but the server-side callback runs without a cookie-based Supabase session). The callback currently uses the admin client to write `source_integrations`. This is correct but means the callback must validate the OAuth state parameter extremely carefully to prevent token injection by a third party.
5. **`after()` availability in v16.2.1**: The `after()` function from `next/server` is used in `src/app/api/capture/route.ts`. This version is confirmed to export `after` — matched and reused in the Slack handler.
6. **Middleware bypass for webhook routes**: The middleware at `src/middleware.ts` redirects unauthenticated requests to `/login`. Slack webhook POSTs are unauthenticated (no cookie). The middleware path exclusion currently only exempts `/api/auth`. The integration event handlers (`/api/integrations/slack/events`, `/api/integrations/notion/webhook`, `/api/integrations/folk/sync`) must also be excluded. **This is implemented in this PR** by updating the middleware matcher.

---

## 6. Implementation notes

### Raw body for Slack signature verification

Slack's signature covers the raw request body bytes. In Next.js App Router, `request.text()` returns the raw body string. The handler must call `request.text()` first, then parse it manually — **not** `request.json()` or `request.formData()`. A clone (`request.clone()`) is not reliable for body consumption ordering. The pattern used:

```typescript
const rawBody = await request.text();
await verifySlackSignature(request.headers, rawBody); // throws on fail
const params = new URLSearchParams(rawBody);
// or: const payload = JSON.parse(params.get('payload') ?? '{}');
```

### Slack payload dispatch

- Slash command: `Content-Type: application/x-www-form-urlencoded`, body fields directly parseable from URLSearchParams. `command` field = `/capture`, `trigger_id` used to open modal.
- Message shortcut: Same content type, but body contains a single `payload` field whose value is a JSON string. Parse: `JSON.parse(params.get('payload'))`. `type === 'message_action'`.
- Modal submission: Same content type, `payload` field, `type === 'view_submission'`.

### Middleware exclusion for webhook routes

The middleware `config.matcher` currently uses:
```
'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
```

The `middleware` function already handles `/api/auth` exemption. We need to also exempt `/api/integrations/slack/events`, `/api/integrations/notion/webhook`, and `/api/integrations/folk/sync` since they receive unauthenticated webhook calls from external services.
