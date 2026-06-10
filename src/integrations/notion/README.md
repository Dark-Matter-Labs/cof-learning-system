# Notion Integration — Planned Flow

## Status

Stub. OAuth routes exist but are not implemented. Complete after confirming
Notion webhook signature header name (see open question #2 in `.planning/integrations-v1.md`).

## Planned Flow

### 1. OAuth Connection

1. User visits Settings → Integrations → "Connect Notion"
2. GET `/api/integrations/notion/oauth` redirects to Notion OAuth:
   `https://api.notion.com/v1/oauth/authorize?client_id=...&response_type=code&redirect_uri=...&state=...`
3. User authorises the COF integration in Notion
4. Notion redirects to GET `/api/integrations/notion/callback?code=...&state=...`
5. Callback validates OAuth state (CSRF), exchanges code for token at
   `https://api.notion.com/v1/oauth/token`, encrypts it, upserts into `source_integrations`

### 2. Capture via Webhook

Two capture models are under consideration:

**Model A — Webhook-triggered (preferred for v1.1)**
- User configures a Notion database
- Notion sends a webhook to `/api/integrations/notion/webhook` when a page is created/updated
- Handler verifies Notion signature, fetches page content via Notion API, inserts node

**Model B — Button/template (v1.0 fallback)**
- COF adds a button to a Notion database template
- User clicks → triggers a Notion automation that calls `/api/integrations/notion/webhook`
- Same handler processes the payload

### 3. Optional Write-back

After capturing, the integration can write a "Captured to COF ✓" property back to the
Notion page using the Notion API. This is **out of scope for v1** (see
`.planning/integrations-v1.md` §4 out-of-scopes).

## Env Vars Required

```
NOTION_CLIENT_ID
NOTION_CLIENT_SECRET
NOTION_WEBHOOK_SECRET   # used for HMAC verification of incoming webhooks
```

## Files

```
src/app/api/integrations/notion/oauth/route.ts     — redirect to Notion OAuth
src/app/api/integrations/notion/callback/route.ts  — exchange code, store token
src/app/api/integrations/notion/webhook/route.ts   — receive page events
```
