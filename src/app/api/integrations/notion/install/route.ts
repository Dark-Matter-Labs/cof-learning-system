import { NextResponse } from 'next/server';

/**
 * GET /api/integrations/notion/install
 *
 * TODO (Phase 2): Redirect to Notion OAuth authorization URL.
 *
 * Steps to implement:
 * 1. Generate a state UUID and store in an HttpOnly cookie
 * 2. Redirect to:
 *    https://api.notion.com/v1/oauth/authorize
 *      ?client_id=NOTION_CLIENT_ID
 *      &response_type=code
 *      &owner=user
 *      &redirect_uri=<callback_url>
 *      &state=<uuid>
 *
 * Required env vars: NOTION_CLIENT_ID, NEXT_PUBLIC_APP_URL
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Notion integration not yet implemented' },
    { status: 501 },
  );
}
