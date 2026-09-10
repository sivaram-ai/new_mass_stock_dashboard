import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Current user + profile + role name, or null when signed out.
 *
 * Wrapped in React's cache() so the root layout and the page it renders share
 * one result per request. Without it both called this independently, firing two
 * identical auth checks and two identical profile queries that then contended
 * with each other — measured at ~500ms each instead of ~60ms uncontended.
 *
 * Auth uses getClaims() rather than getUser(). This project signs JWTs with
 * ES256, so getClaims() verifies the signature locally with WebCrypto against a
 * cached JWKS — no network round trip — while getUser() called the Supabase
 * auth server on every request (measured 150-480ms each time). It still runs
 * through getSession() first, so an expired token is refreshed and the new
 * cookie written exactly as before; the refresh just happens when the token
 * actually expires instead of on every page view.
 *
 * The tradeoff: a session revoked mid-token stays valid locally until the
 * access token expires, rather than being caught on the next request. Access
 * tokens are short-lived and every write is still re-checked by RLS in the
 * database, so this does not widen what a revoked session can do.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role_id, custom_roles(id, role_name, description)')
    .eq('id', claims.sub)
    .maybeSingle();

  const email = profile?.email ?? claims.email ?? '';

  return {
    id: claims.sub,
    email,
    fullName: profile?.full_name || email.split('@')[0] || 'User',
    roleId: profile?.role_id ?? null,
    roleName: profile?.custom_roles?.role_name ?? null,
    hasProfile: Boolean(profile),
  };
});

/** Redirects to /login when signed out. Returns the user otherwise. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Redirects to /login when signed out, or to /dashboard when signed in without
 * one of `allowedRoles`.
 */
export async function requireRole(allowedRoles) {
  const user = await requireUser();
  if (!user.roleName || !allowedRoles.includes(user.roleName)) {
    redirect('/dashboard?denied=1');
  }
  return user;
}
