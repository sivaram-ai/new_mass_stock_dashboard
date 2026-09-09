import { requireUser } from '@/lib/auth';
import ViewClient from './ViewClient';

export const metadata = { title: 'View Items · New Mass Stock' };
export const dynamic = 'force-dynamic';

export default async function ViewItemsPage() {
  const user = await requireUser();
  return <ViewClient roleName={user.roleName} />;
}
