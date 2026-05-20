import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id: string; name: string };
  authed_user?: { id: string; scope?: string; access_token?: string };
  error?: string;
}

/**
 * GET /api/integrations/slack/callback
 *
 * Handles the OAuth callback from Slack.
 * Verifies state, exchanges code for token, saves to source_integrations.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // User denied the installation
  if (error) {
    return NextResponse.redirect(
      new URL('/settings?slack_error=access_denied', request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing code or state parameter' },
      { status: 400 },
    );
  }

  // Verify CSRF state cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get('__Host-slack_oauth_state')?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Slack integration is not configured' },
      { status: 503 },
    );
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json(
      { error: 'Failed to exchange code with Slack' },
      { status: 502 },
    );
  }

  const tokenData = (await tokenRes.json()) as SlackOAuthResponse;

  if (!tokenData.ok || !tokenData.access_token) {
    return NextResponse.json(
      { error: tokenData.error ?? 'Slack OAuth failed' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(
      new URL('/login?slack_error=not_authenticated', request.url),
    );
  }

  const { error: upsertError } = await supabase
    .from('source_integrations')
    .upsert(
      {
        user_id: user.id,
        source: 'slack',
        access_token: tokenData.access_token,
        workspace_id: tokenData.team?.id ?? null,
        workspace_name: tokenData.team?.name ?? null,
        metadata: {
          bot_user_id: tokenData.bot_user_id,
          app_id: tokenData.app_id,
          authed_user: tokenData.authed_user,
          scope: tokenData.scope,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,source,workspace_id' },
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Clear the state cookie
  const redirectResponse = NextResponse.redirect(
    new URL('/settings?slack_connected=true', request.url),
  );
  redirectResponse.cookies.delete('__Host-slack_oauth_state');

  return redirectResponse;
}
