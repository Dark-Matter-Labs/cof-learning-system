import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}));

import { withAuth, ok, fail } from '../withAuth';

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const handler = vi.fn();
    const res = await withAuth(handler)(new Request('http://t/'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 when getUser errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } });
    const handler = vi.fn();
    const res = await withAuth(handler)(new Request('http://t/'));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('invokes the handler with user, supabase, request, and params when authed', async () => {
    const user = { id: 'user-1' };
    mockGetUser.mockResolvedValue({ data: { user }, error: null });
    const handler = vi.fn(async (ctx) => ok({ seen: ctx.user.id }));
    const req = new Request('http://t/');
    const paramsPromise = Promise.resolve({ id: 'abc' });

    const res = await withAuth<{ id: string }>(handler)(req, { params: paramsPromise });

    expect(handler).toHaveBeenCalledOnce();
    const ctx = handler.mock.calls[0][0];
    expect(ctx.user).toBe(user);
    expect(ctx.request).toBe(req);
    expect(ctx.params).toBe(paramsPromise);
    expect(ctx.supabase).toBeTruthy();
    expect(await res.json()).toEqual({ data: { seen: 'user-1' } });
  });
});

describe('ok / fail envelopes', () => {
  it('ok wraps data and defaults to 200', async () => {
    const res = ok({ a: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { a: 1 } });
  });

  it('ok honours an init (e.g. 201)', () => {
    expect(ok({ a: 1 }, { status: 201 }).status).toBe(201);
  });

  it('fail wraps an error message with status and extra fields', async () => {
    const res = fail('Invalid payload', 400, { details: ['x: required'] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid payload', details: ['x: required'] });
  });

  it('fail defaults to status 400', () => {
    expect(fail('nope').status).toBe(400);
  });
});
