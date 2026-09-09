/**
 * Seeds the default Admin account.
 *
 *   npm run seed:admin
 *
 * Idempotent: re-running it resets the password and repairs a missing or
 * wrongly-roled profile row rather than failing. Run the SQL migration first —
 * this script needs `custom_roles` and `profiles` to exist.
 *
 * Deliberately uses plain fetch rather than @supabase/supabase-js: the SDK
 * eagerly builds a realtime client, which throws on Node 20 because it has no
 * native WebSocket. Everything here is REST, so the SDK buys us nothing.
 */
import { readFileSync } from 'fs';

// Load .env.local ourselves rather than relying on `node --env-file`, which
// only exists on Node 20.6+. Anything already in the environment wins.
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
} catch {
  // No .env.local — the explicit checks below will report what is missing.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.SEED_ADMIN_EMAIL || 'riyas@newmass.com').trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
const fullName = process.env.SEED_ADMIN_NAME || 'Riyas';

function fail(message) {
  console.error(`\n  x ${message}\n`);
  process.exit(1);
}

if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is not set. Is .env.local present?');
if (!serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY is not set. Is .env.local present?');
if (!password) fail('SEED_ADMIN_PASSWORD is not set. Add it to .env.local.');

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function api(path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { ok: response.ok, status: response.status, body };
}

async function findUserByEmail(target) {
  // The admin list is paginated; walk it rather than assuming the account is
  // on page one, which stops being true once there are >200 staff.
  for (let page = 1; page <= 20; page += 1) {
    const { ok, body } = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    if (!ok) throw new Error(`Could not list users: ${JSON.stringify(body)}`);

    const users = body?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match;
    if (users.length < 200) return null;
  }
  return null;
}

async function main() {
  console.log(`\n  Seeding Admin account for ${email}...\n`);

  const roleRes = await api('/rest/v1/custom_roles?role_name=eq.Admin&select=id,role_name');

  if (roleRes.status === 404 || roleRes.body?.code === 'PGRST205') {
    fail(
      'The custom_roles table does not exist yet.\n' +
        '    Run supabase/migrations/0001_init.sql in the Supabase SQL editor first:\n' +
        '    Dashboard -> SQL Editor -> New query -> paste the file -> Run.'
    );
  }
  if (!roleRes.ok) {
    fail(`Could not read custom_roles: ${JSON.stringify(roleRes.body)}`);
  }

  const role = roleRes.body?.[0];
  if (!role) {
    fail(
      "No 'Admin' role found in custom_roles.\n" +
        '    Re-run supabase/migrations/0001_init.sql — it seeds the three default roles.'
    );
  }
  console.log(`  - Admin role found (${role.id})`);

  let user = await findUserByEmail(email);

  if (user) {
    console.log('  - Auth user already exists, resetting the password');
    const res = await api(`/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password, email_confirm: true }),
    });
    if (!res.ok) fail(`Could not update the existing user: ${JSON.stringify(res.body)}`);
  } else {
    const res = await api('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!res.ok) fail(`Could not create the auth user: ${JSON.stringify(res.body)}`);
    user = res.body;
    console.log(`  - Auth user created (${user.id})`);
  }

  // Upsert on the primary key: safe whether the profile is missing or stale.
  const profileRes = await api('/rest/v1/profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([{ id: user.id, email, full_name: fullName, role_id: role.id }]),
  });

  if (!profileRes.ok) {
    fail(`Could not write the profile row: ${JSON.stringify(profileRes.body)}`);
  }
  console.log('  - Profile row linked to the Admin role');

  console.log('\n  Done. Sign in at http://localhost:3000/login\n');
  console.log(`      Email:    ${email}`);
  console.log(`      Password: ${password}\n`);
  console.log('  Change this password once you are in.\n');
}

main().catch((err) => fail(err.message));
