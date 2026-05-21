import { NextResponse } from 'next/server';

/**
 * GET /api/integrations/notion/callback
 *
 * TODO: Handle Notion OAuth callback.
 *
 * Steps to implement:
 * 1. Validate `state` param against cookie (CSRF check)
 * 2. Exchange `code` for token at https://api.notion.com/v1/oauth/token
 *    (POST with Basic auth: client_id:client_secret)
 *    Body: { grant_type: 'authorization_code', code, redirect_uri }
 * 3. Encrypt access_token using encryptToken()
 * 4. Upsert into source_integrations:
 *    { user_id, provider: 'notion', access_token, token_iv, team_id: workspace_id, ... }
 * 5. Redirect to /settings?notion=connected
 *
 * Required env vars: NOTION_CLIENT_ID, NOTION_CLIENT_SECRET
 * Note: Confirm Notion's token response shape before implementing.
 *
 * See: src/integrations/notion/README.md
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Notion OAuth callback not yet implemented. See src/integrations/notion/README.md' },
    { status: 501 }
  );
}
