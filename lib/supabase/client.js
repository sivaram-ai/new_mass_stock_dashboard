'use client';

import { createBrowserClient } from '@supabase/ssr';

let client;

/**
 * Browser-side Supabase client. Memoised so every component shares one auth
 * state and one realtime socket instead of spawning a client per render.
 */
export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return client;
}
