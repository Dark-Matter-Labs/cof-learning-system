# Folk Integration — Planned Flow

## Status: Stub (Phase 2)

## Auth Strategy

Folk's public API (as of 2025) uses **API key authentication** — there is no per-user OAuth flow documented in their public API. Authentication is:

```
Authorization: Bearer <FOLK_API_KEY>
```

This means the integration is org-level (one shared API key), not per-user. If Folk adds OAuth in future this should be migrated to per-user tokens stored in `source_integrations`.

## Contact Sync Flow

```
POST /api/integrations/folk/sync
  → authenticated as COF user (session required)
  → fetch contacts from Folk API: GET https://api.folk.app/v2/contacts
  → upsert rows in folk_contacts (keyed on folk_id, scoped to user_id)
  → return { synced: N, updated: M }
```

Suggested trigger: manual "Sync contacts" button in /settings, or a scheduled cron (Phase 3).

## Contact Picker Flow

```
GET /api/integrations/folk/contacts?q=<search>
  → returns folk_contacts for the authenticated user
  → used to populate a contact picker UI when creating nodes
  → links selected contacts via folk_contact_node_links
```

## Contact → Node Linking

When a user creates a node and selects Folk contacts as participants:

1. POST /api/capture creates the node
2. UI calls POST /api/integrations/folk/contacts/link with { node_id, folk_contact_ids }
3. Rows inserted into folk_contact_node_links

## Open Questions

1. Confirm Folk API v2 endpoint structure — documentation may be incomplete.
2. Does Folk support webhook events for contact updates? If so, we can sync in real-time.
3. PII handling: folk_payload JSONB may contain email/phone. Confirm GDPR compliance before storing.
4. Rate limits: unknown — investigate before implementing polling sync.
