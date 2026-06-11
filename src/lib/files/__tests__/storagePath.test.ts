import { describe, it, expect } from 'vitest';
import { isOwnedStoragePath } from '../storagePath';

const USER = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

describe('isOwnedStoragePath', () => {
  it('accepts a path owned by the user (uploads are `${userId}/<uuid>.<ext>`)', () => {
    expect(isOwnedStoragePath(`${USER}/abc-123.pdf`, USER)).toBe(true);
  });

  it("rejects another user's path", () => {
    expect(isOwnedStoragePath(`${OTHER}/abc-123.pdf`, USER)).toBe(false);
  });

  it('rejects path traversal attempts', () => {
    expect(isOwnedStoragePath(`${USER}/../${OTHER}/secret.pdf`, USER)).toBe(false);
    expect(isOwnedStoragePath(`${USER}/..%2f${OTHER}/x.pdf`, USER)).toBe(false);
  });

  it('rejects a bare userId with no file, or the prefix as a substring trick', () => {
    expect(isOwnedStoragePath(USER, USER)).toBe(false);
    expect(isOwnedStoragePath(`${USER}-evil/x.pdf`, USER)).toBe(false);
  });

  it('rejects empty/invalid inputs', () => {
    expect(isOwnedStoragePath('', USER)).toBe(false);
    expect(isOwnedStoragePath(`${USER}/x.pdf`, '')).toBe(false);
    expect(isOwnedStoragePath(null, USER)).toBe(false);
  });
});
