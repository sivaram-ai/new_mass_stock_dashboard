import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Gate for the service-role API routes.
 *
 * The service role key bypasses RLS completely, so without this check the
 * /api/admin/* endpoints would let any anonymous caller mint an Admin account.
 * Expects `Authorization: Bearer <access_token>` from the signed-in user.
 *
 * @returns {Promise<{ok: true, userId: string} | {ok: false, status: number, error: string}>}
 */
export async function requireAdmin(request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Missing bearer token' };
  }

  const supabase = createAdminClient();

  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return { ok: false, status: 401, error: 'Invalid or expired session' };
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role_id, custom_roles(role_name)')
    .eq('id', userRes.user.id)
    .maybeSingle();

  if (profileErr || profile?.custom_roles?.role_name !== 'Admin') {
    return { ok: false, status: 403, error: 'Admin role required' };
  }

  return { ok: true, userId: userRes.user.id };
}
