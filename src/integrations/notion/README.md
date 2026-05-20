# Notion Integration — Planned Flow

## Status: Stub (Phase 2)

## Auth Strategy

Notion supports two auth models:

1. **OAuth (per-user):** Each user connects their own Notion workspace. Recommended for SaaS products where users have different Notion accounts. Requires `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`.
2. **Internal Integration (org-level):** A single API key for the whole org. Simpler setup, suitable if all users share one Notion workspace.

**Decision needed:** confirm which model fits the team's setup before implementing.

## OAuth Flow (per-user model)

```
GET /api/integrations/notion/install
  → redirect to https://api.notion.com/v1/oauth/authorize?client_id=...&state=...
  → state UUID stored in cookie for CSRF

GET /api/integrations/notion/callback?code=...&state=...
  → verify state cookie
  → POST https://api.notion.com/v1/oauth/token (exchange code)
  → upsert token in source_integrations (source='notion')
  → redirect /settings?notion_connected=true
```

## Webhook / Event Flow

```
POST /api/integrations/notion/webhook
  → verify NOTION_WEBHOOK_SECRET signature (Notion uses HMAC-SHA256)
  → parse event type (page.created, page.updated, block.created, etc.)
  → extract page content via Notion API (GET /v1/blocks/{id}/children)
  → write node to nodes table (source='notion', source_ref=notion_page_id)
  → trigger /api/capture/process for LLM pipeline
```

## Write-back (Phase 3)

When a node is promoted or updated in COF, optionally push the change back to the originating Notion page as a comment or property update.

## Open Questions

1. Does Notion's webhook API require a verified endpoint? May need a verification handshake on first registration.
2. Rate limits: Notion API is rate-limited at 3 requests/second per integration.
3. Block-level vs page-level capture — should we capture individual blocks or whole pages?
