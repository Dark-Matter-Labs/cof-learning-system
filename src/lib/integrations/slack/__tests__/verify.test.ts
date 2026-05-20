import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifySlackSignature } from '../verify';

const TEST_SECRET = 'test-signing-secret-abc123';

function makeSignature(secret: string, timestamp: string, body: string): string {
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(baseString);
  return `v0=${hmac.digest('hex')}`;
}

function nowSeconds(): string {
  return Math.floor(Date.now() / 1000).toString();
}

describe('verifySlackSignature', () => {
  it('returns true for a valid signature', () => {
    const timestamp = nowSeconds();
    const body = 'command=%2Fcof&text=hello&user_id=U123';
    const signature = makeSignature(TEST_SECRET, timestamp, body);

    expect(verifySlackSignature(TEST_SECRET, signature, timestamp, body)).toBe(true);
  });

  it('returns false when the signature is wrong', () => {
    const timestamp = nowSeconds();
    const body = 'command=%2Fcof&text=hello&user_id=U123';
    const wrongSignature = makeSignature('wrong-secret', timestamp, body);

    expect(verifySlackSignature(TEST_SECRET, wrongSignature, timestamp, body)).toBe(false);
  });

  it('returns false when the body has been tampered with', () => {
    const timestamp = nowSeconds();
    const originalBody = 'command=%2Fcof&text=hello';
    const tamperedBody = 'command=%2Fcof&text=injected';
    const signature = makeSignature(TEST_SECRET, timestamp, originalBody);

    expect(verifySlackSignature(TEST_SECRET, signature, timestamp, tamperedBody)).toBe(false);
  });

  it('returns false when the timestamp is older than 5 minutes', () => {
    const staleTimestamp = Math.floor(Date.now() / 1000 - 310).toString(); // >5min ago
    const body = 'command=%2Fcof';
    const signature = makeSignature(TEST_SECRET, staleTimestamp, body);

    expect(verifySlackSignature(TEST_SECRET, signature, staleTimestamp, body)).toBe(false);
  });

  it('returns false when the timestamp is missing', () => {
    const body = 'command=%2Fcof';
    const signature = makeSignature(TEST_SECRET, '', body);

    expect(verifySlackSignature(TEST_SECRET, signature, '', body)).toBe(false);
  });

  it('returns false when the timestamp is non-numeric', () => {
    const body = 'command=%2Fcof';
    const signature = makeSignature(TEST_SECRET, 'not-a-number', body);

    expect(verifySlackSignature(TEST_SECRET, signature, 'not-a-number', body)).toBe(false);
  });

  it('returns false when the signature prefix is wrong', () => {
    const timestamp = nowSeconds();
    const body = 'command=%2Fcof';
    const hmac = createHmac('sha256', TEST_SECRET);
    hmac.update(`v0:${timestamp}:${body}`);
    const badPrefixSignature = `v1=${hmac.digest('hex')}`; // wrong prefix

    expect(verifySlackSignature(TEST_SECRET, badPrefixSignature, timestamp, body)).toBe(false);
  });
});
