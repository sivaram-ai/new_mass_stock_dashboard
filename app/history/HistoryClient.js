'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  BLANK_HISTORY_FILTERS,
  DEFAULT_HISTORY_SORT,
  HISTORY_PAGE_SIZE,
  buildHistoryQuery,
  historyCountKey,
} from '@/lib/history';
import { Alert, Badge, Button, Card, EmptyState, Input, Select, Spinner } from '@/components/ui';

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

/** Identity of a full result set: filters + sort + page. */
function queryKey(filters, sort, page) {
  return JSON.stringify([filters, sort, page]);
}

export default function HistoryClient({
  initialRows = [],
  initialTotal = 0,
  initialItems = [],
  initialUsers = [],
  initialError = '',
}) {
  const supabase = createClient();

  // Seeded from the server render: the first page, default sort and no
  // filters are already on screen, so navigating here shows no spinner.
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  const [items] = useState(initialItems);
  const [users] = useState(() =>
    initialUsers.map((user) => ({
      id: user.id,
      label: user.full_name || user.email?.split('@')[0] || 'Unknown',
    }))
  );

  const [filters, setFilters] = useState(BLANK_HISTORY_FILTERS);
  const [sort, setSort] = useState(DEFAULT_HISTORY_SORT);
  const [page, setPage] = useState(0);

  /*
   * Which query the rows on screen already represent. Seeded with the exact
   * query the server ran, so mounting does not refetch what we were just given.
   *
   * Keyed on the parameters rather than a "first run" flag: React StrictMode
   * invokes effects twice in development, which flips a boolean guard and lets
   * the second run fetch anyway. Comparing parameters is idempotent, so it
   * behaves the same however many times the effect runs.
   */
  const loadedKey = useRef(
    queryKey(BLANK_HISTORY_FILTERS, DEFAULT_HISTORY_SORT, 0)
  );
  // Total only changes when the filters change, so paging and re-sorting reuse
  // the count already in hand rather than making PostgREST count again.
  const countedFor = useRef(historyCountKey(BLANK_HISTORY_FILTERS));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const countKey = historyCountKey(filters);
    const withCount = countedFor.current !== countKey;

    const { data, error: queryError, count } = await buildHistoryQuery(supabase, {
      filters,
      sort,
      page,
      withCount,
    });

    if (queryError) {
      setError(queryError.message);
      setRows([]);
      setTotal(0);
    } else {
      setRows(data ?? []);
      if (withCount) {
        countedFor.current = countKey;
        setTotal(count ?? 0);
      }
    }
    setLoading(false);
  }, [supabase, filters, sort, page]);

  useEffect(() => {
    const key = queryKey(filters, sort, page);
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    load();
  }, [load, filters, sort, page]);

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

  const lastPage = Math.max(0, Math.ceil(total / HISTORY_PAGE_SIZE) - 1);
  const rangeStart = total === 0 ? 0 : page * HISTORY_PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * HISTORY_PAGE_SIZE);

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
              setFilters(BLANK_HISTORY_FILTERS);
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

        {total > HISTORY_PAGE_SIZE && (
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
