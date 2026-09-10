import { requireRole } from '@/lib/auth';
import { CATALOGUE_ROLES } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { ITEM_LIST_COLUMNS, selectItems } from '@/lib/items';
import ConfigClient from './ConfigClient';

export const metadata = { title: 'Item Config · New Mass Stock' };
export const dynamic = 'force-dynamic';

/**
 * Admin and Manager only. The redirect here is the convenience gate; the real
 * enforcement is the `can_manage_items()` RLS policy on categories and items.
 */
export default async function ItemConfigPage() {
  const supabase = await createClient();

  // Pre-fetched so the catalogue renders with the page rather than after a
  // client-side round trip, and concurrently with the role check rather than
  // behind it. Both queries are readable by any signed-in user under RLS, so
  // overlapping them exposes nothing the redirect would otherwise have stopped.
  const [, categoriesRes, itemsRes] = await Promise.all([
    requireRole(CATALOGUE_ROLES),
    supabase.from('categories').select('id, name').order('name'),
    selectItems(supabase, ITEM_LIST_COLUMNS, (query) =>
      query.order('display_order', { ascending: true }).order('name', { ascending: true })
    ),
  ]);

  return (
    <ConfigClient
      initialCategories={categoriesRes.data ?? []}
      initialItems={itemsRes.data ?? []}
      initialAlertsSupported={itemsRes.alertSizeSupported}
      initialError={(categoriesRes.error || itemsRes.error)?.message ?? ''}
    />
  );
}
