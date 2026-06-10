/**
 * Slack request signature verification.
 *
 * Algorithm (from https://api.slack.com/authentication/verifying-requests-from-slack):
 *   sigBaseString = "v0:" + timestamp + ":" + rawBody
 *   mySignature   = "v0=" + HMAC-SHA256(SLACK_SIGNING_SECRET, sigBaseString)
 *   compare mySignature to X-Slack-Signature header using timing-safe comparison
 *
 * Freshness check: reject if |now - timestamp| > 5 minutes.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/** Maximum age of a valid Slack request in milliseconds (5 minutes). */
const MAX_AGE_MS = 5 * 60 * 1000;

export class SlackVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlackVerificationError';
  }
}

/**
 * Verifies the Slack request signature.
 *
 * @param headers - The incoming request headers (ReadonlyHeaders or Headers)
 * @param rawBody - The raw request body string (must be read BEFORE any parsing)
 * @throws {SlackVerificationError} if the signature is missing, stale, or invalid
 */
export function verifySlackSignature(
  headers: Headers | { get(name: string): string | null },
  rawBody: string
): void {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    throw new SlackVerificationError('SLACK_SIGNING_SECRET is not configured');
  }

  const timestamp = headers.get('x-slack-request-timestamp');
  const slackSig = headers.get('x-slack-signature');

  if (!timestamp || !slackSig) {
    throw new SlackVerificationError(
      'Missing X-Slack-Request-Timestamp or X-Slack-Signature header'
    );
  }

  // Reject stale requests to prevent replay attacks
  const requestTimeMs = parseInt(timestamp, 10) * 1000;
  if (isNaN(requestTimeMs) || Math.abs(Date.now() - requestTimeMs) > MAX_AGE_MS) {
    throw new SlackVerificationError('Request timestamp is stale or invalid');
  }

  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const mySignature =
    'v0=' + createHmac('sha256', signingSecret).update(sigBaseString).digest('hex');

  // Timing-safe comparison to prevent timing attacks
  const expectedBuf = Buffer.from(mySignature, 'utf8');
  const receivedBuf = Buffer.from(slackSig, 'utf8');

  if (
    expectedBuf.length !== receivedBuf.length ||
    !timingSafeEqual(expectedBuf, receivedBuf)
  ) {
    throw new SlackVerificationError('Slack signature mismatch');
  }
}
