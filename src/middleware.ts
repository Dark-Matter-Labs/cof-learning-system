import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Webhook routes receive unauthenticated requests from external services;
  // they verify identity via HMAC signatures instead of Supabase sessions.
  const WEBHOOK_PATHS = [
    '/api/integrations/slack/events',
    '/api/integrations/notion/webhook',
    '/api/integrations/folk/sync',
  ];
  const { pathname } = request.nextUrl;
  const isWebhook = WEBHOOK_PATHS.some((p) => pathname.startsWith(p));
  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/api/auth') || isWebhook;

  if (!user && !isPublic) {
    // API routes get a 401 JSON envelope (matching withAuth) — fetch clients
    // can't follow a login redirect and would otherwise receive an opaque 307
    // to an HTML page. Page navigations still redirect to /login.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
