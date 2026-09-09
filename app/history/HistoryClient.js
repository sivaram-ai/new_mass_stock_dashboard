'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  History,
  RotateCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ACTION_TYPES } from '@/lib/constants';
import { Alert, Badge, Button, Card, EmptyState, Input, Select, Spinner } from '@/components/ui';

const PAGE_SIZE = 50;

const BLANK_FILTERS = {
  from: '',
  to: '',
  itemId: '',
  userId: '',
  action: '',
  notes: '',
};

const COLUMNS = [
  { key: 'created_at', label: 'Date', align: 'left' },
  { key: 'item_name', label: 'Item', align: 'left' },
  { key: 'category_name', label: 'Category', align: 'left' },
  { key: 'action_type', label: 'Action', align: 'left' },
  { key: 'quantity_changed', label: 'Change', align: 'right' },
  { key: 'new_total', label: 'New total', align: 'right' },
  { key: 'user_name', label: 'User', align: 'left' },
  { key: 'notes', label: 'Notes', align: 'left' },
];

export default function HistoryClient() {
  const supabase = createClient();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);

  const [filters, setFilters] = useState(BLANK_FILTERS);
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [page, setPage] = useState(0);

  // Filter options. Loaded once — these lists are small and change rarely.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [itemsRes, usersRes] = await Promise.all([
        supabase.from('items').select('id, name').order('name'),
        supabase.from('profiles').select('id, email, full_name').order('email'),
      ]);

      if (cancelled) return;
      setItems(itemsRes.data ?? []);
      setUsers(
        (usersRes.data ?? []).map((user) => ({
          id: user.id,
          label: user.full_name || user.email?.split('@')[0] || 'Unknown',
        }))
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    let query = supabase
      .from('inventory_history_view')
      .select(
        'id, item_id, item_name, item_code, category_name, action_type, quantity_changed, new_total, notes, user_id, user_name, created_at',
        { count: 'exact' }
      );

    if (filters.from) query = query.gte('created_at', new Date(filters.from).toISOString());
    if (filters.to) {
      // The date input gives a day; include everything up to its final moment.
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    if (filters.itemId) query = query.eq('item_id', filters.itemId);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.action) query = query.eq('action_type', filters.action);
    if (filters.notes.trim()) query = query.ilike('notes', `%${filters.notes.trim()}%`);

    query = query
      .order(sort.key, { ascending: sort.dir === 'asc', nullsFirst: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const { data, error: queryError, count } = await query;

    if (queryError) {
      setError(queryError.message);
      setRows([]);
      setTotal(0);
    } else {
      setRows(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [supabase, filters, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Any filter change invalidates the current page number.
  function updateFilter(patch) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  }

  function toggleSort(key) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'created_at' ? 'desc' : 'asc' }
    );
    setPage(0);
  }

  const filtersActive = useMemo(
    () => Object.values(filters).some((value) => value !== ''),
    [filters]
  );

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Master history log</h1>
          <p className="text-sm text-slate-500">
            {total === 0
              ? 'No movements recorded'
              : `Showing ${rangeStart}–${rangeEnd} of ${total} movements`}
          </p>
        </div>
        {filtersActive && (
          <Button
            variant="secondary"
            onClick={() => {
              setFilters(BLANK_FILTERS);
              setPage(0);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {/* -------------------------------- filters -------------------------------- */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-600">From</span>
            <Input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => updateFilter({ from: event.target.value })}
            />
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-600">To</span>
            <Input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => updateFilter({ to: event.target.value })}
            />
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-600">Item</span>
            <Select
              value={filters.itemId}
              onChange={(event) => updateFilter({ itemId: event.target.value })}
            >
              <option value="">All items</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-600">User</span>
            <Select
              value={filters.userId}
              onChange={(event) => updateFilter({ userId: event.target.value })}
            >
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-600">Action</span>
            <Select
              value={filters.action}
              onChange={(event) => updateFilter({ action: event.target.value })}
            >
              <option value="">All actions</option>
              {ACTION_TYPES.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-600">Notes contain</span>
            <Input
              value={filters.notes}
              onChange={(event) => updateFilter({ notes: event.target.value })}
              placeholder="Search notes…"
            />
          </label>
        </div>
      </Card>

      {/* --------------------------------- table --------------------------------- */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                {COLUMNS.map((column) => {
                  const active = sort.key === column.key;
                  const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={`px-4 py-2 font-medium ${column.align === 'right' ? 'text-right' : ''}`}
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={`inline-flex items-center gap-1 hover:text-slate-900 ${
                          active ? 'text-slate-900' : ''
                        }`}
                      >
                        {column.label}
                        <Icon className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                    {format(new Date(row.created_at), 'dd MMM yyyy, HH:mm')}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-slate-900">
                      {row.item_name ?? 'Deleted item'}
                    </span>
                    {row.item_code && (
                      <span className="ml-1.5 text-xs text-slate-400">{row.item_code}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{row.category_name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge
                      tone={
                        row.action_type === 'CREDIT'
                          ? 'green'
                          : row.action_type === 'DEBIT'
                            ? 'amber'
                            : 'indigo'
                      }
                    >
                      {row.action_type}
                    </Badge>
                  </td>
                  <td
                    className={`tnum px-4 py-2.5 text-right font-medium ${
                      Number(row.quantity_changed) < 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {Number(row.quantity_changed) > 0 ? '+' : ''}
                    {Number(row.quantity_changed)}
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-slate-700">
                    {Number(row.new_total)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{row.user_name ?? 'Unknown'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{row.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && <Spinner label="Loading history" />}

        {!loading && rows.length === 0 && (
          <EmptyState icon={History} title="Nothing to show">
            {filtersActive
              ? 'No movements match these filters.'
              : 'Stock movements will appear here as they happen.'}
          </EmptyState>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Page {page + 1} of {lastPage + 1}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page === 0 || loading}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= lastPage || loading}
                onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
