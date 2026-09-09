import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Boxes, FolderOpen, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Alert, Badge, Card, EmptyState } from '@/components/ui';

export const metadata = { title: 'Dashboard · New Mass Stock' };
export const dynamic = 'force-dynamic';

function StockPill({ value, unit }) {
  const out = Number(value) <= 0;
  return (
    <span
      className={[
        'tnum shrink-0 rounded-md px-2 py-1 text-sm font-semibold',
        out ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700',
      ].join(' ')}
    >
      {Number(value ?? 0)}
      {unit ? <span className="ml-1 text-xs font-normal opacity-70">{unit}</span> : null}
    </span>
  );
}

function Stat({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    red: 'bg-red-100 text-red-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    amber: 'bg-amber-100 text-amber-600',
  };
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="tnum text-xl font-semibold text-slate-900">{value}</p>
        <p className="truncate text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const [itemsRes, categoriesRes, activityRes] = await Promise.all([
    supabase
      .from('items')
      .select(
        'id, name, shortcut_code, size, unit, current_stock, is_important, display_order, category_id'
      )
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('categories').select('id, name').order('name'),
    supabase
      .from('inventory_history_view')
      .select('id, item_name, action_type, quantity_changed, new_total, user_name, created_at')
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const loadError = itemsRes.error || categoriesRes.error || activityRes.error;
  const items = itemsRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const activity = activityRes.data ?? [];

  const important = items.filter((item) => item.is_important);
  const outOfStock = items.filter((item) => Number(item.current_stock) <= 0);
  const uncategorised = items.filter((item) => !item.category_id);

  const groups = [
    ...categories.map((category) => ({
      key: category.id,
      name: category.name,
      members: items.filter((item) => item.category_id === category.id),
    })),
    ...(uncategorised.length
      ? [{ key: 'none', name: 'Uncategorised', members: uncategorised }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Welcome back, {user.fullName.split(' ')[0]}
        </h1>
        <p className="text-sm text-slate-500">Here is where stock stands right now.</p>
      </div>

      {params?.denied && (
        <Alert tone="error">
          You do not have permission to open that page with the {user.roleName ?? 'current'} role.
        </Alert>
      )}

      {loadError && (
        <Alert tone="error">
          Could not load dashboard data: {loadError.message}. If this is a fresh project, run the
          SQL migration in supabase/migrations/0001_init.sql first.
        </Alert>
      )}

      {!user.roleName && (
        <Alert tone="error">
          Your account has no role assigned, so most actions are blocked. Ask an administrator to
          set one.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Boxes} label="Items tracked" value={items.length} tone="indigo" />
        <Stat icon={Star} label="Important items" value={important.length} tone="amber" />
        <Stat icon={FolderOpen} label="Categories" value={categories.length} />
        <Stat
          icon={AlertTriangle}
          label="Out of stock"
          value={outOfStock.length}
          tone={outOfStock.length ? 'red' : 'slate'}
        />
      </div>

      {/* Important items — always on screen, ordered by display_order. */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">Important items</h2>
          </div>
          <Link href="/items/view" className="text-xs font-medium text-indigo-600 hover:underline">
            Adjust stock &rarr;
          </Link>
        </div>

        {important.length === 0 ? (
          <EmptyState icon={Star} title="No important items yet">
            Mark an item as important in Item Config and it will stay pinned here.
          </EmptyState>
        ) : (
          <ul className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {important.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 bg-white p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[item.shortcut_code, item.size].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <StockPill value={item.current_stock} unit={item.unit} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Categories — grouped stock, for planning what to order. */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
            <FolderOpen className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">Stock by category</h2>
          </div>

          {groups.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No categories yet">
              Create categories in Item Config to group items for ordering.
            </EmptyState>
          ) : (
            <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
              {groups.map((group) => {
                const empty = group.members.filter(
                  (item) => Number(item.current_stock) <= 0
                ).length;
                return (
                  <section key={group.key} className="bg-white p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-medium text-slate-900">{group.name}</h3>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {empty > 0 && <Badge tone="red">{empty} out</Badge>}
                        <Badge>{group.members.length} items</Badge>
                      </div>
                    </div>

                    {group.members.length === 0 ? (
                      <p className="text-xs text-slate-400">No items in this category.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {group.members.slice(0, 6).map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-2 py-1.5"
                          >
                            <span className="truncate text-xs text-slate-600">{item.name}</span>
                            <span
                              className={[
                                'tnum shrink-0 text-xs font-semibold',
                                Number(item.current_stock) <= 0 ? 'text-red-600' : 'text-slate-700',
                              ].join(' ')}
                            >
                              {Number(item.current_stock ?? 0)} {item.unit ?? ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {group.members.length > 6 && (
                      <p className="pt-2 text-xs text-slate-400">
                        +{group.members.length - 6} more
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent activity. */}
        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
            <Link href="/history" className="text-xs font-medium text-indigo-600 hover:underline">
              All &rarr;
            </Link>
          </div>

          {activity.length === 0 ? (
            <EmptyState icon={Boxes} title="No stock movements yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {activity.map((row) => {
                const credit = row.action_type === 'CREDIT';
                const Icon = credit ? TrendingUp : TrendingDown;
                return (
                  <li key={row.id} className="flex items-start gap-3 px-5 py-3">
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        credit ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-800">
                        <span className="font-medium">{row.item_name ?? 'Deleted item'}</span>{' '}
                        <span className="tnum text-slate-500">
                          {Number(row.quantity_changed) > 0 ? '+' : ''}
                          {Number(row.quantity_changed)}
                        </span>
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {row.user_name ?? 'Unknown'} ·{' '}
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
