import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { selectItems, ITEM_LIST_COLUMNS } from '@/lib/items';
import ViewClient from './ViewClient';

export const metadata = { title: 'View Items · New Mass Stock' };
export const dynamic = 'force-dynamic';

export default async function ViewItemsPage() {
  const supabase = await createClient();

  /*
   * Fetched here rather than in a client useEffect so the table renders with
   * its rows already in place. The page used to paint an empty shell, hydrate,
   * then fetch — 250-400ms of spinner after it had already appeared.
   *
   * The auth check runs alongside the data rather than gating it. These queries
   * use the caller's own RLS-scoped client, so a request without a valid
   * session reads nothing either way, and requireUser() still redirects before
   * anything renders. Awaiting it first only made every navigation pay the
   * profile lookup and the data query end to end instead of at once.
   */
  const [user, itemsRes, categoriesRes] = await Promise.all([
    requireUser(),
    selectItems(supabase, ITEM_LIST_COLUMNS),
    supabase.from('categories').select('id, name').order('name'),
  ]);

  return (
    <ViewClient
      roleName={user.roleName}
      initialItems={itemsRes.data ?? []}
      initialCategories={categoriesRes.data ?? []}
      initialAlertsSupported={itemsRes.alertSizeSupported}
      initialError={(itemsRes.error || categoriesRes.error)?.message ?? ''}
    />
  );
}
