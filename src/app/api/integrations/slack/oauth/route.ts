import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET /api/integrations/slack/oauth
 *
 * Redirects the authenticated user to Slack's OAuth v2 authorization page.
 * Stores a CSRF state token in a short-lived cookie, verified in the callback.
 *
 * Required Slack OAuth scopes:
 *   commands          — receive slash command payloads
 *   chat:write        — post ephemeral confirmations
 *   chat:write.public — post to channels the bot isn't a member of (optional)
 */

const SLACK_OAUTH_URL = 'https://slack.com/oauth/v2/authorize';
const STATE_COOKIE_NAME = 'slack_oauth_state';
const STATE_COOKIE_MAX_AGE_SECONDS = 600; // 10 minutes

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Slack integration is not configured' }, { status: 500 });
  }

  // Generate a random state value for CSRF protection
  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  const state = Buffer.from(stateBytes).toString('hex');

  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/integrations/slack/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'commands,chat:write',
    redirect_uri: redirectUri,
    state,
  });

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });

  return NextResponse.redirect(`${SLACK_OAUTH_URL}?${params.toString()}`);
}
