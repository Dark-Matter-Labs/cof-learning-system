import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const SLACK_SCOPES = ['commands', 'chat:write'].join(',');

/**
 * GET /api/integrations/slack/install
 *
 * Redirects the user to Slack's OAuth authorization URL.
 * Generates a CSRF state token stored in an HttpOnly cookie.
 */
export async function GET(): Promise<NextResponse> {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Slack integration is not configured' },
      { status: 503 },
    );
  }

  const state = randomUUID();

  const redirectUri = `${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : ''}${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/integrations/slack/callback`;

  const slackUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackUrl.searchParams.set('client_id', clientId);
  slackUrl.searchParams.set('scope', SLACK_SCOPES);
  slackUrl.searchParams.set('state', state);
  if (redirectUri) {
    slackUrl.searchParams.set('redirect_uri', redirectUri);
  }

  const response = NextResponse.redirect(slackUrl.toString());

  // Store state in a secure, HttpOnly cookie for CSRF verification in callback
  response.cookies.set('__Host-slack_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  });

  return response;
}
