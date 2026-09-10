import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = ['/login', '/auth'];

/**
 * Runs on every request: refreshes the Supabase session cookie and bounces
 * signed-out visitors to /login. Pages still re-check auth server-side —
 * middleware is a convenience redirect, not the security boundary.
 */
export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not insert logic between createServerClient and getUser(): getUser()
  // is what actually refreshes the token, and skipping it at random makes
  // sessions expire unpredictably.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // API routes authenticate themselves — /api/admin/* takes a bearer token,
  // which this middleware cannot see because it only reads session cookies.
  // Redirecting them would hand callers a 200 HTML login page instead of the
  // route's own 401/403 JSON, so let them through and let the route answer.
  const isApi = pathname.startsWith('/api/');

  if (!user && !isPublic && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Remember where they were headed so login can send them back.
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets. API routes are
     * included so their session cookies stay fresh too.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
