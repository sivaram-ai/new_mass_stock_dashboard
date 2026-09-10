import { requireRole } from '@/lib/auth';
import { ROLE_ADMIN } from '@/lib/constants';
import { createAdminClient } from '@/lib/supabase/admin';
import { listRoles, listUsers } from '@/lib/adminData';
import AdminClient from './AdminClient';

export const metadata = { title: 'Admin · New Mass Stock' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // requireRole runs first: the service-role client below bypasses RLS, so it
  // must never be reached by anyone who is not an Admin.
  await requireRole([ROLE_ADMIN]);

  const supabase = createAdminClient();

  // Pre-fetched so the panel renders populated. The client keeps using the
  // /api/admin/* routes for every mutation and for refreshing afterwards.
  const [rolesRes, usersRes] = await Promise.all([listRoles(supabase), listUsers(supabase)]);

  return (
    <AdminClient
      initialRoles={rolesRes.data ?? []}
      initialUsers={usersRes.data ?? []}
      initialError={(rolesRes.error || usersRes.error) ? 'Could not load the admin panel' : ''}
    />
  );
}
