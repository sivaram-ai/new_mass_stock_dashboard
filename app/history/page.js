import { requireUser } from '@/lib/auth';
import HistoryClient from './HistoryClient';

export const metadata = { title: 'History · New Mass Stock' };
export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  await requireUser();
  return <HistoryClient />;
}
