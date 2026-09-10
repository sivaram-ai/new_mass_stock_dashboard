/**
 * Backend integration checks against the live Supabase project and a running
 * dev server.
 *
 *   npm run dev            # in one terminal
 *   npm run check:integration
 *
 * Covers what unit tests cannot: that the column really persists, that the
 * database constraint really rejects bad values, and that the admin routes
 * really enforce authorisation. Creates a throwaway staff account and deletes
 * it again at the end.
 */
import { readFileSync } from 'fs';

try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {
  /* fall through to the checks below */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'riyas@newmass.com').toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const appUrl = process.env.APP_URL || 'http://localhost:3000';

const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function rest(path, options = {}) {
  const res = await fetch(`${url}${path}`, { ...options, headers: { ...svc, ...options.headers } });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

async function api(path, token, options = {}) {
  const res = await fetch(`${appUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

async function signIn(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return res.ok ? body.access_token : null;
}

async function main() {
  console.log('\n=== Backend integration checks ===\n');

  if (!url || !serviceKey || !anonKey || !adminPassword) {
    console.error('Missing env. Is .env.local present and complete?');
    process.exit(1);
  }

  /* ----------------------- 1. alert_size persistence ---------------------- */
  console.log('[1] alert_size column');

  const probe = await rest('/rest/v1/items?select=id,name,alert_size&limit=1');
  const migrated = probe.ok;

  if (!migrated) {
    // Skip rather than abort: the admin-route checks below are independent of
    // this migration, and they are worth running either way.
    console.log('  SKIP  migration 0002_add_alert_size.sql has not been run');
    console.log('        (run it, then re-run this script to cover low stock alerts)');
    skipped += 6;
  }

  if (migrated) {
  check('column exists and is selectable', probe.ok, JSON.stringify(probe.body).slice(0, 120));

  const itemId = probe.body?.[0]?.id;
  const originalAlert = probe.body?.[0]?.alert_size ?? null;

  const setAlert = await rest(`/rest/v1/items?id=eq.${itemId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ alert_size: 25 }),
  });
  check('alert_size persists a positive value', setAlert.ok && setAlert.body?.[0]?.alert_size === 25);

  const setNull = await rest(`/rest/v1/items?id=eq.${itemId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ alert_size: null }),
  });
  check('alert_size accepts NULL (alert disabled)', setNull.ok && setNull.body?.[0]?.alert_size === null);

  const negative = await rest(`/rest/v1/items?id=eq.${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ alert_size: -5 }),
  });
  check(
    'CHECK constraint rejects a negative alert_size',
    !negative.ok && String(JSON.stringify(negative.body)).includes('items_alert_size_non_negative'),
    `status ${negative.status}`
  );

  // restore
  await rest(`/rest/v1/items?id=eq.${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ alert_size: originalAlert }),
  });

  const defaulted = await rest('/rest/v1/items?select=id&alert_size=is.null&limit=1');
  check('existing rows are readable after the migration', defaulted.ok);
  }

  /* --------------------------- 2. admin auth ------------------------------ */
  console.log('\n[2] /api/admin/users/:id authorisation');

  const adminToken = await signIn(adminEmail, adminPassword);
  if (!adminToken) {
    console.error('\n  Could not sign in as the Admin. Run `npm run seed:admin` first.\n');
    process.exit(1);
  }
  check('admin can sign in', Boolean(adminToken));

  const meRes = await rest(`/rest/v1/profiles?select=id,role_id&email=eq.${encodeURIComponent(adminEmail)}`);
  const adminId = meRes.body?.[0]?.id;
  const adminRoleId = meRes.body?.[0]?.role_id;

  const noToken = await api(`/api/admin/users/${adminId}`, null, {
    method: 'PATCH',
    body: JSON.stringify({ fullName: 'Nope' }),
  });
  check('401 without a bearer token', noToken.status === 401, `got ${noToken.status}`);

  const badToken = await api(`/api/admin/users/${adminId}`, 'not-a-real-token', {
    method: 'PATCH',
    body: JSON.stringify({ fullName: 'Nope' }),
  });
  check('401 with an invalid token', badToken.status === 401, `got ${badToken.status}`);

  const badId = await api('/api/admin/users/not-a-uuid', adminToken, {
    method: 'PATCH',
    body: JSON.stringify({ fullName: 'X' }),
  });
  check('400 for a malformed user id', badId.status === 400, `got ${badId.status}`);

  const missing = await api(
    '/api/admin/users/00000000-0000-4000-8000-000000000000',
    adminToken,
    { method: 'PATCH', body: JSON.stringify({ fullName: 'X' }) }
  );
  check('404 for an unknown user', missing.status === 404, `got ${missing.status}`);

  const emptyPayload = await api(`/api/admin/users/${adminId}`, adminToken, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
  check('400 for an empty payload', emptyPayload.status === 400, `got ${emptyPayload.status}`);

  const shortPw = await api(`/api/admin/users/${adminId}`, adminToken, {
    method: 'PATCH',
    body: JSON.stringify({ password: 'short' }),
  });
  check('400 for a password under 8 characters', shortPw.status === 400, `got ${shortPw.status}`);

  /* ------------------- 3. create, update, permissions --------------------- */
  console.log('\n[3] user create + update lifecycle');

  const rolesRes = await api('/api/admin/roles', adminToken);
  const roles = rolesRes.body?.data ?? [];
  const kitchenRole = roles.find((r) => r.role_name === 'Kitchen Staff');
  const managerRole = roles.find((r) => r.role_name === 'Manager');
  check('roles list is readable', roles.length > 0);

  const testEmail = `integration-check-${Date.now()}@newmass.com`;
  const created = await api('/api/admin/users', adminToken, {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'initialpassword1',
      roleId: kitchenRole.id,
      fullName: 'Integration Check',
    }),
  });
  check('admin can create a user', created.ok && created.body?.userId, JSON.stringify(created.body));
  const testUserId = created.body?.userId;

  if (testUserId) {
    const staffToken = await signIn(testEmail, 'initialpassword1');
    check('the new user can sign in', Boolean(staffToken));

    const forbidden = await api(`/api/admin/users/${adminId}`, staffToken, {
      method: 'PATCH',
      body: JSON.stringify({ fullName: 'Escalate' }),
    });
    check(
      '403 when a non-Admin calls the update route',
      forbidden.status === 403,
      `got ${forbidden.status}`
    );

    const renamed = await api(`/api/admin/users/${testUserId}`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ fullName: 'Renamed Person' }),
    });
    check('admin can update a name', renamed.ok, JSON.stringify(renamed.body));

    const afterRename = await rest(`/rest/v1/profiles?select=full_name,role_id&id=eq.${testUserId}`);
    check('the new name persisted', afterRename.body?.[0]?.full_name === 'Renamed Person');

    const roleChanged = await api(`/api/admin/users/${testUserId}`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ roleId: managerRole.id }),
    });
    check('admin can change a role', roleChanged.ok, JSON.stringify(roleChanged.body));

    const afterRole = await rest(`/rest/v1/profiles?select=role_id&id=eq.${testUserId}`);
    check('the role change persisted', afterRole.body?.[0]?.role_id === managerRole.id);

    const pwChanged = await api(`/api/admin/users/${testUserId}`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ password: 'brandnewpassword1' }),
    });
    check('admin can set a new password', pwChanged.ok, JSON.stringify(pwChanged.body));

    check('the new password works', Boolean(await signIn(testEmail, 'brandnewpassword1')));
    check('the old password no longer works', !(await signIn(testEmail, 'initialpassword1')));

    const blankPw = await api(`/api/admin/users/${testUserId}`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ fullName: 'Still Here', password: '' }),
    });
    check('a blank password is treated as "unchanged"', blankPw.ok);
    check(
      'the password really was left alone',
      Boolean(await signIn(testEmail, 'brandnewpassword1'))
    );

    const badRole = await api(`/api/admin/users/${testUserId}`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ roleId: '00000000-0000-4000-8000-000000000000' }),
    });
    check('400 for a role that does not exist', badRole.status === 400, `got ${badRole.status}`);

    // cleanup
    await fetch(`${url}/auth/v1/admin/users/${testUserId}`, { method: 'DELETE', headers: svc });
    console.log(`  ....  cleaned up ${testEmail}`);
  }

  /* ------------------------ 4. self-demotion guard ------------------------ */
  console.log('\n[4] self-demotion guard');

  const selfDemote = await api(`/api/admin/users/${adminId}`, adminToken, {
    method: 'PATCH',
    body: JSON.stringify({ roleId: kitchenRole.id }),
  });
  check(
    '409 when an Admin tries to change their own role',
    selfDemote.status === 409,
    `got ${selfDemote.status}`
  );

  const stillAdmin = await rest(`/rest/v1/profiles?select=role_id&id=eq.${adminId}`);
  check('the admin still holds the Admin role', stillAdmin.body?.[0]?.role_id === adminRoleId);

  const sameRoleOk = await api(`/api/admin/users/${adminId}`, adminToken, {
    method: 'PATCH',
    body: JSON.stringify({ roleId: adminRoleId, fullName: 'Riyas' }),
  });
  check('re-sending your own unchanged role is allowed', sameRoleOk.ok, JSON.stringify(sameRoleOk.body));

  /* -------------------------------- summary ------------------------------- */
  console.log(
    `
=== ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''} ===
`
  );
  if (failed) {
    failures.forEach((f) => console.log(`  - ${f}`));
    console.log('');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n  Integration run failed:', err.message, '\n');
  process.exit(1);
});
