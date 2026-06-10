import { NextResponse } from 'next/server';

/**
 * GET/POST /api/integrations/folk/oauth
 *
 * BLOCKED: Folk API availability not confirmed (see open question #1 in
 * .planning/integrations-v1.md). This stub is a placeholder.
 *
 * If Folk is API-key-only (expected):
 *   - Implement as POST
 *   - Accept { api_key: string } JSON body
 *   - Verify the key works by calling GET /contacts (or equivalent) on Folk API
 *   - Encrypt key via encryptToken(), store in source_integrations
 *     { user_id, provider: 'folk', access_token: ciphertext, token_iv, team_id: 'default' }
 *   - Return { connected: true }
 *
 * If Folk has OAuth:
 *   - Implement as GET (redirect flow, same pattern as Slack/Notion oauth routes)
 *   - Required env vars: FOLK_CLIENT_ID, FOLK_CLIENT_SECRET
 *
 * See: src/integrations/folk/README.md
 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        'Folk integration is blocked pending API availability confirmation. ' +
        'See src/integrations/folk/README.md and .planning/integrations-v1.md open question #1.',
    },
    { status: 501 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Folk integration is blocked pending API availability confirmation. ' +
        'See src/integrations/folk/README.md and .planning/integrations-v1.md open question #1.',
    },
    { status: 501 }
  );
}
