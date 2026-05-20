import { NextResponse } from 'next/server';

/**
 * POST /api/integrations/folk/sync
 *
 * TODO (Phase 2): Pull contacts from Folk API and upsert into folk_contacts.
 *
 * Steps to implement:
 * 1. Authenticate the COF user (createClient() + getUser())
 * 2. Fetch contacts from Folk API:
 *    GET https://api.folk.app/v2/contacts
 *    Authorization: Bearer FOLK_API_KEY
 * 3. Upsert rows in folk_contacts keyed on (user_id, folk_id)
 * 4. Return { synced: N, updated: M }
 *
 * Required env vars: FOLK_API_KEY
 */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Folk sync not yet implemented' },
    { status: 501 },
  );
}
