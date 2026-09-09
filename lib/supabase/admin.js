import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Bypasses RLS entirely, so it must only ever be
 * constructed inside server code that has already authorised the caller.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
