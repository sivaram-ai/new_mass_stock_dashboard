/**
 * Role and staff-account queries shared by the /api/admin/* routes and the
 * server-rendered admin page, so both return identically shaped rows.
 *
 * Every caller must have already established that the requester is an Admin —
 * these run on the service-role client, which bypasses RLS.
 */

export function listRoles(supabase) {
  return supabase
    .from('custom_roles')
    .select('id, role_name, description, created_at')
    .order('role_name');
}

export function listUsers(supabase) {
  return supabase
    .from('profiles')
    .select('id, email, full_name, created_at, custom_roles(id, role_name)')
    .order('created_at', { ascending: false });
}
