import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/requireAdmin';
import { validateUserCreate } from '@/lib/validation';
import { listUsers } from '@/lib/adminData';

export const dynamic = 'force-dynamic';

/** GET /api/admin/users — list staff accounts with their roles. Admin only. */
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data, error } = await listUsers(supabase);

  if (error) {
    console.error('users list failed', error);
    return Response.json({ error: 'Could not load users' }, { status: 500 });
  }
  return Response.json({ data });
}

/** POST /api/admin/users — create an auth user and its profile. Admin only. */
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = validateUserCreate(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const { email, password, roleId, fullName } = parsed.value;

  const supabase = createAdminClient();

  // Fail fast on a bad role rather than creating an auth user we'd have to undo.
  const { data: roleRow, error: roleErr } = await supabase
    .from('custom_roles')
    .select('id')
    .eq('id', roleId)
    .maybeSingle();

  if (roleErr) {
    console.error('role lookup failed', roleErr);
    return Response.json({ error: 'Role lookup failed' }, { status: 500 });
  }
  if (!roleRow) {
    return Response.json({ error: 'That role no longer exists' }, { status: 400 });
  }

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !created?.user) {
    const duplicate = authError?.status === 422 || authError?.code === 'email_exists';
    console.error('auth user creation failed', authError);
    return Response.json(
      { error: duplicate ? 'That email is already registered' : 'Account creation failed' },
      { status: duplicate ? 409 : 500 }
    );
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert([{ id: created.user.id, email, full_name: fullName, role_id: roleId }]);

  if (profileError) {
    // Compensate — never leave an auth user stranded without a profile, since
    // it could not sign in to anything useful and would block the email.
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(created.user.id);
    if (cleanupError) {
      console.error(
        'CRITICAL: profile insert failed AND rollback failed — orphaned auth user',
        { userId: created.user.id, profileError, cleanupError }
      );
    } else {
      console.error('profile insert failed, auth user rolled back', profileError);
    }
    return Response.json({ error: 'Account provisioning failed' }, { status: 500 });
  }

  return Response.json({ success: true, userId: created.user.id });
}
