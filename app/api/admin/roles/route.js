import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/requireAdmin';
import { validateRoleCreate } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** GET /api/admin/roles — list roles. Any signed-in user (needed for dropdowns). */
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('custom_roles')
    .select('id, role_name, description, created_at')
    .order('role_name');

  if (error) {
    console.error('roles list failed', error);
    return Response.json({ error: 'Could not load roles' }, { status: 500 });
  }
  return Response.json({ data });
}

/** POST /api/admin/roles — create a role. Admin only. */
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

  const parsed = validateRoleCreate(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const { roleName, description } = parsed.value;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('custom_roles')
    .insert([{ role_name: roleName, description }])
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation on role_name
    if (error.code === '23505') {
      return Response.json({ error: `Role "${roleName}" already exists` }, { status: 409 });
    }
    console.error('role insert failed', error);
    return Response.json({ error: 'Could not create role' }, { status: 500 });
  }

  return Response.json({ success: true, data });
}
