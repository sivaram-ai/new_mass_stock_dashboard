import { requireRole } from '@/lib/auth';
import { ROLE_ADMIN } from '@/lib/constants';
import AdminClient from './AdminClient';

export const metadata = { title: 'Admin · New Mass Stock' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireRole([ROLE_ADMIN]);
  return <AdminClient />;
}
