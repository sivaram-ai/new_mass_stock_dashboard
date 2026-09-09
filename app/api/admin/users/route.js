import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET /api/admin/users — list staff accounts with their roles. Admin only. */
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at, custom_roles(id, role_name)')
    .order('created_at', { ascending: false });

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

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const roleId = typeof body?.roleId === 'string' ? body.roleId.trim() : '';
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';

  if (!email || !password || !roleId) {
    return Response.json({ error: 'Email, password and role are all required' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'Enter a valid email address' }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

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
    .insert([{ id: created.user.id, email, full_name: fullName || null, role_id: roleId }]);

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
