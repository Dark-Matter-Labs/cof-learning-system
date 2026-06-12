import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Context handed to an authenticated route handler. `params` is the Next.js
 * dynamic-route params promise (Next 16 passes `{ params: Promise<...> }`);
 * `undefined` for non-dynamic routes. Await it inside the handler.
 */
export interface AuthedContext<P> {
  readonly request: Request;
  readonly user: User;
  readonly supabase: SupabaseClient;
  readonly params: Promise<P>;
}

type Handler<P> = (ctx: AuthedContext<P>) => Response | Promise<Response>;
type RouteContext<P> = { readonly params: Promise<P> };

/**
 * Wraps a route handler with the standard Supabase auth check, eliminating the
 * getUser()→401 boilerplate duplicated across ~40 routes. On an unauthenticated
 * request it returns a 401 JSON envelope (never a redirect — fetch clients get
 * a usable error). Otherwise it invokes the handler with the resolved user and
 * a server Supabase client.
 *
 *   export const GET = withAuth(async ({ user, supabase }) => ok(...))
 *   export const PATCH = withAuth<{ id: string }>(async ({ params }) => {
 *     const { id } = await params; ...
 *   })
 */
export function withAuth<P = Record<string, never>>(handler: Handler<P>) {
  return async (request: Request, context?: RouteContext<P>): Promise<Response> => {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return fail('Unauthorized', 401);
    }
    const params = context?.params ?? (Promise.resolve({}) as Promise<P>);
    return handler({ request, user, supabase, params });
  };
}

/** Standard success envelope: `{ data }`, 200 by default. */
export function ok<T>(data: T, init?: ResponseInit): Response {
  return NextResponse.json({ data }, init);
}

/** Standard error envelope: `{ error }` plus any extra fields, with a status. */
export function fail(error: string, status = 400, extra?: Record<string, unknown>): Response {
  return NextResponse.json({ error, ...extra }, { status });
}
