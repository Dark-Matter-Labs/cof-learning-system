import { NextResponse } from 'next/server';

/**
 * GET /api/integrations/notion/callback
 *
 * TODO (Phase 2): Handle Notion OAuth callback.
 *
 * Steps to implement:
 * 1. Verify state cookie matches the state query param
 * 2. Exchange code via POST https://api.notion.com/v1/oauth/token
 *    with Basic auth (client_id:client_secret base64)
 * 3. Upsert token in source_integrations (source='notion')
 * 4. Redirect to /settings?notion_connected=true
 *
 * Required env vars: NOTION_CLIENT_ID, NOTION_CLIENT_SECRET
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Notion integration not yet implemented' },
    { status: 501 },
  );
}
