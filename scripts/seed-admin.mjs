/**
 * Seeds the default Admin account.
 *
 *   npm run seed:admin
 *
 * Idempotent: re-running it resets the password and repairs a missing or
 * wrongly-roled profile row rather than failing. Run the SQL migration first —
 * this script needs `custom_roles` and `profiles` to exist.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.SEED_ADMIN_EMAIL || 'riyas@newmass.com').trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
const fullName = process.env.SEED_ADMIN_NAME || 'Riyas';

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is not set. Is .env.local present?');
if (!serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY is not set. Is .env.local present?');
if (!password) fail('SEED_ADMIN_PASSWORD is not set. Add it to .env.local.');

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(target) {
  // listUsers is paginated; walk it rather than assuming the account is on
  // page one, which stops being true once there are >50 staff.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not list users: ${error.message}`);

    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  console.log(`\n  Seeding Admin account for ${email}…\n`);

  const { data: role, error: roleError } = await supabase
    .from('custom_roles')
    .select('id, role_name')
    .eq('role_name', 'Admin')
    .maybeSingle();

  if (roleError) {
    fail(
      `Could not read custom_roles: ${roleError.message}\n` +
        '    Run supabase/migrations/0001_init.sql in the Supabase SQL editor first.'
    );
  }
  if (!role) {
    fail(
      "No 'Admin' role found in custom_roles.\n" +
        '    Run supabase/migrations/0001_init.sql in the Supabase SQL editor first.'
    );
  }
  console.log(`  · Admin role found (${role.id})`);

  let user = await findUserByEmail(email);

  if (user) {
    console.log('  · Auth user already exists — resetting the password');
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (error) fail(`Could not update the existing user: ${error.message}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) fail(`Could not create the auth user: ${error.message}`);
    user = data.user;
    console.log(`  · Auth user created (${user.id})`);
  }

  // upsert keeps this safe whether the profile is missing, stale, or correct.
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, email, full_name: fullName, role_id: role.id },
      { onConflict: 'id' }
    );

  if (profileError) fail(`Could not write the profile row: ${profileError.message}`);
  console.log('  · Profile row linked to the Admin role');

  console.log('\n  ✓ Done. Sign in at http://localhost:3000/login\n');
  console.log(`      Email:    ${email}`);
  console.log(`      Password: ${password}\n`);
  console.log('  Change this password once you are in.\n');
}

main().catch((err) => fail(err.message));
