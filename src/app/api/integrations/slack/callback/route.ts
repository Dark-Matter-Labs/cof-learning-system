import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { encryptToken } from '@/lib/integrations/crypto';

/**
 * GET /api/integrations/slack/callback
 *
 * OAuth v2 callback from Slack. Exchanges the code for an access token,
 * encrypts it, and upserts into source_integrations.
 */

const STATE_COOKIE_NAME = 'slack_oauth_state';

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id: string; name: string };
  authed_user?: { id: string };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam === 'access_denied') {
    return NextResponse.redirect(`${origin}/settings?slack=cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?slack=error&reason=missing_params`);
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE_NAME)?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(`${origin}/settings?slack=error&reason=invalid_state`);
  }

  // Clear the state cookie immediately
  cookieStore.delete(STATE_COOKIE_NAME);

  // Require an authenticated Supabase session for the installing user
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/settings?slack=error&reason=not_configured`);
  }

  const redirectUri = `${origin}/api/integrations/slack/callback`;

  // Exchange code for token
  const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const tokenData = await tokenRes.json() as SlackOAuthResponse;

  if (!tokenData.ok || !tokenData.access_token || !tokenData.team?.id) {
    return NextResponse.redirect(
      `${origin}/settings?slack=error&reason=${tokenData.error ?? 'token_exchange_failed'}`
    );
  }

  // Encrypt the access token before storage
  const { ciphertext, iv } = encryptToken(tokenData.access_token);

  const adminClient = createAdminClient();
  const { error: upsertError } = await adminClient
    .from('source_integrations')
    .upsert(
      {
        user_id: user.id,
        provider: 'slack',
        access_token: ciphertext,
        token_iv: iv,
        scope: tokenData.scope ?? null,
        team_id: tokenData.team.id,
        team_name: tokenData.team.name,
        bot_user_id: tokenData.bot_user_id ?? null,
        raw_response: {},  // intentionally not storing raw response (contains token)
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,team_id' }
    );

  if (upsertError) {
    return NextResponse.redirect(`${origin}/settings?slack=error&reason=db_error`);
  }

  return NextResponse.redirect(`${origin}/settings?slack=connected`);
}
