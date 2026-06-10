# Folk CRM Integration — Planned Flow

## Status

Stub. **Blocked on API availability confirmation** (see open question #1 in
`.planning/integrations-v1.md`).

Folk's public developer portal (`https://developers.folk.app/`) was not verified
during planning. The stubs assume an API-key model. If Folk has OAuth, the
`/api/integrations/folk/oauth` stub should be updated to a redirect flow
matching the Slack/Notion OAuth pattern.

## Planned Flow (API-key model)

### 1. API Key Setup

1. User visits Settings → Integrations → "Connect Folk"
2. User pastes their Folk API key into a settings form
3. Form submits to `/api/integrations/folk/oauth` (POST, despite the name)
4. Route encrypts the key, stores in `source_integrations` (provider='folk', team_id='default')

### 2. Initial Contact Sync

1. POST `/api/integrations/folk/sync` triggers a full contact sync
2. Handler fetches all contacts from Folk API (paginated)
3. Upserts into `folk_contacts` table (`ON CONFLICT folk_id DO UPDATE`)
4. For contacts with a matching email in existing person nodes, optionally creates
   `folk_contact_node_links` entries

### 3. Incremental Sync

- POST `/api/integrations/folk/sync` also supports incremental sync via a
  `since` query parameter (ISO timestamp)
- In future: configure a Vercel Cron job to call this endpoint daily

### 4. Contact Picker in Node Editor (future)

- When editing a node, a contact picker queries `folk_contacts` for autocomplete
- Selecting a contact creates a `folk_contact_node_links` row

## Env Vars Required

```
FOLK_API_KEY            # if API-key model
FOLK_CLIENT_ID          # if OAuth
FOLK_CLIENT_SECRET      # if OAuth
```

## Files

```
src/app/api/integrations/folk/oauth/route.ts  — API key store (or OAuth redirect)
src/app/api/integrations/folk/sync/route.ts   — contact sync endpoint
```

## Known Unknowns

1. Does Folk have a webhook API for real-time contact updates?
2. Does Folk's API paginate? What is the cursor mechanism?
3. Does Folk have an OAuth 2.0 flow, or is it API-key-only?
4. What scopes/permissions are needed for read access to contacts and groups?
