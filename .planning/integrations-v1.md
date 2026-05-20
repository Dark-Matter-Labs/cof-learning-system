# Integrations v1 — Slack, Notion, Folk

## Data Model Decision

### Extending `nodes` with source columns

We add three nullable columns directly to the `nodes` table:
- `source VARCHAR(50)` — identifies where the node came from (e.g. `"slack"`, `"notion"`, `"folk"`, `"web"`)
- `source_ref TEXT` — a stable external identifier (e.g. Slack message timestamp + channel, Notion block ID, Folk contact ID) used for deduplication
- `source_payload JSONB` — raw envelope from the source (trimmed to avoid PII, useful for re-parsing)

**Rationale:** Nodes created via integrations are first-class learning objects immediately — there is no value in a staging step since the LLM pipeline already handles `raw → llm_reviewed` promotion asynchronously. A separate staging table would require a promotion job, duplicate the node schema, and create a two-table join for every query that needs source metadata. The `(source, source_ref)` unique index provides deduplication at the database level. The main downside of inline columns is that abandoned integration captures stay in `nodes` forever; this is acceptable because they can be archived via existing status flows.

**Rejected alternative:** A `staged_nodes` table with a promotion cron/webhook that copies rows into `nodes`. Rejected because it doubles write complexity, requires a separate migration for every schema change to `nodes`, and adds latency before the LLM pipeline can begin.

---

## Tables

### `source_integrations` — OAuth tokens per user

Stores one row per user × integration, holding the access token and workspace/org metadata.

```
source_integrations
─────────────────────────────────────────────────────
id              uuid PK
user_id         uuid FK → auth.users
source          VARCHAR(50)   -- 'slack' | 'notion' | 'folk'
access_token    TEXT          -- encrypted at rest by Supabase Vault (Phase 2); plaintext for now
refresh_token   TEXT
token_expires_at TIMESTAMPTZ
workspace_id    TEXT          -- Slack team_id / Notion workspace_id
workspace_name  TEXT
metadata        JSONB         -- bot_user_id, authed_user, etc.
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()

UNIQUE (user_id, source, workspace_id)
```

RLS: user can only read/write their own rows.

---

### `folk_contacts` — synced Folk contact records

```
folk_contacts
─────────────────────────────────────────────────────
id              uuid PK
user_id         uuid FK → auth.users
folk_id         TEXT          -- Folk's contact ID (stable external key)
name            TEXT
email           TEXT
company         TEXT
folk_payload    JSONB         -- full contact snapshot for re-parsing
synced_at       TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()

UNIQUE (user_id, folk_id)
```

### `folk_contact_node_links` — M:M between folk_contacts and nodes

```
folk_contact_node_links
─────────────────────────────────────────────────────
id              uuid PK
user_id         uuid FK → auth.users
folk_contact_id uuid FK → folk_contacts(id)
node_id         uuid FK → nodes(id)
link_type       VARCHAR(50)  -- 'participant' | 'author' | 'mentioned'
created_at      TIMESTAMPTZ DEFAULT NOW()

UNIQUE (folk_contact_id, node_id, link_type)
```

---

## Flow Diagrams

### Slack Slash Command Flow

```
User types /cof <optional text>
        │
        ▼
POST /api/integrations/slack/events (application/x-www-form-urlencoded)
        │
        ├─ verifySlackSignature() ── FAIL → 401
        │
        ├─ command === '/cof'
        │       │
        │       ▼
        │   Respond 200 immediately with modal trigger JSON
        │   (Slack requires <3s response)
        │
        ▼
User fills modal (title, description, node_type, optional URL)
        │
        ▼
Slack POST payload.type === 'view_submission'
        │
        ├─ verifySlackSignature()
        ├─ Write node to DB (status: 'raw', source: 'slack')
        ├─ Post ephemeral confirmation message
        └─ Trigger /api/capture/process (async, same as web capture)
```

### Slack Message Shortcut Flow

```
User right-clicks message → "Save to COF"
        │
        ▼
POST /api/integrations/slack/events (JSON in payload field)
        │
        ├─ verifySlackSignature()
        ├─ payload.type === 'shortcut'
        │       │
        │       ▼
        │   Open modal pre-filled with message text
        │
        ▼
[Same modal submission path as above]
```

### Slack OAuth Flow

```
User clicks "Connect Slack" in /settings
        │
        ▼
GET /api/integrations/slack/install
        │   Generate state UUID, store in cookie
        │
        ▼
Redirect → slack.com/oauth/v2/authorize?...&state=<uuid>
        │
        ▼ (user approves)
GET /api/integrations/slack/callback?code=...&state=...
        │   Verify state cookie
        │   Exchange code for token (POST slack.com/api/oauth.v2.access)
        │   Upsert row in source_integrations
        │
        ▼
Redirect → /settings
```

### Notion OAuth Flow (stub — Phase 2)

```
GET /api/integrations/notion/install → redirect notion OAuth
GET /api/integrations/notion/callback → exchange code, store token
POST /api/integrations/notion/webhook → receive page/block changes, write nodes
```

### Folk API Flow (stub — Phase 2)

```
POST /api/integrations/folk/sync → pull contacts from Folk API, upsert folk_contacts
GET /api/integrations/folk/contacts → return folk_contacts for current user (contact picker)
```

---

## Security Checklist

- [x] **Slack signature verification** — `src/lib/integrations/slack/verify.ts` uses HMAC-SHA256 with timing-safe comparison; timestamp must be within 5 minutes
- [x] **OAuth state param** — random UUID generated per install request, stored in `__Host-slack_oauth_state` cookie (SameSite=Lax, Secure, HttpOnly), verified in callback
- [x] **Token storage** — tokens stored plaintext in `source_integrations` for Phase 1; Supabase Vault encryption is an open question (see below)
- [x] **RLS on all new tables** — `source_integrations`, `folk_contacts`, `folk_contact_node_links` all have user-scoped RLS policies
- [x] **No secrets in code** — all keys via env vars; no hardcoded fallbacks
- [x] **Raw body read before parsing** — Slack events handler reads `request.text()` first for signature verification, then parses

---

## Scope Boundaries (out of scope for v1)

1. Supabase Vault / encrypted token storage — tokens stored plaintext; encryption deferred to Phase 2
2. Slack bot responding in channels — only slash commands and shortcuts; no proactive messaging
3. Notion write-back — pushing node updates back to Notion pages
4. Folk two-way sync — changes to nodes do not update Folk records
5. Multi-workspace Slack (one workspace per user in v1)
6. Webhooks for real-time Folk contact updates (polling only)
7. Slack app distribution / app directory listing

---

## Open Questions

1. **Token encryption:** Should we use Supabase Vault for `access_token` / `refresh_token` columns, or a symmetric key in env? Vault requires pg extension setup. Decision needed before production.
2. **Notion OAuth vs Internal Integration:** Notion supports "Internal Integration" (API key, no OAuth) which is simpler. Is user-level OAuth required or is a single org-level integration key sufficient?
3. **Folk OAuth availability:** Folk's public API may only support API key auth. Need to confirm whether per-user OAuth exists or if this is a shared key.
4. **Rate limits:** Slack API rate limits for opening modals and posting ephemeral messages — do we need a queue?
5. **Node dedup strategy:** `UNIQUE (source, source_ref)` prevents exact duplicates, but Slack message edits produce a new `ts`. Should we match on channel+user+content hash instead?
