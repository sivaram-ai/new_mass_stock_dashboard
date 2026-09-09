import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Current user + profile + role name, or null when signed out.
 * Uses getUser() rather than getSession() — getUser() revalidates the token
 * against Supabase, so a tampered cookie cannot forge a session server-side.
 */
export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role_id, custom_roles(id, role_name, description)')
    .eq('id', user.id)
    .maybeSingle();

  const email = profile?.email ?? user.email ?? '';

  return {
    id: user.id,
    email,
    fullName: profile?.full_name || email.split('@')[0] || 'User',
    roleId: profile?.role_id ?? null,
    roleName: profile?.custom_roles?.role_name ?? null,
    hasProfile: Boolean(profile),
  };
}

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
