import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/requireAdmin';
import { isUuid, validateUserUpdate } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/users/:id — update a staff account. Admin only.
 *
 * Every field is optional; only what is supplied changes. Passwords go through
 * Supabase Auth's admin API, so they are hashed by the same code path that
 * hashes them at sign-up — this route never sees or stores a hash itself.
 */
export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return Response.json({ error: 'Invalid user id' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = validateUserUpdate(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const { fullName, password, roleId } = parsed.value;

  const supabase = createAdminClient();

  const { data: target, error: targetErr } = await supabase
    .from('profiles')
    .select('id, email, role_id')
    .eq('id', id)
    .maybeSingle();

  if (targetErr) {
    console.error('user lookup failed', targetErr);
    return Response.json({ error: 'User lookup failed' }, { status: 500 });
  }
  if (!target) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  if (roleId !== undefined) {
    // Changing your own role is how an Admin locks themselves — and possibly
    // everyone — out of user management. Requires a second admin, by design.
    if (id === auth.userId && roleId !== target.role_id) {
      return Response.json(
        { error: 'You cannot change your own role. Ask another Admin to do it.' },
        { status: 409 }
      );
    }

    const { data: role, error: roleErr } = await supabase
      .from('custom_roles')
      .select('id')
      .eq('id', roleId)
      .maybeSingle();

    if (roleErr) {
      console.error('role lookup failed', roleErr);
      return Response.json({ error: 'Role lookup failed' }, { status: 500 });
    }
    if (!role) {
      return Response.json({ error: 'That role no longer exists' }, { status: 400 });
    }
  }

  // Profile fields first. If the password change then fails, the caller is told
  // exactly what did land — the reverse order would leave someone holding a new
  // password they were never told about.
  const profilePatch = {};
  if (fullName !== undefined) profilePatch.full_name = fullName;
  if (roleId !== undefined) profilePatch.role_id = roleId;

  if (Object.keys(profilePatch).length > 0) {
    const { error: updateErr } = await supabase
      .from('profiles')
      .update(profilePatch)
      .eq('id', id);

    if (updateErr) {
      console.error('profile update failed', updateErr);
      return Response.json({ error: 'Could not update the account' }, { status: 500 });
    }
  }

  if (password !== undefined) {
    const { error: passwordErr } = await supabase.auth.admin.updateUserById(id, { password });

    if (passwordErr) {
      console.error('password update failed', passwordErr);
      const partial = Object.keys(profilePatch).length > 0;
      return Response.json(
        {
          error: partial
            ? 'Name and role were saved, but the password could not be changed.'
            : 'Could not change the password',
        },
        { status: 500 }
      );
    }
  }

  return Response.json({ success: true, userId: id });
}
