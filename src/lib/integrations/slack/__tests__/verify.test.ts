import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import { verifySlackSignature, SlackVerificationError } from '../verify';

const TEST_SIGNING_SECRET = 'test_signing_secret_32bytes_pad00';
const TEST_RAW_BODY = 'token=test&team_id=T123&command=%2Fcapture&text=hello';

function makeTimestamp(offsetMs = 0): string {
  return String(Math.floor((Date.now() + offsetMs) / 1000));
}

function makeSignature(secret: string, timestamp: string, body: string): string {
  const base = `v0:${timestamp}:${body}`;
  return 'v0=' + createHmac('sha256', secret).update(base).digest('hex');
}

function makeHeaders(
  timestamp: string,
  signature: string
): { get(name: string): string | null } {
  const map: Record<string, string> = {
    'x-slack-request-timestamp': timestamp,
    'x-slack-signature': signature,
  };
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

describe('verifySlackSignature', () => {
  beforeEach(() => {
    process.env.SLACK_SIGNING_SECRET = TEST_SIGNING_SECRET;
  });

  afterEach(() => {
    delete process.env.SLACK_SIGNING_SECRET;
    vi.restoreAllMocks();
  });

  it('accepts a valid signature with a fresh timestamp', () => {
    const ts = makeTimestamp();
    const sig = makeSignature(TEST_SIGNING_SECRET, ts, TEST_RAW_BODY);
    const headers = makeHeaders(ts, sig);

    expect(() => verifySlackSignature(headers, TEST_RAW_BODY)).not.toThrow();
  });

  it('throws when X-Slack-Signature header is missing', () => {
    const ts = makeTimestamp();
    const headersMissing = {
      get: (name: string) =>
        name === 'x-slack-request-timestamp' ? ts : null,
    };

    expect(() => verifySlackSignature(headersMissing, TEST_RAW_BODY)).toThrow(
      SlackVerificationError
    );
  });

  it('throws when X-Slack-Request-Timestamp header is missing', () => {
    const sig = makeSignature(TEST_SIGNING_SECRET, makeTimestamp(), TEST_RAW_BODY);
    const headers = {
      get: (name: string) => (name === 'x-slack-signature' ? sig : null),
    };

    expect(() => verifySlackSignature(headers, TEST_RAW_BODY)).toThrow(
      SlackVerificationError
    );
  });

  it('throws when timestamp is older than 5 minutes', () => {
    const staleTs = makeTimestamp(-6 * 60 * 1000); // 6 minutes ago
    const sig = makeSignature(TEST_SIGNING_SECRET, staleTs, TEST_RAW_BODY);
    const headers = makeHeaders(staleTs, sig);

    expect(() => verifySlackSignature(headers, TEST_RAW_BODY)).toThrow(
      SlackVerificationError
    );
    expect(() => verifySlackSignature(headers, TEST_RAW_BODY)).toThrow(
      /stale/i
    );
  });

  it('throws when timestamp is in the future beyond 5 minutes', () => {
    const futureTs = makeTimestamp(6 * 60 * 1000); // 6 minutes in future
    const sig = makeSignature(TEST_SIGNING_SECRET, futureTs, TEST_RAW_BODY);
    const headers = makeHeaders(futureTs, sig);

    expect(() => verifySlackSignature(headers, TEST_RAW_BODY)).toThrow(
      SlackVerificationError
    );
  });

  it('throws when signature does not match (wrong secret)', () => {
    const ts = makeTimestamp();
    const wrongSig = makeSignature('wrong_secret_for_testing_purposes!', ts, TEST_RAW_BODY);
    const headers = makeHeaders(ts, wrongSig);

    expect(() => verifySlackSignature(headers, TEST_RAW_BODY)).toThrow(
      SlackVerificationError
    );
    expect(() => verifySlackSignature(headers, TEST_RAW_BODY)).toThrow(
      /mismatch/i
    );
  });

  it('throws when body has been tampered with', () => {
    const ts = makeTimestamp();
    const sig = makeSignature(TEST_SIGNING_SECRET, ts, TEST_RAW_BODY);
    const headers = makeHeaders(ts, sig);
    const tamperedBody = TEST_RAW_BODY + '&injected=evil';

    expect(() => verifySlackSignature(headers, tamperedBody)).toThrow(
      SlackVerificationError
    );
  });

  it('throws when SLACK_SIGNING_SECRET is not configured', () => {
    delete process.env.SLACK_SIGNING_SECRET;
    const ts = makeTimestamp();
    const sig = makeSignature(TEST_SIGNING_SECRET, ts, TEST_RAW_BODY);
    const headers = makeHeaders(ts, sig);

    expect(() => verifySlackSignature(headers, TEST_RAW_BODY)).toThrow(
      SlackVerificationError
    );
    expect(() => verifySlackSignature(headers, TEST_RAW_BODY)).toThrow(
      /SLACK_SIGNING_SECRET/
    );
  });

  it('accepts a timestamp at exactly 4 minutes 59 seconds ago', () => {
    const ts = makeTimestamp(-(4 * 60 + 59) * 1000);
    const sig = makeSignature(TEST_SIGNING_SECRET, ts, TEST_RAW_BODY);
    const headers = makeHeaders(ts, sig);

    expect(() => verifySlackSignature(headers, TEST_RAW_BODY)).not.toThrow();
  });
});
