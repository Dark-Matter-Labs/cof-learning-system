/**
 * Application-layer token encryption using AES-256-GCM.
 *
 * Key source: INTEGRATION_TOKEN_ENCRYPTION_KEY environment variable.
 * Must be a 64-character hex string (32 bytes).
 * Generate with: openssl rand -hex 32
 *
 * Each encrypted token gets a unique random IV stored alongside the ciphertext.
 * The auth tag (16 bytes) is appended to the ciphertext.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const hexKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error('INTEGRATION_TOKEN_ENCRYPTION_KEY is not configured');
  }
  if (hexKey.length !== 64) {
    throw new Error(
      'INTEGRATION_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'
    );
  }
  return Buffer.from(hexKey, 'hex');
}

export interface EncryptedToken {
  /** Base64-encoded ciphertext + GCM auth tag */
  readonly ciphertext: string;
  /** Base64-encoded IV */
  readonly iv: string;
}

/**
 * Encrypts a plaintext token string.
 * Returns ciphertext and IV as base64 strings for database storage.
 */
export function encryptToken(plaintext: string): EncryptedToken {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
  };
}

/**
 * Decrypts a token encrypted by encryptToken.
 */
export function decryptToken(ciphertext: string, ivBase64: string): string {
  const key = getKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const encryptedBuf = Buffer.from(ciphertext, 'base64');

  const tag = encryptedBuf.subarray(encryptedBuf.length - TAG_LENGTH);
  const ciphertextBuf = encryptedBuf.subarray(0, encryptedBuf.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertextBuf), decipher.final()]).toString('utf8');
}
