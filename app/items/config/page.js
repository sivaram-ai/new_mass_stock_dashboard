import { requireRole } from '@/lib/auth';
import { CATALOGUE_ROLES } from '@/lib/constants';
import ConfigClient from './ConfigClient';

export const metadata = { title: 'Item Config · New Mass Stock' };
export const dynamic = 'force-dynamic';

/**
 * Admin and Manager only. The redirect here is the convenience gate; the real
 * enforcement is the `can_manage_items()` RLS policy on categories and items.
 */
export default async function ItemConfigPage() {
  const user = await requireRole(CATALOGUE_ROLES);
  return <ConfigClient roleName={user.roleName} />;
}
