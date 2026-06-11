/**
 * Returns true only when `path` is a storage object owned by `userId`.
 *
 * Uploads are written as `${userId}/${uuid}.${ext}` (see /api/upload), so a
 * legitimate path is exactly `<userId>/<filename>`. The capture → process
 * pipeline downloads attachments with the service-role client, which bypasses
 * storage RLS, so the path must be validated here before it is trusted.
 */
export function isOwnedStoragePath(path: unknown, userId: unknown): boolean {
  if (typeof path !== 'string' || typeof userId !== 'string') return false;
  if (path.length === 0 || userId.length === 0) return false;

  // Reject traversal / encoded traversal outright.
  if (path.includes('..') || path.includes('%2e') || path.includes('%2f')) return false;

  const prefix = `${userId}/`;
  if (!path.startsWith(prefix)) return false;

  // Must have a non-empty file segment after the prefix, and no further nesting
  // into another directory (uploads are flat: `<userId>/<file>`).
  const rest = path.slice(prefix.length);
  return rest.length > 0 && !rest.includes('/');
}
