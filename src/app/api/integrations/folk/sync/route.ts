import { NextResponse } from 'next/server';

/**
 * POST /api/integrations/folk/sync
 *
 * Syncs Folk contacts into the folk_contacts table.
 *
 * BLOCKED: Folk API shape not confirmed (see open question #1 in
 * .planning/integrations-v1.md). This stub is a placeholder.
 *
 * This route is listed in the middleware webhook exclusion so it can also be
 * called by a Vercel Cron job without a browser session. However for v1,
 * only authenticated users trigger sync manually.
 *
 * TODO: Implement once Folk API is confirmed:
 * 1. Authenticate the caller (Supabase session OR cron secret header)
 * 2. Look up user's Folk API key from source_integrations
 *    (decrypt with decryptToken())
 * 3. Fetch contacts from Folk API (paginated)
 *    Optional: accept `?since=ISO_TIMESTAMP` for incremental sync
 * 4. Upsert into folk_contacts ON CONFLICT (folk_id) DO UPDATE
 * 5. For contacts with email matching existing person nodes, optionally
 *    create folk_contact_node_links rows
 * 6. Return { synced: number, updated: number }
 *
 * Required env vars: FOLK_API_KEY (or retrieved from source_integrations)
 *
 * See: src/integrations/folk/README.md
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Folk sync not yet implemented. ' +
        'See src/integrations/folk/README.md and .planning/integrations-v1.md open question #1.',
    },
    { status: 501 }
  );
}
