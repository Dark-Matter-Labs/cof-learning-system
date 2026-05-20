import { createHmac, timingSafeEqual } from 'crypto';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Verifies a Slack request signature.
 *
 * Slack signs every request with HMAC-SHA256 of:
 *   "v0:" + timestamp + ":" + rawBody
 *
 * The result is compared timing-safely against the X-Slack-Signature header.
 * Timestamps older than 5 minutes are rejected to prevent replay attacks.
 *
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  rawBody: string,
): boolean {
  // Reject if timestamp is missing or non-numeric
  const ts = parseInt(timestamp, 10);
  if (!timestamp || isNaN(ts)) {
    return false;
  }

  // Reject stale requests (>5 minutes old)
  const ageMs = Date.now() - ts * 1000;
  if (ageMs > FIVE_MINUTES_MS || ageMs < -FIVE_MINUTES_MS) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = createHmac('sha256', signingSecret);
  hmac.update(baseString);
  const computedSignature = `v0=${hmac.digest('hex')}`;

  // Timing-safe comparison to prevent timing attacks
  if (computedSignature.length !== signature.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(computedSignature, 'utf8'),
    Buffer.from(signature, 'utf8'),
  );
}
