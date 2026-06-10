import { NextResponse } from 'next/server';

/**
 * GET /api/integrations/notion/oauth
 *
 * TODO: Redirect to Notion OAuth authorization page.
 *
 * Steps to implement:
 * 1. Check user is authenticated (createClient + getUser)
 * 2. Generate and store a CSRF state cookie
 * 3. Build Notion OAuth URL:
 *    https://api.notion.com/v1/oauth/authorize
 *      ?client_id=NOTION_CLIENT_ID
 *      &response_type=code
 *      &owner=user
 *      &redirect_uri={origin}/api/integrations/notion/callback
 *      &state={csrfState}
 * 4. Redirect to that URL
 *
 * Required env vars: NOTION_CLIENT_ID
 *
 * See: src/integrations/notion/README.md
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Notion OAuth not yet implemented. See src/integrations/notion/README.md' },
    { status: 501 }
  );
}
