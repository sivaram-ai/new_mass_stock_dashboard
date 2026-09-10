import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { buildHistoryQuery } from '@/lib/history';
import HistoryClient from './HistoryClient';

export const metadata = { title: 'History · New Mass Stock' };
export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const supabase = await createClient();

  // First page, default sort, no filters — pre-fetched alongside the filter
  // dropdown options so the log is populated on first paint, and concurrently
  // with the auth check rather than behind it. Every query here is RLS-scoped
  // to the caller. The client takes over on any filter, sort or page change.
  const [, historyRes, itemsRes, usersRes] = await Promise.all([
    requireUser(),
    buildHistoryQuery(supabase, { withCount: true }),
    supabase.from('items').select('id, name').order('name'),
    supabase.from('profiles').select('id, email, full_name').order('email'),
  ]);

  return (
    <HistoryClient
      initialRows={historyRes.data ?? []}
      initialTotal={historyRes.count ?? 0}
      initialItems={itemsRes.data ?? []}
      initialUsers={usersRes.data ?? []}
      initialError={historyRes.error?.message ?? ''}
    />
  );
}
