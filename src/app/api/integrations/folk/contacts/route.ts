import { NextResponse } from 'next/server';

/**
 * GET /api/integrations/folk/contacts
 *
 * TODO (Phase 2): Return Folk contacts for the authenticated user.
 *
 * Steps to implement:
 * 1. Authenticate the COF user (createClient() + getUser())
 * 2. Query folk_contacts WHERE user_id = user.id
 * 3. Support optional ?q= query param for name/email search
 * 4. Return { data: FolkContact[] }
 *
 * Used by the contact picker UI when creating nodes.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Folk contacts not yet implemented' },
    { status: 501 },
  );
}
